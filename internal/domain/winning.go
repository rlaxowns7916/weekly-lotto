package domain

import (
	"fmt"
	"time"
	"weekly-lotto/internal/domain/utils"
)

// WinningNumbers represents lottery winning numbers for a specific round.
type WinningNumbers struct {
	Round       int                        // 회차
	DrawDate    time.Time                  // 추첨일
	Numbers     []int                      // 당첨번호 6개 (정렬됨)
	BonusNumber int                        // 보너스 번호
	Prizes      map[WinningRank]*PrizeInfo // 등수별 당첨 정보
}

// PrizeInfo represents prize information for each rank.
type PrizeInfo struct {
	Rank            WinningRank // 등수
	TotalAmount     int64       // 총 당첨금액 (원)
	WinnerCount     int         // 당첨자 수
	AmountPerWinner int64       // 1인당 당첨금액 (원)
}

func (p *PrizeInfo) ToString() string {
	return fmt.Sprintf("   %s: 총 %s원 (%d명, 1인당 %s원)",
		p.Rank.String(),
		utils.FormatAmount(p.TotalAmount),
		p.WinnerCount,
		utils.FormatAmount(p.AmountPerWinner))
}

// WinningRank represents the prize rank.
type WinningRank int

const (
	RankNone WinningRank = iota // 낙첨
	Rank5                       // 5등 (3개 일치)
	Rank4                       // 4등 (4개 일치)
	Rank3                       // 3등 (5개 일치)
	Rank2                       // 2등 (5개 일치 + 보너스)
	Rank1                       // 1등 (6개 일치)
)

// String returns Korean rank name.
func (r WinningRank) String() string {
	switch r {
	case Rank1:
		return "1등"
	case Rank2:
		return "2등"
	case Rank3:
		return "3등"
	case Rank4:
		return "4등"
	case Rank5:
		return "5등"
	default:
		return "낙첨"
	}
}

// CheckWinning compares purchased numbers with winning numbers.
func CheckWinning(purchased []int, winning *WinningNumbers) WinningRank {
	matchCount := countMatches(purchased, winning.Numbers)
	bonusMatch := contains(purchased, winning.BonusNumber)

	switch matchCount {
	case 6:
		return Rank1
	case 5:
		if bonusMatch {
			return Rank2
		}
		return Rank3
	case 4:
		return Rank4
	case 3:
		return Rank5
	default:
		return RankNone
	}
}

// countMatches counts how many numbers match.
func countMatches(purchased, winning []int) int {
	count := 0
	for _, p := range purchased {
		if contains(winning, p) {
			count++
		}
	}
	return count
}

// contains checks if slice contains the number.
func contains(slice []int, num int) bool {
	for _, n := range slice {
		if n == num {
			return true
		}
	}
	return false
}
