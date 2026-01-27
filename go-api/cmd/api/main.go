package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"todos-api/internal/auth"
	"todos-api/internal/cache"
	"todos-api/internal/config"
	"todos-api/internal/handlers"
	"todos-api/internal/middleware"
	"todos-api/internal/repository"

	"github.com/gin-gonic/gin"
	_ "github.com/jackc/pgx/v5/stdlib" // pgx driver for database/sql
	"github.com/redis/go-redis/v9"
)

func main() {
	// Load configuration
	cfg := config.Load()

	// Set Gin mode
	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	// Connect to PostgreSQL
	dbPool, err := connectDB(cfg)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer dbPool.Close()

	// Connect to Redis
	redisClient := connectRedis(cfg)
	defer redisClient.Close()

	// Initialize services
	jwtService := auth.NewJWTService(cfg.JWTSecret)
	cacheService := cache.NewRedisCache(redisClient)
	userRepo := repository.NewUserRepository(dbPool)
	todoRepo := repository.NewTodoRepository(dbPool)

	// Initialize handlers
	authHandler := handlers.NewAuthHandler(userRepo, jwtService)
	todoHandler := handlers.NewTodoHandler(todoRepo, cacheService, cfg.BaseURL)

	// Setup router
	router := gin.New()
	router.Use(gin.Logger())
	router.Use(gin.Recovery())
	router.Use(middleware.CORS())

	// Health check
	router.GET("/health", func(c *gin.Context) {
		c.String(http.StatusOK, "OK")
	})

	// Auth routes
	authGroup := router.Group("/auth")
	{
		authGroup.POST("/register", authHandler.Register)
		authGroup.POST("/login", authHandler.Login)
	}

	// Todo routes (protected)
	todoGroup := router.Group("/todos")
	todoGroup.Use(middleware.JWTAuth(jwtService))
	{
		todoGroup.GET("", todoHandler.List)
		todoGroup.POST("", todoHandler.Create)
		todoGroup.GET("/:id", todoHandler.Get)
		todoGroup.PATCH("/:id", todoHandler.Update)
		todoGroup.DELETE("/:id", todoHandler.Delete)
		todoGroup.DELETE("", todoHandler.DeleteAll)
	}

	// Create server
	srv := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.Port),
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Start server in goroutine
	go func() {
		log.Printf("Starting server on port %d", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server failed: %v", err)
		}
	}()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Println("Server exited")
}

func connectDB(cfg *config.Config) (*sql.DB, error) {
	connStr := fmt.Sprintf(
		"postgres://%s:%s@%s:%d/%s?sslmode=disable",
		cfg.DBUsername, cfg.DBPassword, cfg.DBHost, cfg.DBPort, cfg.DBName,
	)

	db, err := sql.Open("pgx", connStr)
	if err != nil {
		return nil, err
	}

	// Configure connection pool
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(time.Hour)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Test connection
	if err := db.PingContext(ctx); err != nil {
		return nil, err
	}

	log.Println("Connected to PostgreSQL")
	return db, nil
}

func connectRedis(cfg *config.Config) *redis.Client {
	client := redis.NewClient(&redis.Options{
		Addr:         fmt.Sprintf("%s:%d", cfg.RedisHost, cfg.RedisPort),
		PoolSize:     10,
		MinIdleConns: 2,
	})

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		log.Printf("Warning: Redis connection failed: %v", err)
	} else {
		log.Println("Connected to Redis")
	}

	return client
}
