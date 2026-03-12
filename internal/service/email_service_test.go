package service

import (
	"strings"
	"testing"

	"perfect-pic-server/internal/config"
	"perfect-pic-server/internal/consts"
	"perfect-pic-server/internal/model"
)

// 测试内容：验证邮件模板渲染能正确替换变量。
func TestRenderTemplate(t *testing.T) {
	out, err := renderTemplate("hi {{.Name}}", map[string]string{"Name": "alice"})
	if err != nil {
		t.Fatalf("renderTemplate: %v", err)
	}
	if out != "hi alice" {
		t.Fatalf("非预期输出: %q", out)
	}
}

// 测试内容：验证邮箱地址头格式化与非法地址校验。
func TestFormatAddressHeader(t *testing.T) {
	header, addr, err := formatAddressHeader("Alice <alice@example.com>")
	if err != nil {
		t.Fatalf("formatAddressHeader: %v", err)
	}
	if addr != "alice@example.com" {
		t.Fatalf("非预期地址: %q", addr)
	}
	if !strings.Contains(header, "<alice@example.com>") {
		t.Fatalf("非预期头部: %q", header)
	}
	if strings.ContainsAny(header, "\r\n") {
		t.Fatalf("头部包含 CRLF: %q", header)
	}

	header2, addr2, err := formatAddressHeader("bob@example.com")
	if err != nil {
		t.Fatalf("formatAddressHeader: %v", err)
	}
	if header2 != "bob@example.com" || addr2 != "bob@example.com" {
		t.Fatalf("非预期 header/addr: %q %q", header2, addr2)
	}

	_, _, err = formatAddressHeader("not-an-email")
	if err == nil {
		t.Fatalf("期望无效地址返回错误")
	}
}

// 测试内容：验证 SMTP 未开启时发送测试邮件返回错误。
func TestSendTestEmail_SMTPDisabledError(t *testing.T) {
	setupTestDB(t)

	// 默认设置 enable_smtp=false，应返回错误。
	err := testService.SendTestEmail("a@example.com")
	if err == nil {
		t.Fatalf("期望返回错误")
	}
	if !strings.Contains(err.Error(), "请先开启SMTP功能") {
		t.Fatalf("期望包含未开启提示，实际为 %v", err)
	}
}

// 测试内容：验证 SMTP 禁用时发送验证邮件返回错误。
func TestSendVerificationEmail_SMTPDisabledError(t *testing.T) {
	setupTestDB(t)

	err := testService.SendVerificationEmail("a@example.com", "alice", "http://example/verify")
	if err == nil {
		t.Fatalf("期望返回错误")
	}
	if !strings.Contains(err.Error(), "请先开启SMTP功能") {
		t.Fatalf("期望包含未开启提示，实际为 %v", err)
	}
}

// 测试内容：验证 SMTP 禁用时发送邮箱变更验证返回错误。
func TestSendEmailChangeVerification_SMTPDisabledError(t *testing.T) {
	setupTestDB(t)

	err := testService.SendEmailChangeVerification("a@example.com", "alice", "old@example.com", "new@example.com", "http://example/verify")
	if err == nil {
		t.Fatalf("期望返回错误")
	}
	if !strings.Contains(err.Error(), "请先开启SMTP功能") {
		t.Fatalf("期望包含未开启提示，实际为 %v", err)
	}
}

// 测试内容：验证 SMTP 禁用时发送密码重置邮件返回错误。
func TestSendPasswordResetEmail_SMTPDisabledError(t *testing.T) {
	setupTestDB(t)

	err := testService.SendPasswordResetEmail("a@example.com", "alice", "http://example/reset")
	if err == nil {
		t.Fatalf("期望返回错误")
	}
	if !strings.Contains(err.Error(), "请先开启SMTP功能") {
		t.Fatalf("期望包含未开启提示，实际为 %v", err)
	}
}

// 测试内容：验证启用 SMTP 且主机不可达时各发送函数会快速失败。
func TestEmailSendFunctions_AttemptSendAndFailFast(t *testing.T) {
	setupTestDB(t)

	// 在设置中启用 SMTP。
	_ = testGormDB.Save(&model.Setting{Key: consts.ConfigEnableSMTP, Value: "true"}).Error
	testService.ClearCache()

	// 重新初始化配置，使用不可达的 SMTP host/port 以便 SendMail 快速失败。
	cfgDir := t.TempDir()
	t.Setenv("PERFECT_PIC_SERVER_MODE", "debug")
	t.Setenv("PERFECT_PIC_JWT_SECRET", "test_secret")
	t.Setenv("PERFECT_PIC_SMTP_HOST", "127.0.0.1")
	t.Setenv("PERFECT_PIC_SMTP_PORT", "1")
	t.Setenv("PERFECT_PIC_SMTP_FROM", "Perfect Pic <from@example.com>")
	config.InitConfig(cfgDir)

	if err := testService.SendVerificationEmail("to@example.com", "alice", "http://example/verify"); err == nil {
		t.Fatalf("期望发送失败")
	}
	if err := testService.SendEmailChangeVerification("to@example.com", "alice", "old@example.com", "new@example.com", "http://example/verify"); err == nil {
		t.Fatalf("期望发送失败")
	}
	if err := testService.SendPasswordResetEmail("to@example.com", "alice", "http://example/reset"); err == nil {
		t.Fatalf("期望发送失败")
	}
	if err := testService.SendTestEmail("to@example.com"); err == nil {
		t.Fatalf("期望发送失败")
	}
}
