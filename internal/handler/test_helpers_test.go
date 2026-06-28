package handler

import (
	"perfect-pic-server/internal/consts"
	"testing"

	"perfect-pic-server/internal/config"
	"perfect-pic-server/internal/pkg/cache"
	pkgmail "perfect-pic-server/internal/pkg/email"
	jwtpkg "perfect-pic-server/internal/pkg/jwt"
	"perfect-pic-server/internal/repository"
	"perfect-pic-server/internal/service"
	"perfect-pic-server/internal/testutils"

	"gorm.io/gorm"
)

type compositeHandler struct {
	*AuthHandler
	*UserHandler
	*ImageHandler
	*SystemHandler
	*SettingsHandler
}

var (
	testService *config.DBConfig
	testUserSvc *service.UserService
	testHandler *compositeHandler
	testGormDB  *gorm.DB
)

func setupTestDB(t *testing.T) {
	t.Helper()
	t.Setenv("PERFECT_PIC_SMTP_HOST", "127.0.0.1")
	t.Setenv("PERFECT_PIC_SMTP_FROM", "noreply@example.com")
	config.InitConfig("")

	gdb := testutils.SetupDB(t)
	testGormDB = gdb
	userStore := repository.NewUserRepository(gdb)
	imageStore := repository.NewImageRepository(gdb)
	settingStore := repository.NewSettingRepository(gdb)
	systemStore := repository.NewSystemRepository(gdb)
	passkeyStore := repository.NewPasskeyRepository(gdb)

	dbConfig := config.NewDBConfig(settingStore)
	staticConfig := config.NewStaticConfig()
	tokenService := jwtpkg.NewJWT(config.NewJWTConfig(staticConfig))
	cacheStore := cache.NewStore(nil, config.NewCacheConfig(staticConfig))

	emailService := service.NewEmailService(dbConfig, pkgmail.NewMailer(), staticConfig)
	captchaService := service.NewCaptchaService(dbConfig)
	initService := service.NewInitService(systemStore, dbConfig)
	passkeyService := service.NewPasskeyService(passkeyStore, dbConfig, cacheStore, tokenService, userStore)
	imageService := service.NewImageService(imageStore, dbConfig, staticConfig, userStore)
	userService := service.NewUserService(userStore, dbConfig, cacheStore, tokenService, emailService, imageService, passkeyService)
	settingsService := service.NewSettingsService(settingStore, dbConfig)
	authService := service.NewAuthService(dbConfig, tokenService, userStore, userService, emailService, initService)

	testService = dbConfig
	testUserSvc = userService
	if err := testService.InitializeSettings(); err != nil {
		t.Fatalf("InitializeSettings failed: %v", err)
	}
	if err := settingStore.UpdateSettings([]repository.UpdateSettingItem{{
		Key:   consts.ConfigEnableSMTP,
		Value: "true",
	}}, ""); err != nil {
		t.Fatalf("enable smtp for tests failed: %v", err)
	}
	testService.ClearCache()

	testHandler = &compositeHandler{
		AuthHandler:     NewAuthHandler(authService, captchaService, passkeyService, initService, dbConfig),
		UserHandler:     NewUserHandler(userService, imageService, authService, passkeyService),
		ImageHandler:    NewImageHandler(imageService),
		SystemHandler:   NewSystemHandler(initService, dbConfig, staticConfig, userService, imageStore, userStore),
		SettingsHandler: NewSettingsHandler(settingsService, emailService),
	}
}
