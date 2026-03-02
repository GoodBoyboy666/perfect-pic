package redis

import (
	"testing"
)

// 测试内容：验证 Redis key 使用默认前缀拼接。
func TestRedisKey_DefaultPrefix(t *testing.T) {
	// TestMain 在未设置时使用默认前缀初始化配置。
	got := RedisKey("a", "b")
	if got != "perfect_pic:a:b" {
		t.Fatalf("非预期 key: %q", got)
	}
}

// 测试内容：验证无参数时返回仅包含前缀的 key。
func TestRedisKey_NoParts(t *testing.T) {
	if got := RedisKey(); got != "perfect_pic" {
		t.Fatalf("非预期 key: %q", got)
	}
}

// 测试内容：验证禁用 Redis 时初始化客户端返回 nil。
func TestNewRedisClient_DisabledReturnsNil(t *testing.T) {
	// TestMain 将 redis 设为禁用；NewRedisClient 应返回 nil。
	if c := NewRedisClient(); c != nil {
		t.Fatalf("期望为 nil redis client when disabled")
	}
}
