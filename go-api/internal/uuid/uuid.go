package uuid

import (
	"crypto/rand"
	"database/sql/driver"
	"encoding/hex"
	"fmt"
)

// UUID represents a UUID (Universally Unique Identifier)
type UUID [16]byte

// Nil is the nil UUID (all zeros)
var Nil UUID

// New generates a new random UUID v4
func New() UUID {
	var uuid UUID
	_, _ = rand.Read(uuid[:])
	uuid[6] = (uuid[6] & 0x0f) | 0x40 // Version 4
	uuid[8] = (uuid[8] & 0x3f) | 0x80 // Variant is 10
	return uuid
}

// Parse parses a UUID string
func Parse(s string) (UUID, error) {
	var uuid UUID
	if len(s) != 36 {
		return Nil, fmt.Errorf("invalid UUID length: %d", len(s))
	}

	// Remove hyphens and decode
	hexStr := s[0:8] + s[9:13] + s[14:18] + s[19:23] + s[24:36]
	b, err := hex.DecodeString(hexStr)
	if err != nil {
		return Nil, fmt.Errorf("invalid UUID format: %w", err)
	}
	copy(uuid[:], b)
	return uuid, nil
}

// String returns the string representation of the UUID
func (u UUID) String() string {
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x",
		u[0:4], u[4:6], u[6:8], u[8:10], u[10:16])
}

// MarshalJSON implements json.Marshaler
func (u UUID) MarshalJSON() ([]byte, error) {
	return []byte(`"` + u.String() + `"`), nil
}

// UnmarshalJSON implements json.Unmarshaler
func (u *UUID) UnmarshalJSON(data []byte) error {
	if len(data) < 2 || data[0] != '"' || data[len(data)-1] != '"' {
		return fmt.Errorf("invalid UUID JSON")
	}
	parsed, err := Parse(string(data[1 : len(data)-1]))
	if err != nil {
		return err
	}
	*u = parsed
	return nil
}

// Value implements driver.Valuer for database storage
func (u UUID) Value() (driver.Value, error) {
	return u.String(), nil
}

// Scan implements sql.Scanner for database retrieval
func (u *UUID) Scan(src interface{}) error {
	switch v := src.(type) {
	case []byte:
		if len(v) == 16 {
			copy(u[:], v)
			return nil
		}
		parsed, err := Parse(string(v))
		if err != nil {
			return err
		}
		*u = parsed
		return nil
	case string:
		parsed, err := Parse(v)
		if err != nil {
			return err
		}
		*u = parsed
		return nil
	default:
		return fmt.Errorf("cannot scan type %T into UUID", src)
	}
}
