package repository

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"todos-api/internal/models"
	"github.com/google/uuid"
)

var ErrTodoNotFound = errors.New("todo not found")

type TodoRepository struct {
	db *sql.DB
}

func NewTodoRepository(db *sql.DB) *TodoRepository {
	return &TodoRepository{db: db}
}

func (r *TodoRepository) Create(ctx context.Context, todo *models.Todo) error {
	todo.ID = uuid.New()
	todo.CreatedAt = time.Now()
	todo.UpdatedAt = time.Now()

	_, err := r.db.ExecContext(ctx,
		`INSERT INTO todos (id, user_id, title, "order", completed, url, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		todo.ID, todo.UserID, todo.Title, todo.Order, todo.Completed, todo.URL, todo.CreatedAt, todo.UpdatedAt,
	)
	return err
}

func (r *TodoRepository) FindAll(ctx context.Context, userID uuid.UUID) ([]models.Todo, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, user_id, title, "order", completed, url, created_at, updated_at
		 FROM todos WHERE user_id = $1
		 ORDER BY "order" NULLS LAST, created_at DESC`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var todos []models.Todo
	for rows.Next() {
		var todo models.Todo
		err := rows.Scan(&todo.ID, &todo.UserID, &todo.Title, &todo.Order, &todo.Completed, &todo.URL, &todo.CreatedAt, &todo.UpdatedAt)
		if err != nil {
			return nil, err
		}
		todos = append(todos, todo)
	}

	if todos == nil {
		todos = []models.Todo{}
	}

	return todos, rows.Err()
}

func (r *TodoRepository) FindByID(ctx context.Context, id, userID uuid.UUID) (*models.Todo, error) {
	todo := &models.Todo{}
	err := r.db.QueryRowContext(ctx,
		`SELECT id, user_id, title, "order", completed, url, created_at, updated_at
		 FROM todos WHERE id = $1 AND user_id = $2`,
		id, userID,
	).Scan(&todo.ID, &todo.UserID, &todo.Title, &todo.Order, &todo.Completed, &todo.URL, &todo.CreatedAt, &todo.UpdatedAt)

	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrTodoNotFound
	}
	if err != nil {
		return nil, err
	}
	return todo, nil
}

func (r *TodoRepository) Update(ctx context.Context, todo *models.Todo) error {
	todo.UpdatedAt = time.Now()

	result, err := r.db.ExecContext(ctx,
		`UPDATE todos SET title = $1, "order" = $2, completed = $3, url = $4, updated_at = $5
		 WHERE id = $6 AND user_id = $7`,
		todo.Title, todo.Order, todo.Completed, todo.URL, todo.UpdatedAt, todo.ID, todo.UserID,
	)
	if err != nil {
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return ErrTodoNotFound
	}
	return nil
}

func (r *TodoRepository) Delete(ctx context.Context, id, userID uuid.UUID) error {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM todos WHERE id = $1 AND user_id = $2`,
		id, userID,
	)
	if err != nil {
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return ErrTodoNotFound
	}
	return nil
}

func (r *TodoRepository) DeleteAll(ctx context.Context, userID uuid.UUID) (int64, error) {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM todos WHERE user_id = $1`,
		userID,
	)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}
