package service

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	commonpkg "perfect-pic-server/internal/common"
	"perfect-pic-server/internal/consts"
	moduledto "perfect-pic-server/internal/dto"
	"perfect-pic-server/internal/model"
	"perfect-pic-server/internal/pkg/validator"
	"strconv"
	"time"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

const userStatusCacheTTL = 1 * time.Minute
const userAdminCacheTTL = 1 * time.Minute

func (s *UserService) userStatusCacheKey(userID uint) string {
	return s.cache.RedisKey("auth", "user_status", strconv.FormatUint(uint64(userID), 10))
}

func (s *UserService) userAdminCacheKey(userID uint) string {
	return s.cache.RedisKey("auth", "user_admin", strconv.FormatUint(uint64(userID), 10))
}

// GenerateForgetPasswordToken 生成忘记密码 Token，有效期 15 分钟
func (s *UserService) GenerateForgetPasswordToken(userID uint) (string, error) {
	// 使用 crypto/rand 生成 32 字节的高熵随机字符串 (64字符Hex)
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	token := hex.EncodeToString(b)

	ttl := 15 * time.Minute
	tokenKey := s.cache.RedisKey("password_reset", "token", token)
	userKey := s.cache.RedisKey("password_reset", "user", strconv.FormatUint(uint64(userID), 10))
	uidStr := strconv.FormatUint(uint64(userID), 10)
	s.cache.SetIndexed(userKey, tokenKey, uidStr, ttl)
	return token, nil
}

// VerifyForgetPasswordToken 验证忘记密码 Token
func (s *UserService) VerifyForgetPasswordToken(token string) (uint, bool) {
	tokenKey := s.cache.RedisKey("password_reset", "token", token)
	uidStr, ok := s.cache.Get(tokenKey)
	if !ok {
		return 0, false
	}
	uid, parseErr := strconv.ParseUint(uidStr, 10, 64)
	if parseErr != nil || uid > math.MaxUint {
		s.cache.Delete(tokenKey)
		return 0, false
	}
	userKey := s.cache.RedisKey("password_reset", "user", strconv.FormatUint(uid, 10))
	if !s.cache.CompareAndDeletePair(userKey, tokenKey, tokenKey, uidStr) {
		s.cache.Delete(tokenKey)
		return 0, false
	}
	return uint(uid), true
}

// GenerateEmailVerificationToken 生成邮箱验证 Token，有效期 30 分钟。
func (s *UserService) GenerateEmailVerificationToken(userID uint, email string) (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	token := hex.EncodeToString(b)

	ttl := 30 * time.Minute
	payload, err := json.Marshal(moduledto.EmailVerifyRedisPayload{
		UserID: userID,
		Email:  email,
	})
	if err != nil {
		return "", err
	}

	tokenKey := s.cache.RedisKey("email_verify", "token", token)
	userKey := s.cache.RedisKey("email_verify", "user", strconv.FormatUint(uint64(userID), 10))
	s.cache.SetIndexed(userKey, tokenKey, string(payload), ttl)
	return token, nil
}

// VerifyEmailVerificationToken 验证并消费邮箱验证 Token。
func (s *UserService) VerifyEmailVerificationToken(token string) (uint, string, bool) {
	if token == "" {
		return 0, "", false
	}

	tokenKey := s.cache.RedisKey("email_verify", "token", token)
	raw, ok := s.cache.Get(tokenKey)
	if !ok {
		return 0, "", false
	}

	var payload moduledto.EmailVerifyRedisPayload
	if err := json.Unmarshal([]byte(raw), &payload); err != nil || payload.UserID == 0 || payload.Email == "" {
		s.cache.Delete(tokenKey)
		return 0, "", false
	}

	userKey := s.cache.RedisKey("email_verify", "user", strconv.FormatUint(uint64(payload.UserID), 10))
	if !s.cache.CompareAndDeletePair(userKey, tokenKey, tokenKey, raw) {
		s.cache.Delete(tokenKey)
		return 0, "", false
	}

	return payload.UserID, payload.Email, true
}

// GenerateEmailChangeToken 生成修改邮箱 Token，有效期 30 分钟。
func (s *UserService) GenerateEmailChangeToken(userID uint, oldEmail, newEmail string) (string, error) {
	// 使用 crypto/rand 生成 32 字节的高熵随机字符串 (64字符Hex)
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	token := hex.EncodeToString(b)

	ttl := 30 * time.Minute
	payload, err := json.Marshal(moduledto.EmailChangeRedisPayload{
		UserID:   userID,
		OldEmail: oldEmail,
		NewEmail: newEmail,
	})
	if err != nil {
		return "", err
	}
	tokenKey := s.cache.RedisKey("email_change", "token", token)
	userKey := s.cache.RedisKey("email_change", "user", strconv.FormatUint(uint64(userID), 10))
	s.cache.SetIndexed(userKey, tokenKey, string(payload), ttl)
	return token, nil
}

// VerifyEmailChangeToken 验证并消费修改邮箱 Token。
//
//nolint:gocyclo
func (s *UserService) VerifyEmailChangeToken(token string) (*moduledto.EmailChangeToken, bool) {
	if token == "" {
		return nil, false
	}

	tokenKey := s.cache.RedisKey("email_change", "token", token)
	raw, ok := s.cache.Get(tokenKey)
	if !ok {
		return nil, false
	}

	var payload moduledto.EmailChangeRedisPayload
	if err := json.Unmarshal([]byte(raw), &payload); err != nil || payload.UserID == 0 {
		s.cache.Delete(tokenKey)
		return nil, false
	}

	userKey := s.cache.RedisKey("email_change", "user", strconv.FormatUint(uint64(payload.UserID), 10))
	if !s.cache.CompareAndDeletePair(userKey, tokenKey, tokenKey, raw) {
		s.cache.Delete(tokenKey)
		return nil, false
	}
	return &moduledto.EmailChangeToken{
		UserID:   payload.UserID,
		Token:    token,
		OldEmail: payload.OldEmail,
		NewEmail: payload.NewEmail,
	}, true
}

// GetUserStatus 获取用户状态，优先从缓存读取，未命中时回源数据库并回写缓存。
func (s *UserService) GetUserStatus(userID uint) (int, error) {
	statusKey := ""
	if s.cache != nil {
		statusKey = s.userStatusCacheKey(userID)
		if cachedStatus, ok := s.cache.Get(statusKey); ok {
			if parsedStatus, err := strconv.Atoi(cachedStatus); err == nil {
				return parsedStatus, nil
			}
			s.cache.Delete(statusKey)
		}
	}

	user, err := s.userStore.FindByID(userID)
	if err != nil {
		return 0, err
	}

	if s.cache != nil {
		s.cache.Set(statusKey, strconv.Itoa(user.Status), userStatusCacheTTL)
	}

	return user.Status, nil
}

// GetUserAdmin 获取用户管理员标记，优先从缓存读取，未命中时回源数据库并回写缓存。
func (s *UserService) GetUserAdmin(userID uint) (bool, error) {
	adminKey := ""
	if s.cache != nil {
		adminKey = s.userAdminCacheKey(userID)
		if cachedAdmin, ok := s.cache.Get(adminKey); ok {
			if cachedAdmin == "1" {
				return true, nil
			}
			if cachedAdmin == "0" {
				return false, nil
			}
			s.cache.Delete(adminKey)
		}
	}

	user, err := s.userStore.FindByID(userID)
	if err != nil {
		return false, err
	}

	if s.cache != nil {
		if user.Admin {
			s.cache.Set(adminKey, "1", userAdminCacheTTL)
		} else {
			s.cache.Set(adminKey, "0", userAdminCacheTTL)
		}
	}

	return user.Admin, nil
}

// ClearUserAuthCache 清除指定用户的管理员权限缓存。
func (s *UserService) ClearUserAuthCache(userID uint) {
	if s.cache == nil {
		return
	}
	s.cache.Delete(s.userAdminCacheKey(userID))
}

// ClearUserStatusCache 清除指定用户的状态缓存。
func (s *UserService) ClearUserStatusCache(userID uint) {
	if s.cache == nil {
		return
	}
	s.cache.Delete(s.userStatusCacheKey(userID))
}

// GetSystemDefaultStorageQuota 获取系统默认存储配额
func (s *UserService) GetSystemDefaultStorageQuota() int64 {
	return s.dbConfig.GetDefaultStorageQuota()
}

// IsUsernameTaken 检查用户名是否已被占用。
// excludeUserID 用于更新场景下排除当前用户；includeDeleted 为 true 时会包含软删除用户。
func (s *UserService) IsUsernameTaken(username string, excludeUserID *uint, includeDeleted bool) (bool, error) {
	return s.userStore.FieldExists(consts.UserFieldUsername, username, excludeUserID, includeDeleted)
}

// IsEmailTaken 检查邮箱是否已被占用。
// excludeUserID 用于更新场景下排除当前用户；includeDeleted 为 true 时会包含软删除用户。
func (s *UserService) IsEmailTaken(email string, excludeUserID *uint, includeDeleted bool) (bool, error) {
	return s.userStore.FieldExists(consts.UserFieldEmail, email, excludeUserID, includeDeleted)
}

// GetUserByID 按用户 ID 获取用户模型。
func (s *UserService) GetUserByID(userID uint, includeDeleted bool) (*model.User, error) {
	var (
		user *model.User
		err  error
	)

	if includeDeleted {
		user, err = s.userStore.FindUnscopedByID(userID)
	} else {
		user, err = s.userStore.FindByID(userID)
	}

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, commonpkg.NewNotFoundError("用户不存在")
		}
		return nil, commonpkg.NewInternalError("获取用户信息失败")
	}
	return user, nil
}

// GetUserProfile 获取用户个人资料。
func (s *UserService) GetUserProfile(userID uint) (*moduledto.UserProfileResponse, error) {
	user, err := s.GetUserByID(userID, false)
	if err != nil {
		return nil, commonpkg.NewNotFoundError("用户不存在")
	}

	return &moduledto.UserProfileResponse{
		ID:           user.ID,
		Username:     user.Username,
		Email:        user.Email,
		Avatar:       user.Avatar,
		Admin:        user.Admin,
		StorageQuota: user.StorageQuota,
		StorageUsed:  user.StorageUsed,
	}, nil
}

// UpdatePasswordByOldPassword 使用旧密码校验后更新新密码。
func (s *UserService) UpdatePasswordByOldPassword(userID uint, oldPassword, newPassword string) error {
	if ok, msg := validator.ValidatePassword(newPassword); !ok {
		return commonpkg.NewValidationError(msg)
	}

	user, err := s.userStore.FindByID(userID)
	if err != nil {
		return commonpkg.NewNotFoundError("用户不存在")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(oldPassword)); err != nil {
		return commonpkg.NewValidationError("旧密码错误")
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return commonpkg.NewInternalError("更新失败")
	}

	if err := s.userStore.UpdatePasswordByID(userID, string(hashedPassword)); err != nil {
		return commonpkg.NewInternalError("更新失败")
	}

	s.ClearUserAuthCache(userID)
	s.ClearUserStatusCache(userID)
	return nil
}

// ListUsers 按分页与筛选条件查询用户列表。
func (s *UserService) ListUsers(params moduledto.UserListRequest) ([]model.User, int64, error) {
	page, pageSize := normalizeAdminPagination(params.Page, params.PageSize)
	sortOrder := resolveAdminUserSortOrder(params.Order)
	users, total, err := s.userStore.ListUsers(
		params.Keyword,
		params.ShowDeleted,
		sortOrder,
		(page-1)*pageSize,
		pageSize,
	)
	if err != nil {
		return nil, 0, commonpkg.NewInternalError("获取用户列表失败")
	}
	return users, total, nil
}

// UpdateUser 校验并更新指定用户。
func (s *UserService) UpdateUser(userID uint, req moduledto.UpdateUserRequest, allowReservedUsername bool) error {
	updates := make(map[string]interface{})

	if err := s.prepareUsernameUpdate(userID, req.Username, allowReservedUsername, updates); err != nil {
		return err
	}
	if err := s.preparePasswordUpdate(req.Password, updates); err != nil {
		return err
	}
	if err := s.prepareEmailUpdate(userID, req.Email, updates); err != nil {
		return err
	}
	s.prepareEmailVerifiedUpdate(req.EmailVerified, updates)
	if err := s.prepareStorageQuotaUpdate(req.StorageQuota, updates); err != nil {
		return err
	}
	if err := s.prepareStatusUpdate(req.Status, updates); err != nil {
		return err
	}

	if len(updates) == 0 {
		return nil
	}
	if err := s.userStore.UpdateByID(userID, updates); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return commonpkg.NewNotFoundError("用户不存在")
		}
		return commonpkg.NewInternalError("更新用户失败")
	}
	s.ClearUserAuthCache(userID)
	s.ClearUserStatusCache(userID)
	return nil
}

// CreateUser 按统一流程创建用户，allowReservedUsername 控制是否允许保留用户名。
func (s *UserService) CreateUser(input moduledto.CreateUserRequest, allowReservedUsername bool) (*model.User, error) {
	if err := s.validateCreateUserInput(input, allowReservedUsername); err != nil {
		return nil, err
	}

	hashedPassword, err := hashPassword(input.Password)
	if err != nil {
		return nil, commonpkg.NewInternalError("创建用户失败")
	}

	user := model.User{
		Username: input.Username,
		Password: hashedPassword,
		Admin:    false,
		Status:   1,
	}

	if err := s.applyCreateUserOptionals(&user, input); err != nil {
		return nil, err
	}

	if err := s.userStore.Create(&user); err != nil {
		return nil, commonpkg.NewInternalError("创建用户失败")
	}

	return &user, nil
}

// RequestEmailChange 发起邮箱修改流程并异步发送验证邮件。
func (s *UserService) RequestEmailChange(userID uint, password, newEmail string) error {
	if !s.emailService.EmailEnabled() {
		return commonpkg.NewInternalError("系统未开启邮件服务，无法修改邮箱")
	}
	if ok, msg := validator.ValidateEmail(newEmail); !ok {
		return commonpkg.NewValidationError(msg)
	}

	user, err := s.userStore.FindByID(userID)
	if err != nil {
		return commonpkg.NewInternalError("用户不存在")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(password)); err != nil {
		return commonpkg.NewForbiddenError("密码错误")
	}

	if user.Email == newEmail {
		return commonpkg.NewValidationError("新邮箱不能与当前邮箱相同")
	}

	emailTaken, err := s.IsEmailTaken(newEmail, nil, true)
	if err != nil {
		return commonpkg.NewInternalError("检查邮箱占用失败")
	}
	if emailTaken {
		return commonpkg.NewConflictError("该邮箱已被使用")
	}

	token, err := s.GenerateEmailChangeToken(user.ID, user.Email, newEmail)
	if err != nil {
		return commonpkg.NewInternalError("生成验证链接失败")
	}

	baseURL := s.dbConfig.GetString(consts.ConfigBaseURL)
	if baseURL == "" {
		baseURL = "http://localhost"
	}
	if len(baseURL) > 0 && baseURL[len(baseURL)-1] == '/' {
		baseURL = baseURL[:len(baseURL)-1]
	}
	verifyURL := fmt.Sprintf("%s/auth/email-change-verify?token=%s", baseURL, token)

	go func() {
		_ = s.emailService.SendEmailChangeVerification(newEmail, user.Username, user.Email, newEmail, verifyURL)
	}()

	return nil
}

// UpdateUsernameAndGenerateToken 修改用户名并签发新登录令牌。
func (s *UserService) UpdateUsernameAndGenerateToken(userID uint, username string) (string, error) {
	if err := s.UpdateUser(userID, moduledto.UpdateUserRequest{Username: &username}, false); err != nil {
		return "", err
	}
	user, err := s.userStore.FindByID(userID)
	if err != nil {
		return "", commonpkg.NewInternalError("更新失败")
	}
	return s.jwt.GenerateLoginToken(user.ID, user.Username, user.Admin)
}

// UpdateUserAdmin 管理员更新用户信息，允许使用保留用户名。
func (s *UserService) UpdateUserAdmin(userID uint, req moduledto.UpdateUserRequest) error {
	return s.UpdateUser(userID, req, true)
}

// AdminDeleteUser 删除用户。
// hardDelete=true 时执行彻底删除；否则执行软删除并清理唯一字段占用。
func (s *UserService) AdminDeleteUser(userID uint, hardDelete bool) error {
	if hardDelete {
		if err := s.imageService.DeleteUserFiles(userID); err != nil {
			return commonpkg.NewInternalError("删除用户失败")
		}
		if err := s.passkeyService.DeletePasskeyCredentialsByUserID(userID); err != nil {
			return commonpkg.NewInternalError("删除用户失败")
		}
		if err := s.HardDeleteUserWithImages(userID); err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return commonpkg.NewNotFoundError("用户不存在")
			}
			return commonpkg.NewInternalError("删除用户失败")
		}
		return nil
	}

	if err := s.SoftDeleteUser(userID, time.Now().Unix()); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return commonpkg.NewNotFoundError("用户不存在")
		}
		return commonpkg.NewInternalError("删除用户失败")
	}
	return nil
}
