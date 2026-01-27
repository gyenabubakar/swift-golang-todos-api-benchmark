import Foundation
import HummingbirdRedis
import RediStack

protocol CacheService: Sendable {
    func get<T: Decodable>(_ key: String) async throws -> T?
    func set<T: Encodable>(_ key: String, value: T, ttl: Int?) async throws
    func delete(_ key: String) async throws
    func deletePattern(_ pattern: String) async throws
}

struct RedisCacheService: CacheService {
    let redis: RedisConnectionPoolService
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    init(redis: RedisConnectionPoolService) {
        self.redis = redis
    }

    func get<T: Decodable>(_ key: String) async throws -> T? {
        let result = try await redis.get(RedisKey(key), as: Data.self).get()
        guard let data = result else {
            return nil
        }
        return try decoder.decode(T.self, from: data)
    }

    func set<T: Encodable>(_ key: String, value: T, ttl: Int? = 300) async throws {
        let data = try encoder.encode(value)
        if let ttl = ttl {
            _ = try await redis.setex(RedisKey(key), to: data, expirationInSeconds: ttl).get()
        } else {
            _ = try await redis.set(RedisKey(key), to: data).get()
        }
    }

    func delete(_ key: String) async throws {
        _ = try await redis.delete(RedisKey(key)).get()
    }

    func deletePattern(_ pattern: String) async throws {
        let (_, keys) = try await redis.scan(matching: pattern).get()
        for key in keys {
            _ = try await redis.delete(RedisKey(key)).get()
        }
    }
}

// Cache key helpers
extension RedisCacheService {
    static func todosKey(userId: UUID) -> String {
        "todos:user:\(userId.uuidString)"
    }

    static func todoKey(id: UUID) -> String {
        "todo:\(id.uuidString)"
    }
}
