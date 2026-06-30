package router

import (
	"perfect-pic-server/internal/consts"
	"perfect-pic-server/internal/handler"
	"perfect-pic-server/internal/middleware"

	"github.com/gin-gonic/gin"
)

func registerAuthRoutes(
	api *gin.RouterGroup,
	authLimiter gin.HandlerFunc,
	h *handler.AuthHandler,
	rateLimitMiddleware *middleware.RateLimitMiddleware,
	bodyLimitMiddleware *middleware.BodyLimitMiddleware,
) {
	bodyLimit := bodyLimitMiddleware.BodyLimitMiddleware()

	api.POST("/login", bodyLimit, authLimiter, h.Login)
	api.POST("/register", bodyLimit, authLimiter, h.Register)
	api.POST("/auth/passkey/login/start", bodyLimit, authLimiter, h.BeginPasskeyLogin)
	api.POST("/auth/passkey/login/finish", bodyLimit, authLimiter, h.FinishPasskeyLogin)

	// Token 校验间隔：默认 5 秒
	tokenVerifyLimiter := rateLimitMiddleware.IntervalRate(consts.ConfigRateLimitTokenVerifyIntervalSeconds)
	// 密码重置请求间隔：默认 120 秒
	resetRequestLimiter := rateLimitMiddleware.IntervalRate(consts.ConfigRateLimitPasswordResetIntervalSeconds)

	api.POST("/auth/email-verify", bodyLimit, tokenVerifyLimiter, h.EmailVerify)
	api.POST("/auth/email-change-verify", bodyLimit, tokenVerifyLimiter, h.EmailChangeVerify)
	api.POST("/auth/password/reset/request", bodyLimit, resetRequestLimiter, h.RequestPasswordReset)
	api.POST("/auth/password/reset", bodyLimit, tokenVerifyLimiter, h.ResetPassword)

	api.GET("/register", h.GetRegisterState)
	api.GET("/captcha", h.GetCaptcha)
	api.GET("/captcha/image", authLimiter, h.GetCaptchaImage)
}
