# Todo API Benchmark: Swift, Go, and Bun

This repo contains the same Todo API built three ways:

- **Swift** with Hummingbird
- **Go** with Gin
- **Bun** with Elysia

All three use the same PostgreSQL database and the same Valkey cache. The point of the repo is simple: run the same workload against each backend and compare the results.

## What You Need

Install these first:

- Docker
- Bun
- k6
- Make

Example on macOS:

```bash
brew install bun k6
```

## Project Layout

```text
.
├── Makefile
├── docker-compose.yml
├── init.sql
├── _scripts/
│   ├── benchmark.js
│   └── ... Bun scripts that power the Make commands
├── bun-api/
├── go-api/
└── swift-api/
```

## The Benchmark Workflow

This is the main workflow now.

## 1. Prepare everything

```bash
make prepare
```

What it does:

- removes existing containers
- removes Docker volumes
- writes fresh `.env` files
- starts PostgreSQL and Valkey
- applies `init.sql`

Important:
`make prepare` starts from a clean slate on purpose. That means old benchmark data in the database is wiped.

## 2. Start one backend

Pick one:

```bash
make bun
make go
make swift
```

What it does:

- stops the other backend containers
- starts only the backend you picked

Ports:

- Swift: `http://localhost:8080`
- Go: `http://localhost:8081`
- Bun: `http://localhost:8082`

## 3. Run a benchmark

Pick one load:

```bash
make bench-500
make bench-1k
make bench-2k
make bench-4k
```

What it does:

- checks which backend is active
- throws an error if none are active
- throws an error if more than one is active
- runs the k6 benchmark against the active backend
- saves the result to `_bench-results/`

Saved file format:

```text
_bench-results/<backend>-YYYY-MM-DD_HH-MM.json
```

Example:

```text
_bench-results/swift-2026-04-22_13-53.json
```

## 4. Read the latest results

```bash
make result
```

What it does:

- finds the latest saved result for Bun
- finds the latest saved result for Go
- finds the latest saved result for Swift
- shows each backend on its own
- explains `p50`, `p90`, `p95`, and `p99` in simple English

## 5. Compare the latest results

```bash
make compare
```

What it does:

- compares the latest saved result for each backend
- says which backend wins in each category
- warns you if the latest runs used different load sizes

For a fair comparison, run the same load for all three backends first.

## Fastest Way To Benchmark All Three

Run these commands in order:

```bash
make prepare

make bun
make bench-500

make go
make bench-500

make swift
make bench-500

make result
make compare
```

If you want a heavier comparison, replace `bench-500` with `bench-1k`, `bench-2k`, or `bench-4k`.

## What The Benchmark Tests

Each virtual user does a full auth and todo flow:

1. register
2. login
3. list todos
4. create a todo
5. get the todo
6. get it again to hit cache
7. list todos again
8. update the todo
9. get it after update
10. get it again to hit cache
11. list todos after update
12. delete the todo

This means the benchmark is not just testing raw CRUD. It is also testing auth, cache hits, cache misses, and cache invalidation through the k6 script in `_scripts/benchmark.js`.

## Load Sizes

Available benchmark targets:

- `make bench-500`
- `make bench-1k`
- `make bench-2k`
- `make bench-4k`

Higher loads run longer on purpose. So `bench-4k` is much slower to finish than `bench-500`.

## Where Results Go

Results are saved here:

```text
_bench-results/
```

This folder is gitignored.

## Manual API Use

If you just want to hit the APIs yourself, the endpoint shape is the same for all three backends.

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register a new user |
| POST | `/auth/login` | Login and get a JWT token |

### Todos

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/todos` | List todos |
| POST | `/todos` | Create a todo |
| GET | `/todos/:id` | Get one todo |
| PATCH | `/todos/:id` | Update one todo |
| DELETE | `/todos/:id` | Delete one todo |
| DELETE | `/todos` | Delete all todos |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |

Example:

```bash
curl -X POST http://localhost:8080/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123",
    "name": "John Doe"
  }'
```

## Environment

Default values:

| Variable | Default |
|----------|---------|
| `DB_HOST` | `localhost` |
| `DB_PORT` | `5432` |
| `DB_USERNAME` | `todos_user` |
| `DB_PASSWORD` | `todos_password` |
| `DB_NAME` | `todos_benchmark` |
| `CACHE_HOST` | `localhost` |
| `CACHE_PORT` | `6379` |
| `JWT_SECRET` | `your-super-secret-jwt-key-change-in-production` |
| `BASE_URL` | `http://localhost:8080` |
| `BUN_BASE_URL` | `http://localhost:8082` |
| `PORT` | `8082` |
| `LOG_LEVEL` | `info` |
| `LOG_LEVEL` | `info` |

You usually do not need to create these by hand. `make prepare` writes the needed `.env` files for you.

## Stack Summary

### Swift API

- Hummingbird
- PostgresNIO
- HummingbirdAuth
- HummingbirdValkey
- JWTKit

### Go API

- Gin
- pgxpool
- valkey-go
- golang-jwt
- bcrypt

### Bun API

- Bun
- Elysia
- Drizzle on Bun SQL
- Bun Redis client
- `@elysiajs/jwt`

## Notes

- The first Swift build can take a long time because the image and dependencies are large.
- k6 threshold failures do not stop result saving. You still get a JSON file to inspect.
- `make compare` is only useful when at least two backends have saved results.
