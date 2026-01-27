import Foundation
import Hummingbird

struct RegisterRequest: Decodable, Sendable {
    let email: String
    let password: String
    let name: String
}

struct LoginRequest: Decodable, Sendable {
    let email: String
    let password: String
}

struct AuthResponse: ResponseEncodable, Sendable {
    let token: String
    let user: UserResponse
}

struct TokenPayload: Sendable, Codable {
    let sub: String  // user id
    let email: String
    let exp: Date
    let iat: Date

    var userId: UUID? {
        UUID(uuidString: sub)
    }
}
