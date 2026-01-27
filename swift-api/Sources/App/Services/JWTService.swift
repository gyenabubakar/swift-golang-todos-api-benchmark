import Foundation
import Hummingbird
import JWTKit

struct JWTService: Sendable {
    private let keys: JWTKeyCollection

    init(secret: String) {
        self.keys = JWTKeyCollection()
        self.keys.add(hmac: .init(from: secret), digestAlgorithm: .sha256)
    }

    func generateToken(for user: User) async throws -> String {
        let payload = JWTPayload(
            subject: .init(value: user.id.uuidString),
            expiration: .init(value: Date().addingTimeInterval(86400)), // 24 hours
            issuedAt: .init(value: Date()),
            email: user.email
        )
        return try await keys.sign(payload)
    }

    func verifyToken(_ token: String) async throws -> JWTPayload {
        return try await keys.verify(token, as: JWTPayload.self)
    }
}

struct JWTPayload: JWTKit.JWTPayload, Sendable {
    let subject: SubjectClaim
    let expiration: ExpirationClaim
    let issuedAt: IssuedAtClaim
    let email: String

    var userId: UUID? {
        UUID(uuidString: subject.value)
    }

    func verify(using algorithm: some JWTKit.JWTAlgorithm) async throws {
        try expiration.verifyNotExpired()
    }

    enum CodingKeys: String, CodingKey {
        case subject = "sub"
        case expiration = "exp"
        case issuedAt = "iat"
        case email
    }
}
