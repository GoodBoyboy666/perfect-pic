package middleware

import (
	"errors"
	"net/http"
	"perfect-pic-server/internal/common/httpx"
	"perfect-pic-server/internal/pkg/jwt"
	"perfect-pic-server/internal/service"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type AuthMiddleware struct {
	jwt         *jwt.JWT
	userService *service.UserService
}

func (m *AuthMiddleware) JWTAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		if m.jwt == nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "认证组件未初始化"})
			c.Abort()
			return
		}

		var tokenString string
		var jwtSource string

		// 优先从Cookie读取JWT
		if cookieToken, err := c.Cookie(httpx.JWTCookieName); err == nil && cookieToken != "" {
			tokenString = cookieToken
			jwtSource = httpx.JwtSourceCookie
		} else {
			// 回退到Authorization Header（API客户端模式）
			authHeader := c.GetHeader("Authorization")
			if authHeader == "" {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "需要认证才能访问"})
				c.Abort()
				return
			}

			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) != 2 || parts[0] != "Bearer" {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "Token 格式错误"})
				c.Abort()
				return
			}
			tokenString = parts[1]
			jwtSource = httpx.JwtSourceHeader
		}

		//解析 Token
		claims, err := m.jwt.ParseLoginToken(tokenString)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Token 无效或已过期"})
			c.Abort()
			return
		}

		httpx.SetJwtSource(c, jwtSource)
		c.Set("id", claims.ID)
		c.Set("username", claims.Username)
		c.Next()
	}
}

// UserStatusCheck 检查用户状态是否被封禁
//
//nolint:gocyclo
func (m *AuthMiddleware) UserStatusCheck() gin.HandlerFunc {
	return func(c *gin.Context) {
		if m.userService == nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "用户服务未初始化"})
			c.Abort()
			return
		}

		userID, exists := c.Get("id")
		if !exists {
			// 如果没有上下文中的 id，说明 JWT 中间件可能未执行或失败但未 Abort（理论上不可能），或者顺序不对
			c.JSON(http.StatusUnauthorized, gin.H{"error": "未获取到用户信息"})
			c.Abort()
			return
		}

		uid, ok := userID.(uint)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "无效的用户ID类型"})
			c.Abort()
			return
		}

		currentStatus, err := m.userService.GetUserStatus(uid)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "用户不存在"})
			c.Abort()
			return
		}

		if currentStatus == 2 {
			c.JSON(http.StatusForbidden, gin.H{"error": "账号已被封禁"})
			c.Abort()
			return
		}
		if currentStatus == 3 {
			c.JSON(http.StatusForbidden, gin.H{"error": "账号已停用"})
			c.Abort()
			return
		}

		c.Next()
	}
}

func (m *AuthMiddleware) AdminCheck() gin.HandlerFunc {
	return func(c *gin.Context) {
		if m.userService == nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "用户服务未初始化"})
			c.Abort()
			return
		}

		userID, exists := c.Get("id")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "未获取到用户信息"})
			c.Abort()
			return
		}
		uid, ok := userID.(uint)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "无效的用户ID类型"})
			c.Abort()
			return
		}

		isAdmin, err := m.userService.GetUserAdmin(uid)
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "用户不存在"})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "管理员鉴权失败"})
			}
			c.Abort()
			return
		}
		if !isAdmin {
			c.JSON(http.StatusForbidden, gin.H{"error": "需要管理员权限才能访问"})
			c.Abort()
			return
		}

		c.Next()
	}
}
