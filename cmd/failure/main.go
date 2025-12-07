package main

import (
	"log"
	"os"
	"weekly-lotto/internal/config"
	"weekly-lotto/internal/notify"
)

func main() {
	if len(os.Args) < 3 {
		log.Fatalf("사용법: %s <작업명> <에러메시지>", os.Args[0])
	}

	operation := os.Args[1]
	errorMsg := os.Args[2]

	// Load configuration from environment variables
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("❌ 설정 로드 실패: %v", err)
	}

	emailSender := notify.NewEmailSender(&cfg.Email)

	// Send failure notification email
	if err := emailSender.SendFailureNotification(operation, errorMsg); err != nil {
		log.Fatalf("❌ 실패 알림 이메일 전송 실패: %v", err)
	}

	log.Printf("✉️  [%s] 실패 알림 이메일 전송 완료", operation)
}
