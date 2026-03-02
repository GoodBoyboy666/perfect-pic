package service

import (
	"perfect-pic-server/internal/common/httpx"
	"perfect-pic-server/internal/config"
	"perfect-pic-server/internal/consts"
	"perfect-pic-server/internal/model"
	"perfect-pic-server/internal/pkg/jwt"

	"time"
)

func (s *AuthService) IssueLoginToken(user *model.User) (string, error) {
	if user.Status == 2 {
		return "", httpx.NewAuthError(httpx.AuthErrorForbidden, "该账号已被封禁")
	}
	if user.Status == 3 {
		return "", httpx.NewAuthError(httpx.AuthErrorForbidden, "该账号已停用")
	}

	if s.dbConfig.GetBool(consts.ConfigBlockUnverifiedUsers) {
		if user.Email != "" && !user.EmailVerified {
			return "", httpx.NewAuthError(httpx.AuthErrorForbidden, "请先验证邮箱后再登录")
		}
	}

	cfg := config.Get()
	token, err := jwt.GenerateLoginToken(user.ID, user.Username, user.Admin, time.Hour*time.Duration(cfg.JWT.ExpirationHours))
	if err != nil {
		return "", httpx.NewAuthError(httpx.AuthErrorInternal, "登录失败，请稍后重试")
	}

	return token, nil
}
