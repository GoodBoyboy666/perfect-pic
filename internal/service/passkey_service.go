package service

import (
	"errors"
	"strconv"

	commonpkg "perfect-pic-server/internal/common"
	"perfect-pic-server/internal/consts"
	moduledto "perfect-pic-server/internal/dto"
	"perfect-pic-server/internal/model"

	"github.com/go-webauthn/webauthn/protocol"
	"github.com/go-webauthn/webauthn/webauthn"
	"gorm.io/gorm"
)

// ListUserPasskeys 返回指定用户已绑定的 Passkey 列表。
func (s *PasskeyService) ListUserPasskeys(userID uint) ([]moduledto.UserPasskeyResponse, error) {
	records, err := s.passkeyStore.ListPasskeyCredentialsByUserID(userID)
	if err != nil {
		return nil, commonpkg.NewInternalError("读取 Passkey 列表失败")
	}

	items := make([]moduledto.UserPasskeyResponse, 0, len(records))
	for _, record := range records {
		items = append(items, moduledto.UserPasskeyResponse{
			ID:           record.ID,
			CredentialID: record.CredentialID,
			Name:         record.Name,
			CreatedAt:    record.CreatedAt.Unix(),
		})
	}

	return items, nil
}

// DeleteUserPasskey 删除指定用户名下的某个 Passkey。
func (s *PasskeyService) DeleteUserPasskey(userID uint, passkeyID uint) error {
	if passkeyID == 0 {
		return commonpkg.NewValidationError("无效的 Passkey ID")
	}

	if err := s.passkeyStore.DeletePasskeyCredentialByID(userID, passkeyID); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return commonpkg.NewNotFoundError("Passkey 不存在")
		}
		return commonpkg.NewInternalError("删除 Passkey 失败")
	}
	return nil
}

// UpdateUserPasskeyName 更新指定用户名下某个 Passkey 的显示名称。
func (s *PasskeyService) UpdateUserPasskeyName(userID uint, passkeyID uint, name string) error {
	if passkeyID == 0 {
		return commonpkg.NewValidationError("无效的 Passkey ID")
	}

	normalizedName, err := normalizePasskeyName(name)
	if err != nil {
		return err
	}

	if err := s.passkeyStore.UpdatePasskeyCredentialNameByID(userID, passkeyID, normalizedName); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return commonpkg.NewNotFoundError("Passkey 不存在")
		}
		return commonpkg.NewInternalError("更新 Passkey 名称失败")
	}
	return nil
}

type passkeyWebAuthnUserLoadMode string

const (
	passkeyWebAuthnUserLoadModeRegistration passkeyWebAuthnUserLoadMode = "registration"
	passkeyWebAuthnUserLoadModeLogin        passkeyWebAuthnUserLoadMode = "login"
)

type passkeyWebAuthnUser struct {
	userID      uint
	username    string
	id          []byte
	credentials []webauthn.Credential
}

func (u *passkeyWebAuthnUser) WebAuthnID() []byte {
	return u.id
}

func (u *passkeyWebAuthnUser) WebAuthnName() string {
	return u.username
}

func (u *passkeyWebAuthnUser) WebAuthnDisplayName() string {
	return u.username
}

func (u *passkeyWebAuthnUser) WebAuthnCredentials() []webauthn.Credential {
	return u.credentials
}

// BeginPasskeyRegistration 为当前用户创建 Passkey 注册挑战并返回会话 ID。
func (s *PasskeyService) BeginPasskeyRegistration(userID uint) (string, *protocol.CredentialCreation, error) {
	if err := s.ensureUserPasskeyCapacity(userID); err != nil {
		return "", nil, err
	}

	webauthnClient, err := s.CreatePasskeyWebAuthnClient()
	if err != nil {
		return "", nil, err
	}

	passkeyUser, err := s.loadPasskeyWebAuthnUser(userID, passkeyWebAuthnUserLoadModeRegistration)
	if err != nil {
		return "", nil, err
	}

	creation, sessionData, err := webauthnClient.BeginRegistration(
		passkeyUser,
		webauthn.WithCredentialParameters(s.GetPasskeyRecommendedCredentialParameters()),
		webauthn.WithResidentKeyRequirement(protocol.ResidentKeyRequirementRequired),
		webauthn.WithExclusions(webauthn.Credentials(passkeyUser.credentials).CredentialDescriptors()),
		webauthn.WithExtensions(protocol.AuthenticationExtensions{"credProps": true}),
	)
	if err != nil {
		return "", nil, commonpkg.NewInternalError("创建 Passkey 注册挑战失败")
	}

	sessionID, err := s.StorePasskeySession(consts.PasskeySessionRegistration, userID, sessionData)
	if err != nil {
		return "", nil, commonpkg.NewInternalError("创建 Passkey 注册会话失败")
	}

	return sessionID, creation, nil
}

// FinishPasskeyRegistration 校验并完成 Passkey 注册，随后持久化凭据。
func (s *PasskeyService) FinishPasskeyRegistration(userID uint, sessionID string, credentialJSON []byte) error {
	sessionData, err := s.ConsumePasskeyRegistrationSession(sessionID, userID)
	if err != nil {
		return err
	}

	webauthnClient, err := s.CreatePasskeyWebAuthnClient()
	if err != nil {
		return err
	}

	passkeyUser, err := s.loadPasskeyWebAuthnUser(userID, passkeyWebAuthnUserLoadModeRegistration)
	if err != nil {
		return err
	}

	request, err := s.BuildPasskeyCredentialRequest(credentialJSON)
	if err != nil {
		return err
	}

	credential, err := webauthnClient.FinishRegistration(passkeyUser, *sessionData, request)
	if err != nil {
		return commonpkg.NewValidationError("Passkey 注册校验失败，请重试")
	}

	credentialAlgorithm, err := s.ExtractPasskeyCredentialAlgorithm(credential)
	if err != nil || !s.IsPasskeyAlgorithmAllowed(int64(credentialAlgorithm)) {
		return commonpkg.NewValidationError("Passkey 签名算法不被允许")
	}

	credentialID := s.EncodePasskeyCredentialID(credential.ID)
	existing, findErr := s.passkeyStore.FindPasskeyCredentialByCredentialID(credentialID)
	if findErr == nil {
		if existing.UserID == userID {
			return commonpkg.NewConflictError("该 Passkey 已绑定")
		}
		return commonpkg.NewConflictError("该 Passkey 已被其他账号绑定")
	}
	if !errors.Is(findErr, gorm.ErrRecordNotFound) {
		return commonpkg.NewInternalError("保存 Passkey 失败")
	}

	if err := s.ensureUserPasskeyCapacity(userID); err != nil {
		return err
	}

	serialized, err := s.MarshalPasskeyCredential(credential)
	if err != nil {
		return commonpkg.NewInternalError("保存 Passkey 失败")
	}

	if err := s.passkeyStore.CreatePasskeyCredential(&model.PasskeyCredential{
		UserID:       userID,
		CredentialID: credentialID,
		Name:         s.BuildDefaultPasskeyName(credentialID),
		Credential:   serialized,
	}); err != nil {
		if s.IsPasskeyUniqueConstraintConflict(err) {
			return commonpkg.NewConflictError("该 Passkey 已绑定")
		}
		return commonpkg.NewInternalError("保存 Passkey 失败")
	}

	return nil
}

// BeginPasskeyLogin 创建无用户名（discoverable）的 Passkey 登录挑战。
func (s *PasskeyService) BeginPasskeyLogin() (string, *protocol.CredentialAssertion, error) {
	webauthnClient, err := s.CreatePasskeyWebAuthnClient()
	if err != nil {
		return "", nil, err
	}

	assertion, sessionData, err := webauthnClient.BeginDiscoverableLogin(
		webauthn.WithUserVerification(protocol.VerificationPreferred),
	)
	if err != nil {
		return "", nil, commonpkg.NewInternalError("创建 Passkey 登录挑战失败")
	}

	sessionID, err := s.StorePasskeySession(consts.PasskeySessionLogin, 0, sessionData)
	if err != nil {
		return "", nil, commonpkg.NewInternalError("创建 Passkey 登录会话失败")
	}

	return sessionID, assertion, nil
}

// FinishPasskeyLogin 完成 Passkey 登录校验并签发 JWT。
//
//nolint:gocyclo
func (s *PasskeyService) FinishPasskeyLogin(sessionID string, credentialJSON []byte) (string, error) {
	sessionData, err := s.ConsumePasskeyLoginSession(sessionID)
	if err != nil {
		return "", err
	}

	webauthnClient, err := s.CreatePasskeyWebAuthnClient()
	if err != nil {
		return "", err
	}

	request, err := s.BuildPasskeyCredentialRequest(credentialJSON)
	if err != nil {
		return "", err
	}

	var resolvedUser *passkeyWebAuthnUser
	validatedUser, validatedCredential, err := webauthnClient.FinishPasskeyLogin(
		func(rawID, userHandle []byte) (webauthn.User, error) {
			userID, parseErr := s.ParsePasskeyUserHandle(userHandle)
			if parseErr != nil {
				return nil, parseErr
			}

			passkeyUser, loadErr := s.loadPasskeyWebAuthnUser(userID, passkeyWebAuthnUserLoadModeLogin)
			if loadErr != nil {
				return nil, loadErr
			}
			resolvedUser = passkeyUser
			_ = rawID
			return passkeyUser, nil
		},
		*sessionData,
		request,
	)
	if err != nil {
		return "", commonpkg.NewUnauthorizedError("Passkey 登录失败")
	}

	passkeyUser, ok := validatedUser.(*passkeyWebAuthnUser)
	if !ok {
		if resolvedUser == nil {
			return "", commonpkg.NewInternalError("Passkey 登录失败")
		}
		passkeyUser = resolvedUser
	}

	credentialAlgorithm, err := s.ExtractPasskeyCredentialAlgorithm(validatedCredential)
	if err != nil || !s.IsPasskeyAlgorithmAllowed(int64(credentialAlgorithm)) {
		return "", commonpkg.NewUnauthorizedError("Passkey 签名算法不被允许")
	}

	serialized, err := s.MarshalPasskeyCredential(validatedCredential)
	if err != nil {
		return "", commonpkg.NewInternalError("Passkey 登录失败")
	}

	if err := s.passkeyStore.UpdatePasskeyCredentialData(
		passkeyUser.userID,
		s.EncodePasskeyCredentialID(validatedCredential.ID),
		serialized,
	); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return "", commonpkg.NewUnauthorizedError("Passkey 登录失败")
		}
		return "", commonpkg.NewInternalError("Passkey 登录失败")
	}

	user, err := s.userStore.FindByID(passkeyUser.userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return "", commonpkg.NewUnauthorizedError("Passkey 登录失败")
		}
		return "", commonpkg.NewInternalError("Passkey 登录失败")
	}

	token, err := s.jwt.GenerateLoginToken(user.ID, user.Username, user.Admin)
	if err != nil {
		return "", commonpkg.NewInternalError("Passkey 登录失败")
	}
	return token, nil
}

func (s *PasskeyService) ensureUserPasskeyCapacity(userID uint) error {
	count, err := s.passkeyStore.CountPasskeyCredentialsByUserID(userID)
	if err != nil {
		return commonpkg.NewInternalError("校验 Passkey 数量失败")
	}
	if count >= consts.MaxUserPasskeyCount {
		return commonpkg.NewConflictError("Passkey 数量已达上限（最多 10 个）")
	}
	return nil
}

func (s *PasskeyService) loadPasskeyWebAuthnUser(
	userID uint,
	loadMode passkeyWebAuthnUserLoadMode,
) (*passkeyWebAuthnUser, error) {
	resolvedUserID := userID
	username := ""

	switch loadMode {
	case passkeyWebAuthnUserLoadModeRegistration:
		user, err := s.userStore.FindByID(userID)
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil, commonpkg.NewNotFoundError("用户不存在")
			}
			return nil, commonpkg.NewInternalError("读取用户信息失败")
		}
		resolvedUserID = user.ID
		username = user.Username
	case passkeyWebAuthnUserLoadModeLogin:
	default:
		return nil, commonpkg.NewInternalError("Passkey 用户加载模式无效")
	}

	credentials, err := s.LoadUserPasskeyCredentials(resolvedUserID)
	if err != nil {
		return nil, err
	}

	return &passkeyWebAuthnUser{
		userID:      resolvedUserID,
		username:    username,
		id:          []byte(strconv.FormatUint(uint64(resolvedUserID), 10)),
		credentials: credentials,
	}, nil
}
