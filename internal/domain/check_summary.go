package domain

import (
	"fmt"
	"strings"
	"time"

	"weekly-lotto/internal/domain/utils"
)

// CheckSummary represents the entire confirmation result.
type CheckSummary struct {
	Round          int
	DrawDate       time.Time
	WinningNumbers []int
	BonusNumber    int
	Prizes         map[WinningRank]*PrizeInfo
	Tickets        []TicketResult
}

// NewCheckSummary builds a summary initialized with winning info.
func NewCheckSummary(winning *WinningNumbers) *CheckSummary {
	winningNums := make([]int, len(winning.Numbers))
	copy(winningNums, winning.Numbers)

	return &CheckSummary{
		Round:          winning.Round,
		DrawDate:       winning.DrawDate,
		WinningNumbers: winningNums,
		BonusNumber:    winning.BonusNumber,
		Prizes:         clonePrizeMap(winning.Prizes),
		Tickets:        []TicketResult{},
	}
}

func clonePrizeMap(src map[WinningRank]*PrizeInfo) map[WinningRank]*PrizeInfo {
	if len(src) == 0 {
		return nil
	}
	cloned := make(map[WinningRank]*PrizeInfo, len(src))
	for rank, info := range src {
		if info == nil {
			continue
		}
		copyInfo := *info
		cloned[rank] = &copyInfo
	}
	return cloned
}

// AddTicket appends a ticket result to the summary.
func (s *CheckSummary) AddTicket(result TicketResult) {
	s.Tickets = append(s.Tickets, result.Clone())
}

// HasWinner returns true if any ticket hit at least Rank5.
func (s *CheckSummary) HasWinner() bool {
	for _, ticket := range s.Tickets {
		if ticket.Rank != RankNone {
			return true
		}
	}
	return false
}

// ToString renders the summary for logging.
func (s *CheckSummary) ToString() string {
	var builder strings.Builder
	builder.WriteString(fmt.Sprintf("\n📋 [%d회] 당첨 확인 결과:\n", s.Round))
	for _, ticket := range s.Tickets {
		builder.WriteString(ticket.ToString())
		builder.WriteString("\n")
	}
	return builder.String()
}

// EmailBody renders the summary as an email-friendly string.
func (s *CheckSummary) EmailBody() string {
	var builder strings.Builder
	builder.WriteString(fmt.Sprintf("🎰 %d회 (%s 추첨)\n", s.Round, s.DrawDate.Format("2006-01-02")))
	builder.WriteString(fmt.Sprintf("당첨 번호: %s + %d\n\n", utils.FormatNumbers(s.WinningNumbers), s.BonusNumber))

	for _, ticket := range s.Tickets {
		status := "낙첨"
		prize := ""
		if ticket.Rank != RankNone {
			status = ticket.Rank.String()
			prize = fmt.Sprintf(" (당첨금 %s원)", utils.FormatAmount(ticket.Prize))
		}

		builder.WriteString(
			fmt.Sprintf(
				"- 슬롯 %s (%s / %s): %s%s\n",
				ticket.Slot,
				ticket.Mode,
				utils.FormatNumbers(ticket.Numbers),
				status,
				prize,
			),
		)
	}

	return builder.String()
}
