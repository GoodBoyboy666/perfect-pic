package handler

import (
	"perfect-pic-server/internal/config"
	repo "perfect-pic-server/internal/repository"
	"perfect-pic-server/internal/service"

	"github.com/google/wire"
)

type AuthHandler struct {
	authService    *service.AuthService
	captchaService *service.CaptchaService
	passkeyService *service.PasskeyService
	initService    *service.InitService
	dbConfig       *config.DBConfig
	staticConfig   *config.Config
}

type UserHandler struct {
	userService    *service.UserService
	imageService   *service.ImageService
	authService    *service.AuthService
	passkeyService *service.PasskeyService
	staticConfig   *config.Config
}

type ImageHandler struct {
	imageService *service.ImageService
}

type SystemHandler struct {
	initService  *service.InitService
	dbConfig     *config.DBConfig
	staticConfig *config.Config
	userService  *service.UserService
	imageStore   repo.ImageStore
	userStore    repo.UserStore
}

type SettingsHandler struct {
	settingsService *service.SettingsService
	emailService    *service.EmailService
}

func NewAuthHandler(
	authService *service.AuthService,
	captchaService *service.CaptchaService,
	passkeyService *service.PasskeyService,
	initService *service.InitService,
	dbConfig *config.DBConfig,
	staticConfig *config.Config,
) *AuthHandler {
	return &AuthHandler{
		authService:    authService,
		captchaService: captchaService,
		passkeyService: passkeyService,
		initService:    initService,
		dbConfig:       dbConfig,
		staticConfig:   staticConfig,
	}
}

func NewUserHandler(
	userService *service.UserService,
	imageService *service.ImageService,
	authService *service.AuthService,
	passkeyService *service.PasskeyService,
	staticConfig *config.Config,
) *UserHandler {
	return &UserHandler{
		userService:    userService,
		imageService:   imageService,
		authService:    authService,
		passkeyService: passkeyService,
		staticConfig:   staticConfig,
	}
}

func NewImageHandler(imageService *service.ImageService) *ImageHandler {
	return &ImageHandler{imageService: imageService}
}

func NewSystemHandler(
	initService *service.InitService,
	dbConfig *config.DBConfig,
	staticConfig *config.Config,
	userService *service.UserService,
	imageStore repo.ImageStore,
	userStore repo.UserStore,
) *SystemHandler {
	return &SystemHandler{
		initService:  initService,
		dbConfig:     dbConfig,
		staticConfig: staticConfig,
		userService:  userService,
		imageStore:   imageStore,
		userStore:    userStore,
	}
}

func NewSettingsHandler(
	settingsService *service.SettingsService,
	emailService *service.EmailService,
) *SettingsHandler {
	return &SettingsHandler{
		settingsService: settingsService,
		emailService:    emailService,
	}
}

var HandlerSet = wire.NewSet(
	NewAuthHandler,
	NewUserHandler,
	NewImageHandler,
	NewSystemHandler,
	NewSettingsHandler,
)
