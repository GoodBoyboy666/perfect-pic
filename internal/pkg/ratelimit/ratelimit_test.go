package ratelimit

import (
	"testing"
	"time"

	"github.com/redis/go-redis/v9"
)

func TestBuildRedisKey_DefaultAndParts(t *testing.T) {
	base := NewBaseRateLimiter(nil, &Config{})
	if got := base.buildRedisKey(); got != "perfect_pic" {
		t.Fatalf("unexpected key: %q", got)
	}
	if got := base.buildRedisKey("a", "b"); got != "perfect_pic:a:b" {
		t.Fatalf("unexpected key with parts: %q", got)
	}
}

func TestAllowByRedisRateLimit_DisabledReturnsOK(t *testing.T) {
	l := NewTokenBucketLimiter(NewBaseRateLimiter(nil, &Config{}))
	ok, err := l.allowByRedisRateLimit(nil, "rate", "rps", "burst", "1.2.3.4", 0, 1)
	if err != nil || !ok {
		t.Fatalf("expected ok when rps disabled, ok=%v err=%v", ok, err)
	}

	ok, err = l.allowByRedisRateLimit(nil, "rate", "rps", "burst", "1.2.3.4", 1, 0)
	if err != nil || !ok {
		t.Fatalf("expected ok when burst disabled, ok=%v err=%v", ok, err)
	}
}

func TestAllowByRedisRateLimit_NilClientWhenEnabledReturnsError(t *testing.T) {
	l := NewTokenBucketLimiter(NewBaseRateLimiter(nil, &Config{}))
	ok, err := l.allowByRedisRateLimit(nil, "rate", "rps", "burst", "1.2.3.4", 1, 1)
	if err == nil || ok {
		t.Fatalf("expected nil-client error when enabled, ok=%v err=%v", ok, err)
	}
}

func TestAllowByRedisInterval_NilClientReturnsError(t *testing.T) {
	l := NewIntervalLimiter(NewBaseRateLimiter(nil, &Config{}))
	ok, err := l.allowByRedisInterval(nil, "interval", "1.2.3.4", time.Second)
	if err == nil || ok {
		t.Fatalf("expected nil-client error, ok=%v err=%v", ok, err)
	}
}

func TestTokenBucketLimiter_LocalAllowsAndBlocks(t *testing.T) {
	l := NewTokenBucketLimiter(NewBaseRateLimiter(nil, &Config{}))

	if ok := l.Allow("1.2.3.4", "rate", "auth_rps", "auth_burst", 0, 1); !ok {
		t.Fatalf("expected first request allowed")
	}
	if ok := l.Allow("1.2.3.4", "rate", "auth_rps", "auth_burst", 0, 1); ok {
		t.Fatalf("expected second request blocked")
	}
}

func TestTokenBucketLimiter_ScopeIsolation(t *testing.T) {
	l := NewTokenBucketLimiter(NewBaseRateLimiter(nil, &Config{}))

	if ok := l.Allow("1.2.3.4", "rate", "a_rps", "a_burst", 0, 1); !ok {
		t.Fatalf("expected first scope request allowed")
	}
	if ok := l.Allow("1.2.3.4", "rate", "b_rps", "b_burst", 0, 1); !ok {
		t.Fatalf("expected second scope request allowed independently")
	}
}

func TestIntervalLimiter_Local(t *testing.T) {
	l := NewIntervalLimiter(NewBaseRateLimiter(nil, &Config{}))
	interval := 30 * time.Millisecond

	if ok := l.Allow("1.2.3.4", "password_reset", interval); !ok {
		t.Fatalf("expected first request allowed")
	}
	if ok := l.Allow("1.2.3.4", "password_reset", interval); ok {
		t.Fatalf("expected immediate second request blocked")
	}

	time.Sleep(40 * time.Millisecond)
	if ok := l.Allow("1.2.3.4", "password_reset", interval); !ok {
		t.Fatalf("expected request allowed after interval")
	}
}

func TestIntervalLimiter_NamespaceIsolation(t *testing.T) {
	l := NewIntervalLimiter(NewBaseRateLimiter(nil, &Config{}))
	interval := 50 * time.Millisecond

	if ok := l.Allow("1.2.3.4", "password_reset", interval); !ok {
		t.Fatalf("expected first namespace allowed")
	}
	if ok := l.Allow("1.2.3.4", "email_change", interval); !ok {
		t.Fatalf("expected different namespace allowed")
	}
}

func TestAllowByRedisRateLimit_UnavailableRedisReturnsError(t *testing.T) {
	l := NewTokenBucketLimiter(NewBaseRateLimiter(nil, &Config{}))
	client := redis.NewClient(&redis.Options{
		Addr:        "127.0.0.1:1",
		DialTimeout: 50 * time.Millisecond,
	})
	defer func() { _ = client.Close() }()

	ok, err := l.allowByRedisRateLimit(client, "rate", "rps", "burst", "1.2.3.4", 1, 1)
	if err == nil || ok {
		t.Fatalf("expected redis unavailable error, ok=%v err=%v", ok, err)
	}
}

func TestAllowByRedisInterval_UnavailableRedisReturnsError(t *testing.T) {
	l := NewIntervalLimiter(NewBaseRateLimiter(nil, &Config{}))
	client := redis.NewClient(&redis.Options{
		Addr:        "127.0.0.1:1",
		DialTimeout: 50 * time.Millisecond,
	})
	defer func() { _ = client.Close() }()

	ok, err := l.allowByRedisInterval(client, "interval", "1.2.3.4", time.Second)
	if err == nil || ok {
		t.Fatalf("expected redis unavailable error, ok=%v err=%v", ok, err)
	}
}
