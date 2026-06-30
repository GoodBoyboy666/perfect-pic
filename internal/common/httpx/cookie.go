package httpx

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

const (
	// JWTCookieName JWT认证Cookie名称
	JWTCookieName = "jwt_token"
	// CSRFCookieName CSRF Token Cookie名称
	CSRFCookieName = "XSRF-TOKEN"
	// CSRFCookieHeader CSRF Token的HTTP Header名称
	CSRFHeaderName = "X-CSRF-Token"

	// JwtSourceCookie JWT来源于Cookie
	JwtSourceCookie = "cookie"
	// JwtSourceHeader JWT来源于Authorization Header
	JwtSourceHeader = "header"
)

// SetJwtSource 标记JWT来源到Gin context中。
func SetJwtSource(c *gin.Context, source string) {
	c.Set("jwt_source", source)
}

// GetJwtSource 从Gin context获取JWT来源标记。
// 返回空字符串表示未设置。
func GetJwtSource(c *gin.Context) string {
	source, exists := c.Get("jwt_source")
	if !exists {
		return ""
	}
	s, ok := source.(string)
	if !ok {
		return ""
	}
	return s
}

// SetJWTCookie 设置JWT认证Cookie（HttpOnly，SameSite=Lax）。
func SetJWTCookie(c *gin.Context, token string, maxAge time.Duration, secure bool) {
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(JWTCookieName, token, int(maxAge.Seconds()), "/", "", secure, true)
}

// SetCSRFCookie 设置CSRF Token Cookie（非HttpOnly，JS可读，SameSite=Lax）。
func SetCSRFCookie(c *gin.Context, token string, maxAge time.Duration, secure bool) {
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(CSRFCookieName, token, int(maxAge.Seconds()), "/", "", secure, false)
}

// ClearJWTCookie 清除JWT认证Cookie。
func ClearJWTCookie(c *gin.Context) {
	c.SetCookie(JWTCookieName, "", -1, "/", "", false, true)
}

// ClearCSRFCookie 清除CSRF Token Cookie。
func ClearCSRFCookie(c *gin.Context) {
	c.SetCookie(CSRFCookieName, "", -1, "/", "", false, false)
}
