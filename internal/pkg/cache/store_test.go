package cache

import (
	"testing"
	"time"
)

func newTestStore(prefix string) *Store {
	return NewStore(nil, &Config{Prefix: prefix})
}

func TestRedisKey_DefaultAndCustomPrefix(t *testing.T) {
	s1 := newTestStore("")
	if got := s1.RedisKey("a", "b"); got != "perfect_pic:a:b" {
		t.Fatalf("unexpected key: %q", got)
	}
	if got := s1.RedisKey(); got != "perfect_pic" {
		t.Fatalf("unexpected key without parts: %q", got)
	}

	s2 := newTestStore("pp")
	if got := s2.RedisKey("x"); got != "pp:x" {
		t.Fatalf("unexpected custom key: %q", got)
	}
}

func TestSetGetDelete_LocalFallback(t *testing.T) {
	s := newTestStore("test")
	key := s.RedisKey("k")

	s.Set(key, "v1", time.Minute)
	if got, ok := s.Get(key); !ok || got != "v1" {
		t.Fatalf("expected value v1, got=%q ok=%v", got, ok)
	}

	s.Delete(key)
	if _, ok := s.Get(key); ok {
		t.Fatalf("expected key deleted")
	}
}

func TestGetAndDelete_LocalFallback(t *testing.T) {
	s := newTestStore("test")
	key := s.RedisKey("k")
	s.Set(key, "v", time.Minute)

	got, ok := s.GetAndDelete(key)
	if !ok || got != "v" {
		t.Fatalf("expected get-del success, got=%q ok=%v", got, ok)
	}
	if _, ok := s.Get(key); ok {
		t.Fatalf("expected key deleted after get-del")
	}
}

func TestSetIndexed_ReplacesPreviousMapping(t *testing.T) {
	s := newTestStore("test")
	indexKey := s.RedisKey("email_change", "user", "1")
	tokenKey1 := s.RedisKey("email_change", "token", "t1")
	tokenKey2 := s.RedisKey("email_change", "token", "t2")

	s.SetIndexed(indexKey, tokenKey1, "payload1", time.Minute)
	s.SetIndexed(indexKey, tokenKey2, "payload2", time.Minute)

	if got, ok := s.Get(indexKey); !ok || got != tokenKey2 {
		t.Fatalf("expected index points latest token key, got=%q ok=%v", got, ok)
	}
	if _, ok := s.Get(tokenKey1); ok {
		t.Fatalf("expected old token key removed")
	}
	if got, ok := s.Get(tokenKey2); !ok || got != "payload2" {
		t.Fatalf("expected latest payload, got=%q ok=%v", got, ok)
	}
}

func TestCompareAndDeletePair_SuccessAndMismatch(t *testing.T) {
	s := newTestStore("test")
	indexKey := s.RedisKey("password_reset", "user", "1")
	valueKey := s.RedisKey("password_reset", "token", "abc")
	value := "1"
	s.SetIndexed(indexKey, valueKey, value, time.Minute)

	if ok := s.CompareAndDeletePair(indexKey, valueKey, valueKey, value); !ok {
		t.Fatalf("expected compare-and-delete success")
	}
	if _, ok := s.Get(indexKey); ok {
		t.Fatalf("expected index key deleted")
	}
	if _, ok := s.Get(valueKey); ok {
		t.Fatalf("expected value key deleted")
	}

	s.SetIndexed(indexKey, valueKey, value, time.Minute)
	if ok := s.CompareAndDeletePair(indexKey, "wrong", valueKey, value); ok {
		t.Fatalf("expected compare-and-delete mismatch fail")
	}
	if _, ok := s.Get(indexKey); !ok {
		t.Fatalf("expected keys remain on mismatch")
	}
}

func TestCleanupExpiredLocal_RemovesExpired(t *testing.T) {
	s := newTestStore("test")
	key := s.RedisKey("exp")

	s.Set(key, "v", 10*time.Millisecond)
	time.Sleep(20 * time.Millisecond)
	s.CleanupExpiredLocal()

	if _, ok := s.Get(key); ok {
		t.Fatalf("expected expired key removed")
	}
}
