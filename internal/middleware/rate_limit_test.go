package middleware

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"perfect-pic-server/internal/pkg/ratelimit"
	"testing"

	"perfect-pic-server/internal/consts"
	"perfect-pic-server/internal/model"

	"github.com/gin-gonic/gin"
)

// 测试内容：验证限流关闭时请求不会被拦截。
func TestRateLimitMiddleware_DisabledAllowsRequests(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupTestDB(t)
	rateLimitMiddleware := NewRateLimitMiddleware(
		testService,
		ratelimit.NewTokenBucketLimiter(ratelimit.NewBaseRateLimiter(nil, &ratelimit.Config{})),
		ratelimit.NewIntervalLimiter(ratelimit.NewBaseRateLimiter(nil, &ratelimit.Config{})),
	)

	if err := testGormDB.Save(&model.Setting{Key: consts.ConfigRateLimitEnabled, Value: "false"}).Error; err != nil {
		t.Fatalf("设置配置项失败: %v", err)
	}
	testService.ClearCache()

	r := gin.New()
	r.Use(rateLimitMiddleware.RateLimit(consts.ConfigRateLimitAuthRPS, consts.ConfigRateLimitAuthBurst))
	r.GET("/x", func(c *gin.Context) { c.Status(http.StatusOK) })

	req1 := httptest.NewRequest(http.MethodGet, "/x", nil)
	req1.RemoteAddr = "1.2.3.4:1111"
	w1 := httptest.NewRecorder()
	r.ServeHTTP(w1, req1)
	if w1.Code != http.StatusOK {
		t.Fatalf("期望 200，实际为 %d", w1.Code)
	}

	req2 := httptest.NewRequest(http.MethodGet, "/x", nil)
	req2.RemoteAddr = "1.2.3.4:1111"
	w2 := httptest.NewRecorder()
	r.ServeHTTP(w2, req2)
	if w2.Code != http.StatusOK {
		t.Fatalf("期望 200，实际为 %d", w2.Code)
	}
}

// 测试内容：验证限流开启且无补充时会阻止突发请求。
func TestRateLimitMiddleware_EnabledBlocksBurst(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupTestDB(t)
	rateLimitMiddleware := NewRateLimitMiddleware(
		testService,
		ratelimit.NewTokenBucketLimiter(ratelimit.NewBaseRateLimiter(nil, &ratelimit.Config{})),
		ratelimit.NewIntervalLimiter(ratelimit.NewBaseRateLimiter(nil, &ratelimit.Config{})),
	)

	// 启用限流器：突发 1 个令牌且不补充（rps=0）。
	_ = testGormDB.Save(&model.Setting{Key: consts.ConfigRateLimitEnabled, Value: "true"}).Error
	_ = testGormDB.Save(&model.Setting{Key: consts.ConfigRateLimitAuthRPS, Value: "0"}).Error
	_ = testGormDB.Save(&model.Setting{Key: consts.ConfigRateLimitAuthBurst, Value: "1"}).Error
	testService.ClearCache()

	r := gin.New()
	r.Use(rateLimitMiddleware.RateLimit(consts.ConfigRateLimitAuthRPS, consts.ConfigRateLimitAuthBurst))
	r.GET("/x", func(c *gin.Context) { c.Status(http.StatusOK) })

	req1 := httptest.NewRequest(http.MethodGet, "/x", nil)
	req1.RemoteAddr = "1.2.3.4:1111"
	w1 := httptest.NewRecorder()
	r.ServeHTTP(w1, req1)
	if w1.Code != http.StatusOK {
		t.Fatalf("期望 200，实际为 %d", w1.Code)
	}

	req2 := httptest.NewRequest(http.MethodGet, "/x", nil)
	req2.RemoteAddr = "1.2.3.4:1111"
	w2 := httptest.NewRecorder()
	r.ServeHTTP(w2, req2)
	if w2.Code != http.StatusTooManyRequests {
		t.Fatalf("期望 429，实际为 %d", w2.Code)
	}
}

// 测试内容：验证按配置键读取间隔的限流会拦截同一来源的第二次请求。
func TestIntervalRateMiddleware_BlocksSecondRequest(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupTestDB(t)
	rateLimitMiddleware := NewRateLimitMiddleware(
		testService,
		ratelimit.NewTokenBucketLimiter(ratelimit.NewBaseRateLimiter(nil, &ratelimit.Config{})),
		ratelimit.NewIntervalLimiter(ratelimit.NewBaseRateLimiter(nil, &ratelimit.Config{})),
	)

	_ = testGormDB.Save(&model.Setting{Key: consts.ConfigEnableSensitiveRateLimit, Value: "true"}).Error
	_ = testGormDB.Save(&model.Setting{
		Key:   consts.ConfigRateLimitPasswordResetIntervalSeconds,
		Value: "10",
	}).Error
	testService.ClearCache()

	r := gin.New()
	r.POST("/x", rateLimitMiddleware.IntervalRate(consts.ConfigRateLimitPasswordResetIntervalSeconds), func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	req1 := httptest.NewRequest(http.MethodPost, "/x", bytes.NewReader([]byte("a")))
	req1.RemoteAddr = "1.2.3.4:1111"
	w1 := httptest.NewRecorder()
	r.ServeHTTP(w1, req1)
	if w1.Code != http.StatusOK {
		t.Fatalf("期望 200，实际为 %d", w1.Code)
	}

	req2 := httptest.NewRequest(http.MethodPost, "/x", bytes.NewReader([]byte("a")))
	req2.RemoteAddr = "1.2.3.4:1111"
	w2 := httptest.NewRecorder()
	r.ServeHTTP(w2, req2)
	if w2.Code != http.StatusTooManyRequests {
		t.Fatalf("期望 429，实际为 %d", w2.Code)
	}
}

// 测试内容：验证不同配置键可独立控制间隔限流。
func TestIntervalRateMiddleware_WithAnotherConfigKey_BlocksSecondRequest(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupTestDB(t)
	rateLimitMiddleware := NewRateLimitMiddleware(
		testService,
		ratelimit.NewTokenBucketLimiter(ratelimit.NewBaseRateLimiter(nil, &ratelimit.Config{})),
		ratelimit.NewIntervalLimiter(ratelimit.NewBaseRateLimiter(nil, &ratelimit.Config{})),
	)

	_ = testGormDB.Save(&model.Setting{Key: consts.ConfigEnableSensitiveRateLimit, Value: "true"}).Error
	_ = testGormDB.Save(&model.Setting{
		Key:   consts.ConfigRateLimitUsernameUpdateIntervalSeconds,
		Value: "10",
	}).Error
	testService.ClearCache()

	r := gin.New()
	r.POST("/x", rateLimitMiddleware.IntervalRate(consts.ConfigRateLimitUsernameUpdateIntervalSeconds), func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	req1 := httptest.NewRequest(http.MethodPost, "/x", bytes.NewReader([]byte("a")))
	req1.RemoteAddr = "1.2.3.4:1111"
	w1 := httptest.NewRecorder()
	r.ServeHTTP(w1, req1)
	if w1.Code != http.StatusOK {
		t.Fatalf("期望 200，实际为 %d", w1.Code)
	}

	req2 := httptest.NewRequest(http.MethodPost, "/x", bytes.NewReader([]byte("a")))
	req2.RemoteAddr = "1.2.3.4:1111"
	w2 := httptest.NewRecorder()
	r.ServeHTTP(w2, req2)
	if w2.Code != http.StatusTooManyRequests {
		t.Fatalf("期望 429，实际为 %d", w2.Code)
	}
}
