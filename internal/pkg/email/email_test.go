package email

import (
	"strings"
	"testing"
)

func TestNewMailer_NotNil(t *testing.T) {
	if m := NewMailer(); m == nil {
		t.Fatalf("expected non-nil mailer")
	}
}

func TestBuildEmailMessage_ContainsHeadersAndBody(t *testing.T) {
	msg, err := buildEmailMessage(
		"from@example.com",
		[]string{"a@example.com", "b@example.com"},
		"测试主题",
		"<p>hello</p>",
	)
	if err != nil {
		t.Fatalf("buildEmailMessage error: %v", err)
	}

	raw := string(msg)
	mustContain := []string{
		"Date: ",
		"From: from@example.com",
		"To: a@example.com, b@example.com",
		"Subject: =?UTF-8?",
		"MIME-Version: 1.0",
		"Content-Type: text/html; charset=UTF-8",
		"<p>hello</p>",
	}
	for _, part := range mustContain {
		if !strings.Contains(raw, part) {
			t.Fatalf("message missing part %q, raw=%s", part, raw)
		}
	}
}

func TestSendWithSMTP_NonSSLUnavailableReturnsError(t *testing.T) {
	m := NewMailer()
	err := m.SendWithSMTP(
		SMTPConfig{
			Host:     "127.0.0.1",
			Port:     1,
			Username: "u",
			Password: "p",
			SSL:      false,
		},
		Email{
			From:    "from@example.com",
			To:      []string{"to@example.com"},
			Subject: "s",
			Body:    "b",
		},
	)
	if err == nil {
		t.Fatalf("expected error when smtp server unavailable")
	}
}

func TestSendWithSMTP_SSLUnavailableReturnsError(t *testing.T) {
	m := NewMailer()
	err := m.SendWithSMTP(
		SMTPConfig{
			Host:     "127.0.0.1",
			Port:     1,
			Username: "u",
			Password: "p",
			SSL:      true,
		},
		Email{
			From:    "from@example.com",
			To:      []string{"to@example.com"},
			Subject: "s",
			Body:    "b",
		},
	)
	if err == nil {
		t.Fatalf("expected error when smtp tls server unavailable")
	}
}
