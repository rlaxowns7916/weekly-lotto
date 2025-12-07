package parser

import (
	"fmt"
	"io"
	"strconv"
	"strings"

	"github.com/PuerkitoBio/goquery"
)

// ParseCurrentRound extracts the current lottery round number from HTML.
// Returns the NEXT round number (current + 1).
func ParseCurrentRound(r io.Reader) (int, error) {
	doc, err := goquery.NewDocumentFromReader(wrapEucKRReader(r))
	if err != nil {
		return 0, fmt.Errorf("HTML 파싱 실패: %w", err)
	}

	// <strong id="lottoDrwNo"> 요소에서 현재 회차 추출
	elem := doc.Find("strong#lottoDrwNo")
	if elem.Length() == 0 {
		return 0, fmt.Errorf("현재 회차 정보를 가져올 수 없습니다")
	}

	roundText := strings.TrimSpace(elem.Text())
	currentRound, err := strconv.Atoi(roundText)
	if err != nil {
		return 0, fmt.Errorf("회차 번호 파싱 실패: %w", err)
	}

	// 다음 회차 반환
	return currentRound + 1, nil
}
