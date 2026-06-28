package router

import (
	"testing"

	"perfect-pic-server/internal/config"
	"perfect-pic-server/internal/handler"
	"perfect-pic-server/internal/middleware"
	"perfect-pic-server/internal/pkg/cache"
	pkgmail "perfect-pic-server/internal/pkg/email"
	jwtpkg "perfect-pic-server/internal/pkg/jwt"
	"perfect-pic-server/internal/pkg/ratelimit"
	"perfect-pic-server/internal/repository"
	"perfect-pic-server/internal/service"
	"perfect-pic-server/internal/testutils"

	"github.com/gin-gonic/gin"
)

// 测试内容：验证核心 API 路由被正确注册。
func TestInitRouter_RegistersCoreRoutes(t *testing.T) {
	gin.SetMode(gin.TestMode)
	gdb := testutils.SetupDB(t)
	userStore := repository.NewUserRepository(gdb)
	imageStore := repository.NewImageRepository(gdb)
	settingStore := repository.NewSettingRepository(gdb)
	systemStore := repository.NewSystemRepository(gdb)
	passkeyStore := repository.NewPasskeyRepository(gdb)

	dbConfig := config.NewDBConfig(settingStore)
	staticConfig := config.NewStaticConfig()
	tokenService := jwtpkg.NewJWT(config.NewJWTConfig(staticConfig))
	cacheStore := cache.NewStore(nil, config.NewCacheConfig(staticConfig))
	if err := dbConfig.InitializeSettings(); err != nil {
		t.Fatalf("InitializeSettings failed: %v", err)
	}
	dbConfig.ClearCache()

	captchaService := service.NewCaptchaService(dbConfig)
	emailService := service.NewEmailService(dbConfig, pkgmail.NewMailer(), staticConfig)
	initService := service.NewInitService(systemStore, dbConfig)
	passkeyService := service.NewPasskeyService(passkeyStore, dbConfig, cacheStore, tokenService, userStore)
	imageService := service.NewImageService(imageStore, dbConfig, staticConfig, userStore)
	userService := service.NewUserService(userStore, dbConfig, cacheStore, tokenService, emailService, imageService, passkeyService)
	authService := service.NewAuthService(dbConfig, tokenService, userStore, userService, emailService, initService)
	settingsService := service.NewSettingsService(settingStore, dbConfig)

	authHandler := handler.NewAuthHandler(authService, captchaService, passkeyService, initService, dbConfig)
	systemHandler := handler.NewSystemHandler(initService, dbConfig, staticConfig, userService, imageStore, userStore)
	settingsHandler := handler.NewSettingsHandler(settingsService, emailService)
	userHandler := handler.NewUserHandler(userService, imageService, authService, passkeyService)
	imageHandler := handler.NewImageHandler(imageService)
	authMiddleware := middleware.NewAuthMiddleware(tokenService, userService)
	rateLimitMiddleware := middleware.NewRateLimitMiddleware(
		dbConfig,
		ratelimit.NewTokenBucketLimiter(nil),
		ratelimit.NewIntervalLimiter(nil),
	)
	bodyLimitMiddleware := middleware.NewBodyLimitMiddleware(dbConfig)
	securityHeadersMiddleware := middleware.NewSecurityHeadersMiddleware(dbConfig)
	rt := NewRouter(
		authMiddleware,
		rateLimitMiddleware,
		bodyLimitMiddleware,
		securityHeadersMiddleware,
		authHandler,
		systemHandler,
		settingsHandler,
		userHandler,
		imageHandler,
	)

	r := gin.New()
	rt.Init(r)

	type wantRoute struct {
		method string
		path   string
	}
	wants := []wantRoute{
		{method: "GET", path: "/api/ping"},
		{method: "POST", path: "/api/login"},
		{method: "POST", path: "/api/register"},
		{method: "POST", path: "/api/auth/passkey/login/start"},
		{method: "POST", path: "/api/auth/passkey/login/finish"},
		{method: "GET", path: "/api/user/passkeys"},
		{method: "PATCH", path: "/api/user/passkeys/:id/name"},
		{method: "DELETE", path: "/api/user/passkeys/:id"},
		{method: "POST", path: "/api/user/passkeys/register/start"},
		{method: "POST", path: "/api/user/passkeys/register/finish"},
		{method: "GET", path: "/api/user/ping"},
		{method: "GET", path: "/api/admin/stats"},
	}

	have := make(map[string]bool)
	for _, rt := range r.Routes() {
		have[rt.Method+" "+rt.Path] = true
	}

	for _, w := range wants {
		if !have[w.method+" "+w.path] {
			t.Fatalf("缺少路由: %s %s", w.method, w.path)
		}
	}
}
