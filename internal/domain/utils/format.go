package utils

import (
	"strconv"
	"strings"
)

func FormatNumbers(numbers []int) string {
	parts := make([]string, len(numbers))
	for i, n := range numbers {
		parts[i] = strconv.Itoa(n)
	}
	return strings.Join(parts, ", ")
}

func FormatAmount(amount int64) string {
	s := strconv.FormatInt(amount, 10)
	n := len(s)
	if n <= 3 {
		return s
	}

	var result strings.Builder
	for i, c := range s {
		if i > 0 && (n-i)%3 == 0 {
			result.WriteRune(',')
		}
		result.WriteRune(c)
	}
	return result.String()
}
