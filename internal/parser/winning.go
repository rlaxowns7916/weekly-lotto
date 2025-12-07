package parser

import (
	"fmt"
	"io"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/PuerkitoBio/goquery"
	"weekly-lotto/internal/domain"
)

// ParseWinningNumbers extracts winning numbers from lottery result page.
func ParseWinningNumbers(r io.Reader) (*domain.WinningNumbers, error) {
	doc, err := goquery.NewDocumentFromReader(wrapEucKRReader(r))
	if err != nil {
		return nil, fmt.Errorf("HTML 파싱 실패: %w", err)
	}

	winResult := doc.Find("div.win_result")
	if winResult.Length() == 0 {
		return nil, fmt.Errorf("당첨 결과를 찾을 수 없습니다")
	}

	// 1. 회차 파싱: "<strong>1201회</strong>" → 1201
	roundText := winResult.Find("h4 strong").Text()
	roundText = strings.TrimSpace(strings.Replace(roundText, "회", "", -1))
	round, err := strconv.Atoi(roundText)
	if err != nil {
		return nil, fmt.Errorf("회차 파싱 실패: %w", err)
	}

	// 2. 추첨일 파싱: "(2025년 12월 06일 추첨)" → time.Time
	dateText := winResult.Find("p.desc").Text()
	drawDate, err := parseDrawDate(dateText)
	if err != nil {
		return nil, fmt.Errorf("추첨일 파싱 실패: %w", err)
	}

	// 3. 당첨번호 파싱: 6개
	var numbers []int
	winResult.Find("div.num.win p span.ball_645").Each(func(i int, s *goquery.Selection) {
		numText := strings.TrimSpace(s.Text())
		if num, err := strconv.Atoi(numText); err == nil {
			numbers = append(numbers, num)
		}
	})

	if len(numbers) != 6 {
		return nil, fmt.Errorf("당첨번호가 6개가 아닙니다 (파싱된 개수: %d)", len(numbers))
	}

	// 4. 보너스 번호 파싱: 1개
	bonusText := winResult.Find("div.num.bonus p span.ball_645").Text()
	bonusText = strings.TrimSpace(bonusText)
	bonusNumber, err := strconv.Atoi(bonusText)
	if err != nil {
		return nil, fmt.Errorf("보너스 번호 파싱 실패: %w", err)
	}

	// 5. 당첨금액 정보 파싱
	prizes, err := parsePrizeInfo(doc)
	if err != nil {
		return nil, fmt.Errorf("당첨금액 파싱 실패: %w", err)
	}

	return &domain.WinningNumbers{
		Round:       round,
		DrawDate:    drawDate,
		Numbers:     numbers,
		BonusNumber: bonusNumber,
		Prizes:      prizes,
	}, nil
}

// parseDrawDate parses date string like "(2025년 12월 06일 추첨)"
func parseDrawDate(s string) (time.Time, error) {
	// 정규식으로 "2025년 12월 06일" 추출
	re := regexp.MustCompile(`(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일`)
	matches := re.FindStringSubmatch(s)
	if len(matches) != 4 {
		return time.Time{}, fmt.Errorf("날짜 형식이 올바르지 않습니다: %s", s)
	}

	year, _ := strconv.Atoi(matches[1])
	month, _ := strconv.Atoi(matches[2])
	day, _ := strconv.Atoi(matches[3])

	// Asia/Seoul timezone
	loc, _ := time.LoadLocation("Asia/Seoul")
	return time.Date(year, time.Month(month), day, 0, 0, 0, 0, loc), nil
}

// parsePrizeInfo extracts prize information for each rank from the table.
// HTML structure:
// <tbody>
//
//	<tr>
//	  <td>1등</td>
//	  <td class="tar"><strong>26,876,558,642원</strong></td>
//	  <td>19</td>
//	  <td class="tar">1,414,555,718원</td>
//	  ...
//	</tr>
//
// </tbody>
func parsePrizeInfo(doc *goquery.Document) (map[domain.WinningRank]*domain.PrizeInfo, error) {
	prizes := make(map[domain.WinningRank]*domain.PrizeInfo)

	// 당첨 정보 테이블 찾기
	doc.Find("table tbody tr").Each(func(i int, tr *goquery.Selection) {
		tds := tr.Find("td")
		if tds.Length() < 4 {
			return
		}

		// 등수 파싱 (1등, 2등, ...)
		rankText := strings.TrimSpace(tds.Eq(0).Text())
		rank := parseRankText(rankText)
		if rank == domain.RankNone {
			return
		}

		// 총 당첨금액 파싱
		totalAmountText := tds.Eq(1).Find("strong").Text()
		totalAmount := parseAmount(totalAmountText)

		// 당첨자 수 파싱
		winnerCountText := strings.TrimSpace(tds.Eq(2).Text())
		winnerCountText = strings.ReplaceAll(winnerCountText, ",", "")
		winnerCount, _ := strconv.Atoi(winnerCountText)

		// 1인당 당첨금액 파싱
		amountPerWinnerText := strings.TrimSpace(tds.Eq(3).Text())
		amountPerWinner := parseAmount(amountPerWinnerText)

		prizes[rank] = &domain.PrizeInfo{
			Rank:            rank,
			TotalAmount:     totalAmount,
			WinnerCount:     winnerCount,
			AmountPerWinner: amountPerWinner,
		}
	})

	return prizes, nil
}

// parseRankText converts rank text to WinningRank enum.
// Example: "1등" → Rank1, "2등" → Rank2
func parseRankText(s string) domain.WinningRank {
	s = strings.TrimSpace(s)
	switch s {
	case "1등":
		return domain.Rank1
	case "2등":
		return domain.Rank2
	case "3등":
		return domain.Rank3
	case "4등":
		return domain.Rank4
	case "5등":
		return domain.Rank5
	default:
		return domain.RankNone
	}
}

// parseAmount parses Korean currency string to int64.
// Example: "26,876,558,642원" → 26876558642
func parseAmount(s string) int64 {
	// Remove spaces, commas, and "원"
	s = strings.TrimSpace(s)
	s = strings.ReplaceAll(s, ",", "")
	s = strings.ReplaceAll(s, "원", "")

	amount, err := strconv.ParseInt(s, 10, 64)
	if err != nil {
		return 0
	}
	return amount
}
