package parser

import (
	"fmt"
	"io"

	"github.com/PuerkitoBio/goquery"
	"weekly-lotto/internal/domain"
)

// ParseBalance extracts deposit balance information from HTML.
func ParseBalance(r io.Reader) (*domain.Balance, error) {
	doc, err := goquery.NewDocumentFromReader(wrapEucKRReader(r))
	if err != nil {
		return nil, fmt.Errorf("HTML 파싱 실패: %w", err)
	}

	// 간편충전 계좌 유무 확인
	hasBankAccount := doc.Find(".tbl_total_account_number_top tbody tr td").Length() > 0

	// div.box.money 요소 선택
	moneyBox := doc.Find("div.box.money").First()
	if moneyBox.Length() == 0 {
		return nil, fmt.Errorf("예치금 정보를 찾을 수 없습니다")
	}

	var balance domain.Balance

	// 총예치금 (동일)
	totalText := moneyBox.Find("p.total_new > strong").First().Text()
	balance.Total = parseDigit(totalText)

	// 간편충전 계좌 유무에 따라 인덱스가 다름
	if hasBankAccount {
		// 계좌 있는 경우: 인덱스 3, 4, 5, 6, 7
		balance.Available = parseDigit(moneyBox.Find("td.ta_right").Eq(3).Text())
		balance.Reserved = parseDigit(moneyBox.Find("td.ta_right").Eq(4).Text())
		balance.WithdrawPending = parseDigit(moneyBox.Find("td.ta_right").Eq(5).Text())
		balance.Unavailable = parseDigit(moneyBox.Find("td.ta_right").Eq(6).Text())
		balance.MonthlyTotal = parseDigit(moneyBox.Find("td.ta_right").Eq(7).Text())
	} else {
		// 계좌 없는 경우: 인덱스 1, 2, 3, 4, 5
		balance.Available = parseDigit(moneyBox.Find("td.ta_right").Eq(1).Text())
		balance.Reserved = parseDigit(moneyBox.Find("td.ta_right").Eq(2).Text())
		balance.WithdrawPending = parseDigit(moneyBox.Find("td.ta_right").Eq(3).Text())
		balance.Unavailable = parseDigit(moneyBox.Find("td.ta_right").Eq(4).Text())
		balance.MonthlyTotal = parseDigit(moneyBox.Find("td.ta_right").Eq(5).Text())
	}

	return &balance, nil
}
