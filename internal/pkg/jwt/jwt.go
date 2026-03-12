package jwt

import (
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type JWT struct {
	config *Config
}

// LoginClaims 用于登录认证（单管理员模式）
type LoginClaims struct {
	ID       uint   `json:"id"`
	Username string `json:"username"`
	Admin    bool   `json:"admin"`
	Type     string `json:"type"` // "login"
	jwt.RegisteredClaims
}

// EmailClaims 用于邮箱验证
type EmailClaims struct {
	ID    uint   `json:"id"`
	Email string `json:"email"`
	Type  string `json:"type"` // "email_verify"
	jwt.RegisteredClaims
}

type Config struct {
	JWTSecret []byte
	Duration  time.Duration
}

func NewJWT(config *Config) *JWT {
	return &JWT{config: config}
}

func (s *JWT) GenerateLoginToken(id uint, username string, admin bool) (string, error) {
	claims := LoginClaims{
		ID:       id,
		Username: username,
		Admin:    admin,
		Type:     "login",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(s.config.Duration)),
			Issuer:    "perfect-pic-server",
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(s.config.JWTSecret)
}

func (s *JWT) GenerateEmailToken(id uint, email string) (string, error) {
	claims := EmailClaims{
		ID:    id,
		Email: email,
		Type:  "email_verify",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(s.config.Duration)),
			Issuer:    "perfect-pic-server",
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(s.config.JWTSecret)
}

func (s *JWT) ParseLoginToken(tokenString string) (*LoginClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &LoginClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return s.config.JWTSecret, nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(*LoginClaims); ok && token.Valid {
		if claims.Type != "login" {
			return nil, errors.New("invalid token type")
		}
		return claims, nil
	}

	return nil, errors.New("invalid token")
}

func (s *JWT) ParseEmailToken(tokenString string) (*EmailClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &EmailClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return s.config.JWTSecret, nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(*EmailClaims); ok && token.Valid {
		if claims.Type != "email_verify" {
			return nil, errors.New("invalid token type")
		}
		return claims, nil
	}

	return nil, errors.New("invalid token")
}
