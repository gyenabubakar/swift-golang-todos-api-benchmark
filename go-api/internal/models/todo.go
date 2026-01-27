package models

import (
	"fmt"
	"time"

	"github.com/google/uuid"
)

type Todo struct {
	ID        uuid.UUID `json:"id"`
	UserID    uuid.UUID `json:"user_id"`
	Title     string    `json:"title"`
	Order     *int      `json:"order,omitempty"`
	Completed bool      `json:"completed"`
	URL       *string   `json:"url,omitempty"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type TodoResponse struct {
	ID        uuid.UUID `json:"id"`
	Title     string    `json:"title"`
	Order     *int      `json:"order,omitempty"`
	Completed bool      `json:"completed"`
	URL       string    `json:"url"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

func (t *Todo) ToResponse(baseURL string) TodoResponse {
	url := fmt.Sprintf("%s/todos/%s", baseURL, t.ID.String())
	if t.URL != nil {
		url = *t.URL
	}

	return TodoResponse{
		ID:        t.ID,
		Title:     t.Title,
		Order:     t.Order,
		Completed: t.Completed,
		URL:       url,
		CreatedAt: t.CreatedAt,
		UpdatedAt: t.UpdatedAt,
	}
}

type CreateTodoRequest struct {
	Title string `json:"title" binding:"required"`
	Order *int   `json:"order,omitempty"`
}

type UpdateTodoRequest struct {
	Title     *string `json:"title,omitempty"`
	Order     *int    `json:"order,omitempty"`
	Completed *bool   `json:"completed,omitempty"`
}
