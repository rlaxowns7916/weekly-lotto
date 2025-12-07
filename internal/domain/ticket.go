package domain

// Lotto645Mode represents the ticket purchase mode.
type Lotto645Mode int

const (
	ModeAuto     Lotto645Mode = iota // 자동 (0개)
	ModeSemiAuto                     // 반자동 (1~5개)
	ModeManual                       // 수동 (6개)
)

// String returns Korean mode name.
func (m Lotto645Mode) String() string {
	switch m {
	case ModeAuto:
		return "자동"
	case ModeSemiAuto:
		return "반자동"
	case ModeManual:
		return "수동"
	default:
		return "알 수 없음"
	}
}

// Lotto645Ticket represents a single lottery ticket.
type Lotto645Ticket struct {
	Numbers []int
	Mode    Lotto645Mode
}

// NewAutoTicket creates a fully automatic ticket (no numbers selected).
func NewAutoTicket() *Lotto645Ticket {
	return &Lotto645Ticket{
		Numbers: []int{},
		Mode:    ModeAuto,
	}
}

// NewAutoTickets creates multiple automatic tickets.
func NewAutoTickets(count int) []*Lotto645Ticket {
	tickets := make([]*Lotto645Ticket, count)
	for i := 0; i < count; i++ {
		tickets[i] = NewAutoTicket()
	}
	return tickets
}
