package email

import (
	"crypto/tls"
	"fmt"
	"log"
	"net"
	"net/smtp"
	"time"
)

type SMTPConfig struct {
	Host     string
	Port     int
	Username string
	Password string
	SSL      bool
}

const (
	smtpConnectTimeout = 5 * time.Second
	smtpIOTimeout      = 10 * time.Second
)

func (m *Mailer) SendWithSMTP(config SMTPConfig, email Email) error {
	auth := smtp.PlainAuth("", config.Username, config.Password, config.Host)
	addr := fmt.Sprintf("%s:%d", config.Host, config.Port)
	msg, err := buildEmailMessage(email.From, email.To, email.Subject, email.Body)
	if err != nil {
		return err
	}
	conn, err := dialSMTPConnection(addr, config.Host, config.SSL)
	if err != nil {
		return err
	}
	defer func() { _ = conn.Close() }()

	return sendSMTPCommandFlow(conn, config.Host, auth, email, msg)
}

func dialSMTPConnection(addr, host string, useSSL bool) (net.Conn, error) {
	dialer := &net.Dialer{
		Timeout: smtpConnectTimeout,
	}
	if !useSSL {
		conn, err := dialer.Dial("tcp", addr)
		if err != nil {
			log.Printf("[Email] SMTP 连接失败: %v", err)
			return nil, err
		}
		return conn, nil
	}

	tlsConfig := &tls.Config{
		InsecureSkipVerify: false,
		ServerName:         host,
	}
	conn, err := tls.DialWithDialer(dialer, "tcp", addr, tlsConfig)
	if err != nil {
		log.Printf("[Email] TLS 连接失败: %v", err)
		return nil, err
	}
	return conn, nil
}

//nolint:gocyclo
func sendSMTPCommandFlow(conn net.Conn, host string, auth smtp.Auth, email Email, msg []byte) error {
	setDeadline := func() error {
		if err := conn.SetDeadline(time.Now().Add(smtpIOTimeout)); err != nil {
			log.Printf("[Email] 设置连接超时失败: %v", err)
			return err
		}
		return nil
	}
	var err error

	if err = setDeadline(); err != nil {
		return err
	}
	client, err := smtp.NewClient(conn, host)
	if err != nil {
		log.Printf("[Email] 创建 SMTP 客户端失败: %v", err)
		return err
	}
	defer func() { _ = client.Close() }()

	if auth != nil {
		if ok, _ := client.Extension("AUTH"); ok {
			if err = setDeadline(); err != nil {
				return err
			}
			if err = client.Auth(auth); err != nil {
				log.Printf("[Email] SMTP认证失败: %v", err)
				return err
			}
		}
	}
	// 发送流程
	if err = setDeadline(); err != nil {
		return err
	}
	if err = client.Mail(email.From); err != nil {
		log.Printf("[Email] MAIL FROM 命令失败: %v", err)
		return err
	}
	for _, addr := range email.To {
		if err = setDeadline(); err != nil {
			return err
		}
		if err = client.Rcpt(addr); err != nil {
			log.Printf("[Email] RCPT TO 命令失败: %v", err)
			return err
		}
	}
	if err = setDeadline(); err != nil {
		return err
	}
	w, err := client.Data()
	if err != nil {
		log.Printf("[Email] DATA 命令失败: %v", err)
		return err
	}
	if err = setDeadline(); err != nil {
		return err
	}
	_, err = w.Write(msg)
	if err != nil {
		log.Printf("[Email] 写入邮件内容失败: %v", err)
		return err
	}
	if err = setDeadline(); err != nil {
		return err
	}
	err = w.Close()
	if err != nil {
		log.Printf("[Email] 关闭 DATA 失败: %v", err)
		return err
	}

	if err = setDeadline(); err != nil {
		return err
	}
	return client.Quit()
}
