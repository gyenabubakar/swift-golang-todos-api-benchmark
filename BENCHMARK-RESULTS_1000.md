# Benchmark Results: Swift (Hummingbird) vs Go (1000 VUs)

Comparison of a Todo API implemented in both Swift (Hummingbird) and Go, running identical workloads.

## Test Environment

- **Machine:** MacBook (Apple Silicon), 7.8 GB RAM available to Docker
- **Database:** PostgreSQL 18 (Alpine)
- **Cache:** Redis 7 (Alpine)
- **Load Testing:** k6 with 1000 virtual users peak
- **Both APIs:** Running in Docker containers
- **Bcrypt Cost:** 10 (matching Go's DefaultCost)

## Test Scenario

Each virtual user performs a complete user flow with cache behavior testing:

1. Register new account (bcrypt password hashing)
2. Login
3. List todos (empty)
4. Create todo
5. Get todo by ID (cache miss)
6. Get todo by ID x2 (cache hits)
7. List todos (cache hit after create)
8. Update todo (invalidates cache)
9. Get todo by ID (cache miss after update)
10. Get todo by ID x2 (cache hits after update)
11. List todos (cache miss after update)
12. Delete todo

3-second pause between iterations to simulate realistic usage.

## Overall Results

| Metric | Swift | Go | Go (worker pool) |
|--------|-------|-----|------------------|
| **Success Rate** | 100% | 99.80% | 99.79% |
| **Failed Requests** | 0 | 273 (0.19%) | 281 (0.20%) |
| **Throughput** | 739 req/s | 574 req/s | 564 req/s |
| **Completed Iterations** | 12,811 | 10,159 | 9,971 |
| **Avg Latency** | 279ms | 423ms | 435ms |
| **Median Latency** | 18ms | 20ms | 21ms |
| **p95 Latency** | 1.96s | 2.4s | 2.5s |
| **p99 Latency** | 5.37s | 6.17s | 6.2s |

### Go Worker Pool Finding

Go's `/auth/register` endpoint experienced request timeouts under peak load (1000 VUs). A worker pool was tested to limit concurrent bcrypt operations (similar to Swift's `NIOThreadPool`), but it did not improve performance. The results were slightly worse: 281 failed requests vs 273, and 9,971 iterations vs 10,159.

This indicates the bottleneck is not goroutine scheduling overhead but rather the underlying bcrypt implementation performance. Both APIs use bcrypt cost factor 10, so the difference comes down to each language's bcrypt library implementation. Swift's `swift-bcrypt` (via Hummingbird) appears to be more efficient than Go's `golang.org/x/crypto/bcrypt` under high concurrency on Apple Silicon.

## Per-Endpoint Success Rates

| Endpoint | Swift | Go | Go (worker pool) |
|----------|-------|-----|------------------|
| POST /auth/register | 100% | 97% | 97% |
| POST /auth/login | 100% | 99% | 99% |
| GET /todos | 100% | 99% | 99% |
| POST /todos | 100% | 99% | 99% |
| GET /todos/:id | 100% | 100% | 99% |
| PATCH /todos/:id | 100% | 100% | 100% |
| DELETE /todos/:id | 100% | 100% | 100% |

## Median Latency by Endpoint

| Endpoint | Swift | Go | Go (worker pool) |
|----------|-------|-----|------------------|
| Register | 1,131ms | 2,005ms | 2,191ms |
| Login | 1,083ms | 718ms | 778ms |
| List | 14ms | 22ms | 22ms |
| Create | 30ms | 202ms | 219ms |
| Get | 9ms | 4ms | 4ms |
| Update | 37ms | 27ms | 24ms |
| Delete | 35ms | 9ms | 8ms |

## p95 Latency by Endpoint

| Endpoint | Swift | Go | Go (worker pool) |
|----------|-------|-----|------------------|
| Register | 5,636ms | 8,543ms | 8,648ms |
| Login | 5,502ms | 3,743ms | 3,866ms |
| List | 70ms | 1,463ms | 1,475ms |
| Create | 175ms | 1,958ms | 1,972ms |
| Get | 33ms | 423ms | 418ms |
| Update | 173ms | 713ms | 636ms |
| Delete | 155ms | 230ms | 230ms |

## Throughput by Endpoint

| Endpoint | Swift | Go | Go (worker pool) |
|----------|-------|-----|------------------|
| Register | 52.8/s | 40.9/s | 40.2/s |
| Login | 52.8/s | 40.9/s | 40.2/s |
| List | 158.4/s | 122.8/s | 120.6/s |
| Create | 52.8/s | 40.9/s | 40.2/s |
| Get | 316.8/s | 245.6/s | 241.1/s |
| Update | 52.8/s | 40.9/s | 40.2/s |
| Delete | 52.8/s | 40.9/s | 40.2/s |

## Key Observations

1. **Swift outperforms Go overall** - With bcrypt running on `NIOThreadPool` and cost factor matched to Go's default (10), Swift achieved 100% success rate vs Go's 99.80%.

2. **Swift dominates p95 latency** - 4-21x faster p95 latency on CRUD endpoints, indicating better performance under load.

3. **Go wins on some median latencies** - Get (2.3x), Update (1.4x), Delete (3.9x), and Login (1.5x). However, these advantages disappear under load (p95).

4. **Swift processed 29% more requests** - 739 req/s vs 574 req/s throughput.

5. **Bcrypt library performance differs** - Both use cost factor 10, but Swift's bcrypt implementation handles high concurrency better on Apple Silicon. Go's worker pool optimization did not help.

6. **Both frameworks are production-ready** - Under 1000 concurrent users, both achieved excellent success rates.

## Resource Usage

| Metric | Swift | Go | Go (worker pool) | Winner |
|--------|-------|-----|------------------|--------|
| **CPU (avg)** | 756% | 645% | 626% | Go |
| **CPU (max)** | 1,032% | 1,051% | 1,037% | Swift |
| **Memory (max)** | 102 MiB | 84 MiB | 87 MiB | Go |
| **Network In** | 67 MB | 82 MB | 80 MB | Swift |
| **Network Out** | 73 MB | 61 MB | 60 MB | Go |

Swift used ~17% more CPU on average to achieve 29% higher throughput - a favorable trade-off. Go was more memory-efficient, using ~18% less RAM.

## Optimizations Applied

### Swift

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

### Go

A worker pool was tested to limit concurrent bcrypt operations:

```go
var bcryptWorkerPool = make(chan struct{}, runtime.NumCPU()*2)

func HashPassword(password string) (string, error) {
    bcryptWorkerPool <- struct{}{} // acquire
    defer func() { <-bcryptWorkerPool }() // release
    
    bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
    return string(bytes), err
}
```

This did not improve performance, confirming the bottleneck is bcrypt library performance rather than concurrency management.

## Reproduction

See [BENCHMARK.md](./BENCHMARK.md) for instructions on running these benchmarks.
