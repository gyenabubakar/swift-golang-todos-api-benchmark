import Foundation
import PostgresNIO

protocol UserRepository: Sendable {
    func create(_ user: User) async throws -> User
    func findByEmail(_ email: String) async throws -> User?
    func findById(_ id: UUID) async throws -> User?
}

struct UserPostgresRepository: UserRepository {
    let client: PostgresClient

    func create(_ user: User) async throws -> User {
        try await client.query(
            """
            INSERT INTO users (id, email, password_hash, name, created_at, updated_at)
            VALUES (\(user.id), \(user.email), \(user.passwordHash), \(user.name), \(user.createdAt), \(user.updatedAt))
            """,
            logger: .init(label: "UserRepository")
        )
        return user
    }

    func findByEmail(_ email: String) async throws -> User? {
        let rows = try await client.query(
            """
            SELECT id, email, password_hash, name, created_at, updated_at
            FROM users
            WHERE email = \(email)
            """,
            logger: .init(label: "UserRepository")
        )

        for try await row in rows {
            let id = try row.decode(UUID.self, context: .default)
            let email = try row.decode(String.self, context: .default)
            let passwordHash = try row.decode(String.self, context: .default)
            let name = try row.decode(String.self, context: .default)
            let createdAt = try row.decode(Date.self, context: .default)
            let updatedAt = try row.decode(Date.self, context: .default)

            return User(
                id: id,
                email: email,
                passwordHash: passwordHash,
                name: name,
                createdAt: createdAt,
                updatedAt: updatedAt
            )
        }
        return nil
    }

    func findById(_ id: UUID) async throws -> User? {
        let rows = try await client.query(
            """
            SELECT id, email, password_hash, name, created_at, updated_at
            FROM users
            WHERE id = \(id)
            """,
            logger: .init(label: "UserRepository")
        )

        for try await row in rows {
            let id = try row.decode(UUID.self, context: .default)
            let email = try row.decode(String.self, context: .default)
            let passwordHash = try row.decode(String.self, context: .default)
            let name = try row.decode(String.self, context: .default)
            let createdAt = try row.decode(Date.self, context: .default)
            let updatedAt = try row.decode(Date.self, context: .default)

            return User(
                id: id,
                email: email,
                passwordHash: passwordHash,
                name: name,
                createdAt: createdAt,
                updatedAt: updatedAt
            )
        }
        return nil
    }
}
