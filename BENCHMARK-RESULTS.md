# Benchmark Results: Swift (Hummingbird) vs Go

Comparison of a Todo API implemented in both Swift (Hummingbird) and Go, running identical workloads.

## Test Environment

- **Machine:** MacBook (Apple Silicon), 7.8 GB RAM available to Docker
- **Database:** PostgreSQL 18 (Alpine)
- **Cache:** Redis 7 (Alpine)
- **Load Testing:** k6 with 1000 virtual users peak
- **Both APIs:** Running in Docker containers
- **Bcrypt Cost:** 10 (matching Go's DefaultCost)

## Test Scenario

Each virtual user performs a complete user flow:

1. Register new account (bcrypt password hashing)
2. Login
3. List todos
4. Create todo
5. Get todo by ID
6. Update todo
7. Delete todo

3-second pause between iterations to simulate realistic usage.

## Overall Results

| Metric | Swift | Go | Winner |
|--------|-------|-----|--------|
| **Success Rate** | 100% | 99.82% | Swift |
| **Failed Requests** | 0 | 130 (0.17%) | Swift |
| **Throughput** | 374 req/s | 305 req/s | Swift |
| **Completed Iterations** | 12,955 | 10,645 | Swift |
| **Avg Latency** | 546ms | 770ms | Swift |
| **Median Latency** | 31ms | 174ms | Swift |
| **p95 Latency** | 4.14s | 3.56s | Go |
| **p99 Latency** | 5.72s | 6.62s | Swift |

## Per-Endpoint Success Rates

| Endpoint | Swift | Go |
|----------|-------|-----|
| POST /auth/register | 100% | 98% |
| POST /auth/login | 100% | 99% |
| GET /todos | 100% | 99% |
| POST /todos | 100% | 99% |
| GET /todos/:id | 100% | 99% |
| PATCH /todos/:id | 100% | 99% |
| DELETE /todos/:id | 100% | 99% |

## Median Latency by Endpoint

| Endpoint | Swift | Go | Winner |
|----------|-------|-----|--------|
| Register | 1,221ms | 1,676ms | Swift |
| Login | 1,189ms | 672ms | Go |
| List | 8ms | 224ms | Swift (28x) |
| Create | 26ms | 195ms | Swift (7.5x) |
| Get | 7ms | 88ms | Swift (12x) |
| Update | 28ms | 67ms | Swift (2.4x) |
| Delete | 27ms | 36ms | Swift |

## p95 Latency by Endpoint

| Endpoint | Swift | Go | Winner |
|----------|-------|-----|--------|
| Register | 5,593ms | 6,848ms | Swift |
| Login | 5,605ms | 3,412ms | Go |
| List | 95ms | 2,476ms | Swift (26x) |
| Create | 162ms | 2,213ms | Swift (14x) |
| Get | 31ms | 1,785ms | Swift (58x) |
| Update | 148ms | 1,585ms | Swift (11x) |
| Delete | 120ms | 1,440ms | Swift (12x) |

## Throughput by Endpoint

| Endpoint | Swift | Go | Winner |
|----------|-------|-----|--------|
| Register | 53.4/s | 43.5/s | Swift |
| Login | 53.4/s | 43.5/s | Swift |
| List | 53.4/s | 43.5/s | Swift |
| Create | 53.4/s | 43.5/s | Swift |
| Get | 53.4/s | 43.5/s | Swift |
| Update | 53.4/s | 43.5/s | Swift |
| Delete | 53.4/s | 43.5/s | Swift |

## Key Observations

1. **Swift outperforms Go after optimization** - With bcrypt running on `NIOThreadPool` and cost factor matched to Go's default (10), Swift achieved 100% success rate vs Go's 99.82%.

2. **Swift's CRUD operations are significantly faster** - 7-58x faster median latency on todo endpoints, likely due to effective Redis caching.

3. **Go still wins on login latency** - 672ms vs 1,189ms median. Login involves bcrypt verification which remains CPU-intensive.

4. **Swift processed 22% more requests** - 374 req/s vs 305 req/s throughput.

5. **Both frameworks are production-ready** - Under 1000 concurrent users, both achieved excellent success rates with sub-second median latencies for most operations.

## Resource Usage

| Metric | Swift | Go | Winner |
|--------|-------|-----|--------|
| **CPU (avg)** | 875% | 673% | Go |
| **CPU (max)** | 1,076% | 1,099% | Similar |
| **Memory (max)** | 103 MiB | 83 MiB | Go |
| **Memory (avg)** | 61 MiB | 46 MiB | Go |
| **Network In** | 94 MB | 74 MB | Swift |
| **Network Out** | 107 MB | 94 MB | Swift |

Swift used more CPU to achieve higher throughput. Go was more resource-efficient but processed fewer requests.

## Optimizations Applied

The following optimizations were applied to the Swift implementation:

1. **Bcrypt on thread pool** - Moved `Bcrypt.hash()` and `Bcrypt.verify()` to `NIOThreadPool.singleton` to avoid blocking the async runtime
2. **Matched bcrypt cost** - Reduced from default 12 to 10 to match Go's `bcrypt.DefaultCost`

```swift
// Before (blocking)
let passwordHash = Bcrypt.hash(input.password)

// After (non-blocking)
let passwordHash = try await NIOThreadPool.singleton.runIfActive {
    Bcrypt.hash(input.password, cost: 10)
}
```

## Reproduction

See [BENCHMARK.md](./BENCHMARK.md) for instructions on running these benchmarks.
