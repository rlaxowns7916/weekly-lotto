package parser

import (
	"io"
	"regexp"
	"strconv"

	"golang.org/x/text/encoding/korean"
	"golang.org/x/text/transform"
)

// wrapEucKRReader converts EUC-KR encoded HTML into UTF-8 so goquery
// can parse page content that the lottery site serves.
func wrapEucKRReader(r io.Reader) io.Reader {
	if r == nil {
		return r
	}

	return transform.NewReader(r, korean.EUCKR.NewDecoder())
}

// parseDigit extracts digits from a string and converts to int.
// Example: "1,234,567원" → 1234567
func parseDigit(s string) int {
	re := regexp.MustCompile(`\d`)
	digits := re.FindAllString(s, -1)
	numStr := ""
	for _, d := range digits {
		numStr += d
	}

	num, err := strconv.Atoi(numStr)
	if err != nil {
		return 0
	}

	return num
}
