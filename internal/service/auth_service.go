package service

import (
	"errors"
	"fmt"
	commonpkg "perfect-pic-server/internal/common"
	"perfect-pic-server/internal/common/httpx"
	"perfect-pic-server/internal/consts"
	moduledto "perfect-pic-server/internal/dto"
	"perfect-pic-server/internal/model"
	"perfect-pic-server/internal/pkg/validator"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
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
	token, err := s.jwt.GenerateLoginToken(user.ID, user.Username, user.Admin)
	if err != nil {
		return "", httpx.NewAuthError(httpx.AuthErrorInternal, "登录失败，请稍后重试")
	}

	return token, nil
}

// LoginUser 执行登录鉴权并返回登录令牌。
func (s *AuthService) LoginUser(username, password string) (string, error) {
	user, err := s.userStore.FindByUsername(username)
	if err != nil {
		return "", httpx.NewAuthError(httpx.AuthErrorUnauthorized, "用户名或密码错误")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(password)); err != nil {
		return "", httpx.NewAuthError(httpx.AuthErrorUnauthorized, "用户名或密码错误")
	}

	return s.IssueLoginToken(user)
}

// RegisterUser 执行用户注册并异步发送邮箱验证邮件。
//
//nolint:gocyclo
func (s *AuthService) RegisterUser(username, password, email string) error {
	if !s.initService.IsSystemInitialized() {
		return httpx.NewAuthError(httpx.AuthErrorForbidden, "系统尚未初始化，请先完成初始化")
	}

	if !s.dbConfig.GetBool(consts.ConfigAllowRegister) {
		return httpx.NewAuthError(httpx.AuthErrorForbidden, "注册功能已关闭")
	}

	enableEmail := s.emailService.EmailEnabled()
	sendRegEmail := s.emailService.ShouldSendRegistrationVerificationEmail()

	if !enableEmail && sendRegEmail {
		return httpx.NewAuthError(httpx.AuthErrorInternal, "系统未开启邮件服务，无法发送验证邮件，请联系管理员")
	}

	newEmail := email
	newUser, err := s.userService.CreateUser(moduledto.CreateUserRequest{
		Username: username,
		Password: password,
		Email:    &newEmail,
	}, false)
	if err != nil {
		return toRegisterAuthError(err)
	}

	if sendRegEmail {
		verifyToken, err := s.userService.GenerateEmailVerificationToken(newUser.ID, newUser.Email)
		if err != nil {
			return httpx.NewAuthError(httpx.AuthErrorInternal, "注册失败，请稍后重试")
		}

		baseURL := s.dbConfig.GetString(consts.ConfigBaseURL)
		if baseURL == "" {
			baseURL = "http://localhost"
		}
		if len(baseURL) > 0 && baseURL[len(baseURL)-1] == '/' {
			baseURL = baseURL[:len(baseURL)-1]
		}

		verifyURL := fmt.Sprintf("%s/auth/email-verify?token=%s", baseURL, verifyToken)

		go func() {
			_ = s.emailService.SendVerificationEmail(newUser.Email, newUser.Username, verifyURL)
		}()
	}

	return nil
}

func toRegisterAuthError(err error) error {
	serviceErr, ok := commonpkg.AsServiceError(err)
	if !ok {
		return httpx.NewAuthError(httpx.AuthErrorInternal, "注册失败，请稍后重试")
	}

	switch serviceErr.Code {
	case commonpkg.ErrorCodeValidation:
		return httpx.NewAuthError(httpx.AuthErrorValidation, serviceErr.Message)
	case commonpkg.ErrorCodeConflict:
		return httpx.NewAuthError(httpx.AuthErrorConflict, serviceErr.Message)
	default:
		return httpx.NewAuthError(httpx.AuthErrorInternal, "注册失败，请稍后重试")
	}
}

// VerifyEmail 验证邮箱激活令牌。
// 返回值第一个参数为 true 表示该邮箱已是验证状态。
func (s *AuthService) VerifyEmail(token string) (bool, error) {
	userID, tokenEmail, ok := s.userService.VerifyEmailVerificationToken(token)
	if !ok {
		return false, httpx.NewAuthError(httpx.AuthErrorValidation, "验证链接已失效或不正确")
	}

	user, err := s.userStore.FindByID(userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return false, httpx.NewAuthError(httpx.AuthErrorNotFound, "用户不存在")
		}
		return false, httpx.NewAuthError(httpx.AuthErrorInternal, "验证失败，请稍后重试")
	}

	if user.Email != tokenEmail {
		return false, httpx.NewAuthError(httpx.AuthErrorValidation, "邮箱不匹配，请重新发起验证")
	}

	if user.EmailVerified {
		return true, nil
	}

	user.EmailVerified = true
	if err := s.userService.SaveUser(user); err != nil {
		return false, httpx.NewAuthError(httpx.AuthErrorInternal, "验证失败，请稍后重试")
	}

	return false, nil
}

// VerifyEmailChange 验证邮箱变更令牌并更新邮箱。
func (s *AuthService) VerifyEmailChange(token string) error {
	payload, ok := s.userService.VerifyEmailChangeToken(token)
	if !ok {
		return httpx.NewAuthError(httpx.AuthErrorValidation, "验证链接已失效或不正确")
	}

	user, err := s.userStore.FindByID(payload.UserID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return httpx.NewAuthError(httpx.AuthErrorNotFound, "用户不存在")
		}
		return httpx.NewAuthError(httpx.AuthErrorInternal, "邮箱修改失败，请稍后重试")
	}

	if user.Email != payload.OldEmail {
		return httpx.NewAuthError(httpx.AuthErrorValidation, "您的当前邮箱已变更，该验证链接已失效")
	}

	excludeID := payload.UserID
	emailTaken, err := s.userService.IsEmailTaken(payload.NewEmail, &excludeID, true)
	if err != nil {
		return httpx.NewAuthError(httpx.AuthErrorInternal, "邮箱修改失败，请稍后重试")
	}
	if emailTaken {
		return httpx.NewAuthError(httpx.AuthErrorConflict, "新邮箱已被其他用户占用，无法修改")
	}

	user.Email = payload.NewEmail
	user.EmailVerified = true
	if err := s.userService.SaveUser(user); err != nil {
		return httpx.NewAuthError(httpx.AuthErrorInternal, "邮箱修改失败，请稍后重试")
	}

	return nil
}

// RequestPasswordReset 发起忘记密码流程并异步发送重置邮件。
func (s *AuthService) RequestPasswordReset(email string) error {
	if !s.emailService.EmailEnabled() {
		return httpx.NewAuthError(httpx.AuthErrorInternal, "系统未配置邮件服务，无法重置密码")
	}
	user, err := s.userStore.FindByEmail(email)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil
		}
		return httpx.NewAuthError(httpx.AuthErrorInternal, "生成重置链接失败，请稍后重试")
	}

	if user.Status == 2 || user.Status == 3 {
		return httpx.NewAuthError(httpx.AuthErrorForbidden, "该账号已被封禁或停用，无法重置密码")
	}

	token, err := s.userService.GenerateForgetPasswordToken(user.ID)
	if err != nil {
		return httpx.NewAuthError(httpx.AuthErrorInternal, "生成重置链接失败，请稍后重试")
	}

	baseURL := s.dbConfig.GetString(consts.ConfigBaseURL)
	if baseURL == "" {
		baseURL = "http://localhost"
	}
	if len(baseURL) > 0 && baseURL[len(baseURL)-1] == '/' {
		baseURL = baseURL[:len(baseURL)-1]
	}
	resetURL := fmt.Sprintf("%s/auth/reset-password?token=%s", baseURL, token)

	go func() {
		_ = s.emailService.SendPasswordResetEmail(user.Email, user.Username, resetURL)
	}()

	return nil
}

// ResetPassword 使用重置令牌设置新密码。
func (s *AuthService) ResetPassword(token, newPassword string) error {
	if ok, msg := validator.ValidatePassword(newPassword); !ok {
		return httpx.NewAuthError(httpx.AuthErrorValidation, msg)
	}

	userID, valid := s.userService.VerifyForgetPasswordToken(token)
	if !valid {
		return httpx.NewAuthError(httpx.AuthErrorValidation, "重置链接无效或已过期")
	}

	user, err := s.userStore.FindByID(userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return httpx.NewAuthError(httpx.AuthErrorNotFound, "用户不存在")
		}
		return httpx.NewAuthError(httpx.AuthErrorInternal, "密码重置失败")
	}

	if user.Status == 2 || user.Status == 3 {
		return httpx.NewAuthError(httpx.AuthErrorForbidden, "该账号已被封禁或停用")
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return httpx.NewAuthError(httpx.AuthErrorInternal, "密码加密失败")
	}

	user.Password = string(hashedPassword)
	user.EmailVerified = true

	if err := s.userService.SaveUser(user); err != nil {
		return httpx.NewAuthError(httpx.AuthErrorInternal, "密码重置失败")
	}

	return nil
}
