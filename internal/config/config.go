package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
)

// Config bundles every configuration segment the application needs.
type Config struct {
	Credential CredentialConfig
	Email      EmailConfig
}

// CredentialConfig keeps login credentials for the lottery site.
type CredentialConfig struct {
	Username string
	Password string
}

// EmailConfig holds SMTP configuration for notifications.
type EmailConfig struct {
	From     string
	To       []string
	SMTPHost string
	SMTPPort int
	Username string
	Password string
}

// Load reads every configuration section from environment variables.
func Load() (*Config, error) {
	credential, err := loadCredential()
	if err != nil {
		return nil, err
	}

	email, err := loadEmail()
	if err != nil {
		return nil, err
	}

	return &Config{
		Credential: *credential,
		Email:      *email,
	}, nil
}

func loadCredential() (*CredentialConfig, error) {
	username := os.Getenv("LOTTO_USERNAME")
	password := os.Getenv("LOTTO_PASSWORD")

	if username == "" {
		return nil, fmt.Errorf("LOTTO_USERNAME 환경 변수가 설정되지 않았습니다")
	}

	if password == "" {
		return nil, fmt.Errorf("LOTTO_PASSWORD 환경 변수가 설정되지 않았습니다")
	}

	return &CredentialConfig{
		Username: username,
		Password: password,
	}, nil
}

func loadEmail() (*EmailConfig, error) {
	from := os.Getenv("LOTTO_EMAIL_FROM")
	toList := strings.Split(os.Getenv("LOTTO_EMAIL_TO"), ",")
	host := os.Getenv("LOTTO_EMAIL_SMTP_HOST")
	portStr := os.Getenv("LOTTO_EMAIL_SMTP_PORT")
	username := os.Getenv("LOTTO_EMAIL_USERNAME")
	password := os.Getenv("LOTTO_EMAIL_PASSWORD")

	recipients := make([]string, 0, len(toList))
	for _, to := range toList {
		to = strings.TrimSpace(to)
		if to != "" {
			recipients = append(recipients, to)
		}
	}

	if from == "" || len(recipients) == 0 || host == "" || portStr == "" || username == "" || password == "" {
		return nil, fmt.Errorf("이메일 환경 변수가 누락되었습니다")
	}

	port, err := strconv.Atoi(portStr)
	if err != nil {
		return nil, fmt.Errorf("LOTTO_EMAIL_SMTP_PORT 파싱 실패: %w", err)
	}

	return &EmailConfig{
		From:     from,
		To:       recipients,
		SMTPHost: host,
		SMTPPort: port,
		Username: username,
		Password: password,
	}, nil
}
