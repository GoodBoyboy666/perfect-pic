package cache

import (
	"context"
	"errors"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

const redisOpTimeout = time.Second

type localEntry struct {
	value     string
	expiresAt time.Time
}

type Config struct {
	Prefix string
}

type Store struct {
	redisClient *redis.Client
	cfg         Config

	localMu sync.Mutex
	local   map[string]localEntry
}

func NewStore(redisClient *redis.Client, cfg *Config) *Store {
	return &Store{
		redisClient: redisClient,
		cfg:         *cfg,
		local:       make(map[string]localEntry),
	}
}

// RedisKey 基于配置前缀拼接 Redis 键名。
func (s *Store) RedisKey(parts ...string) string {

	prefix := s.cfg.Prefix
	if prefix == "" {
		prefix = "perfect_pic"
	}
	if len(parts) == 0 {
		return prefix
	}
	key := prefix
	for _, p := range parts {
		key += ":" + p
	}
	return key
}

// Set 先尝试写 Redis，失败时自动回退本地内存。
func (s *Store) Set(key, value string, ttl time.Duration) {
	if s.trySetRedis(key, value, ttl) {
		return
	}
	s.setLocal(key, value, ttl)
}

// SetIndexed 设置 indexKey->valueKey 与 valueKey->value，并保证 index 只有一个当前值。
func (s *Store) SetIndexed(indexKey, valueKey, value string, ttl time.Duration) {
	if s.trySetIndexedRedis(indexKey, valueKey, value, ttl) {
		return
	}
	s.setIndexedLocal(indexKey, valueKey, value, ttl)
}

// Get 读取 value，优先 Redis，失败或未命中自动回退本地内存。
func (s *Store) Get(key string) (string, bool) {
	if value, ok, err := s.getRedis(key); err == nil {
		if ok {
			return value, true
		}
	} else {
		_ = err
	}
	return s.getLocal(key)
}

// GetAndDelete 获取并删除 key，优先 Redis，失败或未命中自动回退本地内存。
func (s *Store) GetAndDelete(key string) (string, bool) {
	if value, ok, err := s.getDelRedis(key); err == nil {
		if ok {
			return value, true
		}
	} else {
		_ = err
	}
	return s.getAndDeleteLocal(key)
}

// Delete 删除多个 key，Redis 与本地内存都执行删除。
func (s *Store) Delete(keys ...string) {
	if len(keys) == 0 {
		return
	}
	_ = s.delRedis(keys...)
	s.localMu.Lock()
	defer s.localMu.Unlock()
	for _, key := range keys {
		delete(s.local, key)
	}
}

// CompareAndDeletePair 对一对关联缓存键执行“比较并删除”。
// 典型用法：valueKey 保存业务值，indexKey 保存 valueKey（或其标识）用于反向索引。
// 参数顺序：indexKey, expectedIndexValue, valueKey, expectedValue。
// 只有当 indexKey 的值等于 expectedIndexValue 且 valueKey 的值等于 expectedValue 时，
// 才会原子删除这两个键并返回 true；否则返回 false。
// 内部优先走 Redis WATCH 事务，Redis 不可判定时自动回退本地内存做同等语义校验。
func (s *Store) CompareAndDeletePair(indexKey, expectedIndexValue, valueKey, expectedValue string) bool {
	if consumed, known := s.compareAndDeletePairRedis(indexKey, expectedIndexValue, valueKey, expectedValue); known {
		return consumed
	}
	return s.compareAndDeletePairLocal(indexKey, expectedIndexValue, valueKey, expectedValue)
}

func (s *Store) ClearLocal() {
	s.localMu.Lock()
	defer s.localMu.Unlock()
	s.local = make(map[string]localEntry)
}

func (s *Store) CleanupExpiredLocal() {
	s.localMu.Lock()
	defer s.localMu.Unlock()
	s.cleanupExpiredLocalLocked(time.Now())
}

func (s *Store) trySetRedis(key, value string, ttl time.Duration) bool {
	if s.redisClient == nil {
		return false
	}
	ctx, cancel := context.WithTimeout(context.Background(), redisOpTimeout)
	defer cancel()
	return s.redisClient.Set(ctx, key, value, ttl).Err() == nil
}

func (s *Store) trySetIndexedRedis(indexKey, valueKey, value string, ttl time.Duration) bool {
	if s.redisClient == nil {
		return false
	}
	ctx, cancel := context.WithTimeout(context.Background(), redisOpTimeout)
	defer cancel()

	oldValueKey, err := s.redisClient.Get(ctx, indexKey).Result()
	if err == nil && oldValueKey != "" {
		_ = s.redisClient.Del(ctx, oldValueKey).Err()
	} else if err != nil && !errors.Is(err, redis.Nil) {
		return false
	}

	if err := s.redisClient.Set(ctx, valueKey, value, ttl).Err(); err != nil {
		return false
	}
	if err := s.redisClient.Set(ctx, indexKey, valueKey, ttl).Err(); err != nil {
		_ = s.redisClient.Del(ctx, valueKey).Err()
		return false
	}
	return true
}

func (s *Store) getRedis(key string) (string, bool, error) {
	if s.redisClient == nil {
		return "", false, nil
	}
	ctx, cancel := context.WithTimeout(context.Background(), redisOpTimeout)
	defer cancel()

	value, err := s.redisClient.Get(ctx, key).Result()
	if err != nil {
		if errors.Is(err, redis.Nil) {
			return "", false, nil
		}
		return "", false, err
	}
	return value, true, nil
}

func (s *Store) getDelRedis(key string) (string, bool, error) {
	if s.redisClient == nil {
		return "", false, nil
	}
	ctx, cancel := context.WithTimeout(context.Background(), redisOpTimeout)
	defer cancel()

	value, err := s.redisClient.GetDel(ctx, key).Result()
	if err != nil {
		if errors.Is(err, redis.Nil) {
			return "", false, nil
		}
		return "", false, err
	}
	return value, true, nil
}

func (s *Store) delRedis(keys ...string) error {
	if s.redisClient == nil || len(keys) == 0 {
		return nil
	}
	ctx, cancel := context.WithTimeout(context.Background(), redisOpTimeout)
	defer cancel()
	return s.redisClient.Del(ctx, keys...).Err()
}

// known=false 表示 Redis 无法给出可靠结论（如未启用或异常），调用方应回退本地缓存重试语义。
func (s *Store) compareAndDeletePairRedis(indexKey, expectedIndexValue, valueKey, expectedValue string) (consumed bool, known bool) {
	if s.redisClient == nil {
		return false, false
	}

	ctx, cancel := context.WithTimeout(context.Background(), redisOpTimeout)
	defer cancel()

	var applied bool
	err := s.redisClient.Watch(ctx, func(tx *redis.Tx) error {
		currentIndex, err := tx.Get(ctx, indexKey).Result()
		if err != nil {
			if errors.Is(err, redis.Nil) {
				return redis.TxFailedErr
			}
			return err
		}
		if currentIndex != expectedIndexValue {
			return redis.TxFailedErr
		}

		currentValue, err := tx.Get(ctx, valueKey).Result()
		if err != nil {
			if errors.Is(err, redis.Nil) {
				return redis.TxFailedErr
			}
			return err
		}
		if currentValue != expectedValue {
			return redis.TxFailedErr
		}

		_, err = tx.TxPipelined(ctx, func(pipe redis.Pipeliner) error {
			pipe.Del(ctx, valueKey)
			pipe.Del(ctx, indexKey)
			return nil
		})
		if err != nil {
			return err
		}

		applied = true
		return nil
	}, indexKey, valueKey)

	if errors.Is(err, redis.TxFailedErr) {
		return false, true
	}
	if err != nil {
		return false, false
	}
	return applied, true
}

func (s *Store) setLocal(key, value string, ttl time.Duration) {
	s.localMu.Lock()
	defer s.localMu.Unlock()
	s.cleanupExpiredLocalLocked(time.Now())
	s.local[key] = localEntry{
		value:     value,
		expiresAt: time.Now().Add(ttl),
	}
}

func (s *Store) setIndexedLocal(indexKey, valueKey, value string, ttl time.Duration) {
	s.localMu.Lock()
	defer s.localMu.Unlock()
	now := time.Now()
	s.cleanupExpiredLocalLocked(now)

	if old, ok := s.local[indexKey]; ok && now.Before(old.expiresAt) && old.value != "" {
		delete(s.local, old.value)
	}

	expiresAt := now.Add(ttl)
	s.local[valueKey] = localEntry{value: value, expiresAt: expiresAt}
	s.local[indexKey] = localEntry{value: valueKey, expiresAt: expiresAt}
}

func (s *Store) getLocal(key string) (string, bool) {
	s.localMu.Lock()
	defer s.localMu.Unlock()
	now := time.Now()
	entry, ok := s.local[key]
	if !ok {
		return "", false
	}
	if now.After(entry.expiresAt) {
		delete(s.local, key)
		return "", false
	}
	return entry.value, true
}

func (s *Store) getAndDeleteLocal(key string) (string, bool) {
	s.localMu.Lock()
	defer s.localMu.Unlock()
	now := time.Now()
	entry, ok := s.local[key]
	if !ok {
		return "", false
	}
	delete(s.local, key)
	if now.After(entry.expiresAt) {
		return "", false
	}
	return entry.value, true
}

func (s *Store) compareAndDeletePairLocal(indexKey, expectedIndexValue, valueKey, expectedValue string) bool {
	s.localMu.Lock()
	defer s.localMu.Unlock()
	now := time.Now()

	indexEntry, ok := s.local[indexKey]
	if !ok || now.After(indexEntry.expiresAt) {
		if ok {
			delete(s.local, indexKey)
		}
		return false
	}
	if indexEntry.value != expectedIndexValue {
		return false
	}

	valueEntry, ok := s.local[valueKey]
	if !ok || now.After(valueEntry.expiresAt) {
		if ok {
			delete(s.local, valueKey)
		}
		return false
	}
	if valueEntry.value != expectedValue {
		return false
	}

	delete(s.local, valueKey)
	delete(s.local, indexKey)
	return true
}

func (s *Store) cleanupExpiredLocalLocked(now time.Time) {
	for key, entry := range s.local {
		if now.After(entry.expiresAt) {
			delete(s.local, key)
		}
	}
}
