package middleware

import (
	"net/http"
	"perfect-pic-server/internal/common/httpx"

	"github.com/gin-gonic/gin"
)

type CSRFMiddleware struct{}

// CSRFCheck 对Cookie来源的JWT强制执行CSRF双提交验证。
// GET/HEAD/OPTIONS请求自动跳过。
func (m *CSRFMiddleware) CSRFCheck() gin.HandlerFunc {
	return func(c *gin.Context) {
		source := httpx.GetJwtSource(c)
		if source != httpx.JwtSourceCookie {
			c.Next()
			return
		}

		if c.Request.Method == http.MethodGet ||
			c.Request.Method == http.MethodHead ||
			c.Request.Method == http.MethodOptions {
			c.Next()
			return
		}

		cookieToken, _ := c.Cookie(httpx.CSRFCookieName)
		headerToken := c.GetHeader(httpx.CSRFHeaderName)

		if cookieToken == "" || headerToken == "" || cookieToken != headerToken {
			c.JSON(http.StatusForbidden, gin.H{"error": "CSRF token 验证失败"})
			c.Abort()
			return
		}

		c.Next()
	}
}
