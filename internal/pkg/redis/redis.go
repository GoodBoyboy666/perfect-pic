package redis

import (
	"context"
	"log"
	"time"

	"github.com/redis/go-redis/v9"
)

type Config struct {
	Enable   bool
	Addr     string
	Password string
	DB       int
}

// NewRedisClient 初始化 Redis 客户端；当未启用或不可用时返回 nil。
func NewRedisClient(cfg *Config) *redis.Client {

	if !cfg.Enable {
		return nil
	}

	client := redis.NewClient(&redis.Options{
		Addr:     cfg.Addr,
		Password: cfg.Password,
		DB:       cfg.DB,
	})

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		_ = client.Close()
		log.Printf("⚠️ Redis 不可用，降级为内存模式: %v", err)
		return nil
	}

	log.Printf("✅ Redis 已连接: %s (db=%d)", cfg.Addr, cfg.DB)
	return client
}
