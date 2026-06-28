package service

import (
	"perfect-pic-server/internal/config"
	"perfect-pic-server/internal/pkg/cache"
	"perfect-pic-server/internal/pkg/email"
	"perfect-pic-server/internal/pkg/jwt"
	repo "perfect-pic-server/internal/repository"

	"github.com/google/wire"
)

type AuthService struct {
	dbConfig     *config.DBConfig
	jwt          *jwt.JWT
	userStore    repo.UserStore
	userService  *UserService
	emailService *EmailService
	initService  *InitService
}

type UserService struct {
	userStore      repo.UserStore
	dbConfig       *config.DBConfig
	jwt            *jwt.JWT
	cache          *cache.Store
	emailService   *EmailService
	imageService   *ImageService
	passkeyService *PasskeyService
}

type ImageService struct {
	imageStore   repo.ImageStore
	userStore    repo.UserStore
	dbConfig     *config.DBConfig
	staticConfig *config.Config
}

type EmailService struct {
	dbConfig     *config.DBConfig
	staticConfig *config.Config
	mailer       *email.Mailer
}

type InitService struct {
	systemStore repo.SystemStore
	dbConfig    *config.DBConfig
}

type PasskeyService struct {
	dbConfig            *config.DBConfig
	passkeyStore        repo.PasskeyStore
	passkeySessionCache *cache.Store
	jwt                 *jwt.JWT
	userStore           repo.UserStore
}

type SettingsService struct {
	settingStore repo.SettingStore
	dbConfig     *config.DBConfig
}

type CaptchaService struct {
	dbConfig *config.DBConfig
}

func NewAuthService(
	dbConfig *config.DBConfig,
	jwt *jwt.JWT,
	userStore repo.UserStore,
	userService *UserService,
	emailService *EmailService,
	initService *InitService,
) *AuthService {
	return &AuthService{
		dbConfig:     dbConfig,
		jwt:          jwt,
		userStore:    userStore,
		userService:  userService,
		emailService: emailService,
		initService:  initService,
	}
}

func NewUserService(
	userStore repo.UserStore,
	dbConfig *config.DBConfig,
	cache *cache.Store,
	jwt *jwt.JWT,
	emailService *EmailService,
	imageService *ImageService,
	passkeyService *PasskeyService,
) *UserService {
	return &UserService{
		userStore:      userStore,
		dbConfig:       dbConfig,
		jwt:            jwt,
		cache:          cache,
		emailService:   emailService,
		imageService:   imageService,
		passkeyService: passkeyService,
	}
}

func NewImageService(
	imageStore repo.ImageStore,
	dbConfig *config.DBConfig,
	staticConfig *config.Config,
	userStore repo.UserStore,
) *ImageService {
	return &ImageService{
		imageStore:   imageStore,
		dbConfig:     dbConfig,
		staticConfig: staticConfig,
		userStore:    userStore,
	}
}

func NewEmailService(dbConfig *config.DBConfig, mailer *email.Mailer, staticConfig *config.Config) *EmailService {
	return &EmailService{
		dbConfig:     dbConfig,
		staticConfig: staticConfig,
		mailer:       mailer,
	}
}

func NewInitService(systemStore repo.SystemStore, dbConfig *config.DBConfig) *InitService {
	return &InitService{systemStore: systemStore, dbConfig: dbConfig}
}

func NewPasskeyService(
	passkeyStore repo.PasskeyStore,
	dbConfig *config.DBConfig,
	cache *cache.Store,
	jwt *jwt.JWT,
	userStore repo.UserStore,
) *PasskeyService {
	return &PasskeyService{
		passkeyStore:        passkeyStore,
		dbConfig:            dbConfig,
		passkeySessionCache: cache,
		jwt:                 jwt,
		userStore:           userStore,
	}
}

func NewSettingsService(settingStore repo.SettingStore, dbConfig *config.DBConfig) *SettingsService {
	return &SettingsService{settingStore: settingStore, dbConfig: dbConfig}
}

func NewCaptchaService(dbConfig *config.DBConfig) *CaptchaService {
	return &CaptchaService{dbConfig: dbConfig}
}

var ServiceSet = wire.NewSet(
	NewAuthService,
	NewUserService,
	NewImageService,
	NewEmailService,
	NewInitService,
	NewPasskeyService,
	NewSettingsService,
	NewCaptchaService,
)
