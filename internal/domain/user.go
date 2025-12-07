package domain

// User represents a lottery user account.
type User struct {
	Username string
	Password string
}

// NewUser creates a new User instance.
func NewUser(username, password string) *User {
	return &User{
		Username: username,
		Password: password,
	}
}
