package domain

import (
	"fmt"
	"weekly-lotto/internal/domain/utils"
)

// TicketResult holds the outcome for a single slot.
type TicketResult struct {
	Slot    string
	Mode    string
	Numbers []int
	Rank    WinningRank
	Prize   int64
}

// NewTicketResult creates a ticket result while copying numbers to avoid aliasing.
func NewTicketResult(slot, mode string, numbers []int, rank WinningRank, prize int64) TicketResult {
	clone := make([]int, len(numbers))
	copy(clone, numbers)

	return TicketResult{
		Slot:    slot,
		Mode:    mode,
		Numbers: clone,
		Rank:    rank,
		Prize:   prize,
	}
}

// Clone duplicates the TicketResult, including the numbers slice.
func (t TicketResult) Clone() TicketResult {
	return NewTicketResult(t.Slot, t.Mode, t.Numbers, t.Rank, t.Prize)
}

// ToString returns a formatted description of the ticket result.
func (t TicketResult) ToString() string {
	if t.Rank != RankNone {
		return fmt.Sprintf(
			"   슬롯 %s (%s / %s): %s 🎉 (당첨금: %s원)",
			t.Slot,
			t.Mode,
			utils.FormatNumbers(t.Numbers),
			t.Rank.String(),
			utils.FormatAmount(t.Prize),
		)
	}

	return fmt.Sprintf(
		"   슬롯 %s (%s / %s): 낙첨",
		t.Slot,
		t.Mode,
		utils.FormatNumbers(t.Numbers),
	)
}
