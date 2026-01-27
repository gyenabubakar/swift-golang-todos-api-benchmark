import Foundation

struct User: Sendable, Codable {
    let id: UUID
    let email: String
    let passwordHash: String
    let name: String
    let createdAt: Date
    let updatedAt: Date

    init(
        id: UUID = UUID(),
        email: String,
        passwordHash: String,
        name: String,
        createdAt: Date = Date(),
        updatedAt: Date = Date()
    ) {
        self.id = id
        self.email = email
        self.passwordHash = passwordHash
        self.name = name
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

struct UserResponse: Sendable, Codable {
    let id: UUID
    let email: String
    let name: String
    let createdAt: Date
    let updatedAt: Date

    init(from user: User) {
        self.id = user.id
        self.email = user.email
        self.name = user.name
        self.createdAt = user.createdAt
        self.updatedAt = user.updatedAt
    }
}
