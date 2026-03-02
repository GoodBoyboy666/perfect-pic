package redis

import (
	"context"
	"log"
	"perfect-pic-server/internal/config"
	"time"

	"github.com/redis/go-redis/v9"
)

// RedisKey 基于配置前缀拼接 Redis 键名。
func RedisKey(parts ...string) string {
	cfg := config.Get()
	prefix := cfg.Redis.Prefix
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

// NewRedisClient 初始化 Redis 客户端；当未启用或不可用时返回 nil。
func NewRedisClient() *redis.Client {
	cfg := config.Get()
	if !cfg.Redis.Enabled {
		return nil
	}

	client := redis.NewClient(&redis.Options{
		Addr:     cfg.Redis.Addr,
		Password: cfg.Redis.Password,
		DB:       cfg.Redis.DB,
	})

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		_ = client.Close()
		log.Printf("⚠️ Redis 不可用，降级为内存模式: %v", err)
		return nil
	}

	log.Printf("✅ Redis 已连接: %s (db=%d)", cfg.Redis.Addr, cfg.Redis.DB)
	return client
}
