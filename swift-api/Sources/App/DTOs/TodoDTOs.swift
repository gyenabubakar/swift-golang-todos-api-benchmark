import Foundation
import Hummingbird

struct CreateTodoRequest: Decodable, Sendable {
    let title: String
    let order: Int?
}

struct UpdateTodoRequest: Decodable, Sendable {
    let title: String?
    let order: Int?
    let completed: Bool?
}
