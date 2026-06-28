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
}

type UserHandler struct {
	userService    *service.UserService
	imageService   *service.ImageService
	authService    *service.AuthService
	passkeyService *service.PasskeyService
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
) *AuthHandler {
	return &AuthHandler{
		authService:    authService,
		captchaService: captchaService,
		passkeyService: passkeyService,
		initService:    initService,
		dbConfig:       dbConfig,
	}
}

func NewUserHandler(
	userService *service.UserService,
	imageService *service.ImageService,
	authService *service.AuthService,
	passkeyService *service.PasskeyService,
) *UserHandler {
	return &UserHandler{
		userService:    userService,
		imageService:   imageService,
		authService:    authService,
		passkeyService: passkeyService,
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
