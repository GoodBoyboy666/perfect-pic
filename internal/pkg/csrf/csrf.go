package csrf

import (
	"crypto/rand"
	"encoding/hex"
)

// GenerateToken 生成32字节高熵随机CSRF Token（hex编码，64字符）。
func GenerateToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
