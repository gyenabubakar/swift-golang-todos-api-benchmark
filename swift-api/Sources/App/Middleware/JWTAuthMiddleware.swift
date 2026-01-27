import Foundation
import Hummingbird
import HummingbirdAuth

struct JWTAuthenticator: AuthenticatorMiddleware {
    typealias Context = AppRequestContext
    typealias Value = AuthenticatedUser

    let jwtService: JWTService

    init(jwtService: JWTService) {
        self.jwtService = jwtService
    }

    func authenticate(request: Request, context: AppRequestContext) async throws -> AuthenticatedUser? {
        // Get Bearer token from Authorization header
        guard let authorization = request.headers[.authorization],
              authorization.hasPrefix("Bearer ") else {
            return nil
        }

        let token = String(authorization.dropFirst(7))

        do {
            let payload = try await jwtService.verifyToken(token)
            guard let userId = payload.userId else {
                return nil
            }
            return AuthenticatedUser(id: userId, email: payload.email)
        } catch {
            return nil
        }
    }
}

struct RequireAuthMiddleware: RouterMiddleware {
    typealias Context = AppRequestContext

    func handle(
        _ request: Request,
        context: Context,
        next: (Request, Context) async throws -> Response
    ) async throws -> Response {
        guard context.auth.get(AuthenticatedUser.self) != nil else {
            throw HTTPError(.unauthorized, message: "Authentication required")
        }
        return try await next(request, context)
    }
}
