import Foundation
import Hummingbird

struct Todo: Sendable, Codable {
    let id: UUID
    let userId: UUID
    var title: String
    var order: Int?
    var completed: Bool
    var url: String?
    let createdAt: Date
    var updatedAt: Date

    init(
        id: UUID = UUID(),
        userId: UUID,
        title: String,
        order: Int? = nil,
        completed: Bool = false,
        url: String? = nil,
        createdAt: Date = Date(),
        updatedAt: Date = Date()
    ) {
        self.id = id
        self.userId = userId
        self.title = title
        self.order = order
        self.completed = completed
        self.url = url
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

struct TodoResponse: Codable, ResponseEncodable, Sendable {
    let id: UUID
    let title: String
    let order: Int?
    let completed: Bool
    let url: String
    let createdAt: Date
    let updatedAt: Date

    init(from todo: Todo, baseURL: String) {
        self.id = todo.id
        self.title = todo.title
        self.order = todo.order
        self.completed = todo.completed
        self.url = todo.url ?? "\(baseURL)/todos/\(todo.id)"
        self.createdAt = todo.createdAt
        self.updatedAt = todo.updatedAt
    }
}
