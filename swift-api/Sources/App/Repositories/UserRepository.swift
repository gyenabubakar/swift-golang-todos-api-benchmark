import Foundation
import Logging
import PostgresNIO

protocol UserRepository: Sendable {
    func create(_ user: User) async throws -> User
    func findByEmail(_ email: String) async throws -> User?
    func findById(_ id: UUID) async throws -> User?
}

struct UserPostgresRepository: UserRepository {
    let client: PostgresClient
    private let logger = Logger(label: "UserRepository")

    func create(_ user: User) async throws -> User {
        try await client.query(
            """
            INSERT INTO users (id, email, password_hash, name, created_at, updated_at)
            VALUES (\(user.id), \(user.email), \(user.passwordHash), \(user.name), \(user.createdAt), \(user.updatedAt))
            """,
            logger: logger
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
            logger: logger
        )

        for try await (id, email, passwordHash, name, createdAt, updatedAt) in rows.decode(
            (UUID, String, String, String, Date, Date).self,
            context: .default
        ) {
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
            logger: logger
        )

        for try await (id, email, passwordHash, name, createdAt, updatedAt) in rows.decode(
            (UUID, String, String, String, Date, Date).self,
            context: .default
        ) {
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
