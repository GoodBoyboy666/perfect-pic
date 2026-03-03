package email

import (
	"crypto/tls"
	"fmt"
	"log"
	"net/smtp"
)

type SMTPConfig struct {
	Host     string
	Port     int
	Username string
	Password string
	SSL      bool
}

func (m *Mailer) SendWithSMTP(config SMTPConfig, email Email) error {
	auth := smtp.PlainAuth("", config.Username, config.Password, config.Host)
	addr := fmt.Sprintf("%s:%d", config.Host, config.Port)
	msg, err := buildEmailMessage(email.From, email.To, email.Subject, email.Body)
	if err != nil {
		return err
	}
	if !config.SSL {
		err := smtp.SendMail(addr, auth, email.From, email.To, msg)
		if err != nil {
			return err
		}
		return nil
	}

	tlsConfig := &tls.Config{
		InsecureSkipVerify: false,
		ServerName:         config.Host,
	}

	// 增加超时控制
	conn, err := tls.Dial("tcp", addr, tlsConfig)
	if err != nil {
		log.Printf("[Email] TLS 连接失败: %v", err)
		return err
	}
	defer func() { _ = conn.Close() }()

	client, err := smtp.NewClient(conn, config.Host)
	if err != nil {
		log.Printf("[Email] 创建 SMTP 客户端失败: %v", err)
		return err
	}
	defer func() { _ = client.Close() }()

	if auth != nil {
		if ok, _ := client.Extension("AUTH"); ok {
			if err = client.Auth(auth); err != nil {
				log.Printf("[Email] SMTP认证失败: %v", err)
				return err
			}
		}
	}
	// 发送流程
	if err = client.Mail(email.From); err != nil {
		log.Printf("[Email] MAIL FROM 命令失败: %v", err)
		return err
	}
	for _, addr := range email.To {
		if err = client.Rcpt(addr); err != nil {
			log.Printf("[Email] RCPT TO 命令失败: %v", err)
			return err
		}
	}
	w, err := client.Data()
	if err != nil {
		log.Printf("[Email] DATA 命令失败: %v", err)
		return err
	}
	_, err = w.Write(msg)
	if err != nil {
		log.Printf("[Email] 写入邮件内容失败: %v", err)
		return err
	}
	err = w.Close()
	if err != nil {
		log.Printf("[Email] 关闭 DATA 失败: %v", err)
		return err
	}

	return client.Quit()
}
