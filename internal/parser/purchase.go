package parser

import (
	"fmt"
	"io"
	"regexp"
	"strconv"
	"strings"

	"github.com/PuerkitoBio/goquery"
)

var detailPopRegex = regexp.MustCompile(`detailPop\('([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'\)`)

// PurchaseSummary holds identifiers required to fetch purchase details.
type PurchaseSummary struct {
	OrderNo string
	Barcode string
	IssueNo string
}

// PurchaseDetail represents a single slot extracted from the detail page.
type PurchaseDetail struct {
	Slot    string
	Mode    string
	Numbers []int
}

// ParsePurchaseList extracts purchase identifiers from the lotto buy list page.
func ParsePurchaseList(r io.Reader) ([]PurchaseSummary, error) {
	body, err := io.ReadAll(wrapEucKRReader(r))
	if err != nil {
		return nil, fmt.Errorf("구매 내역 HTML 읽기 실패: %w", err)
	}

	matches := detailPopRegex.FindAllStringSubmatch(string(body), -1)
	if len(matches) == 0 {
		return nil, fmt.Errorf("구매 내역 링크를 찾을 수 없습니다")
	}

	seen := make(map[string]struct{})
	summaries := make([]PurchaseSummary, 0, len(matches))
	for _, m := range matches {
		if len(m) < 4 {
			continue
		}
		key := m[1] + m[2] + m[3]
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		summaries = append(summaries, PurchaseSummary{
			OrderNo: m[1],
			Barcode: m[2],
			IssueNo: m[3],
		})
	}

	if len(summaries) == 0 {
		return nil, fmt.Errorf("구매 내역을 찾을 수 없습니다")
	}

	return summaries, nil
}

// ParsePurchaseDetail parses the lotto645 detail page into slot-level selections
// and returns the draw round along with the tickets.
func ParsePurchaseDetail(r io.Reader) (int, []PurchaseDetail, error) {
	doc, err := goquery.NewDocumentFromReader(wrapEucKRReader(r))
	if err != nil {
		return 0, nil, fmt.Errorf("구매 상세 HTML 파싱 실패: %w", err)
	}

	roundText := strings.TrimSpace(doc.Find("h3 strong").First().Text())
	round := parseDigit(roundText)
	if round == 0 {
		return 0, nil, fmt.Errorf("회차 정보를 찾을 수 없습니다")
	}

	details := []PurchaseDetail{}
	doc.Find("div.selected li").Each(func(_ int, sel *goquery.Selection) {
		slot := strings.TrimSpace(sel.Find("strong span").Eq(0).Text())
		modeText := strings.TrimSpace(sel.Find("strong span").Eq(1).Text())
		mode := strings.Join(strings.Fields(modeText), " ")

		numbers := []int{}
		sel.Find("div.nums span").Each(func(_ int, span *goquery.Selection) {
			if span.Children().Length() > 0 {
				return
			}
			text := strings.TrimSpace(span.Text())
			if text == "" {
				return
			}
			if num, err := strconv.Atoi(text); err == nil {
				numbers = append(numbers, num)
			}
		})

		if slot == "" || len(numbers) == 0 {
			return
		}

		details = append(details, PurchaseDetail{
			Slot:    slot,
			Mode:    mode,
			Numbers: numbers,
		})
	})

	if len(details) == 0 {
		return 0, nil, fmt.Errorf("구매 상세 번호를 찾을 수 없습니다")
	}

	return round, details, nil
}
