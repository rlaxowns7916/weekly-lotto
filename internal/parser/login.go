package parser

import (
	"fmt"
	"io"

	"github.com/PuerkitoBio/goquery"
)

// ParseLoginResult checks if login was successful.
// Returns error if login failed (i.e., HTML contains <a class="btn_common">).
func ParseLoginResult(r io.Reader) error {
	doc, err := goquery.NewDocumentFromReader(wrapEucKRReader(r))
	if err != nil {
		return fmt.Errorf("HTML 파싱 실패: %w", err)
	}

	// 로그인 실패 시 "btn_common" 클래스의 <a> 태그가 존재
	if doc.Find("a.btn_common").Length() > 0 {
		return fmt.Errorf("로그인에 실패했습니다. 아이디 또는 비밀번호를 확인해주세요")
	}

	return nil
}
