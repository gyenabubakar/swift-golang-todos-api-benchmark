import Foundation
import Hummingbird
import HummingbirdBcrypt
import NIOPosix

struct AuthController: Sendable {
    let userRepository: UserRepository
    let jwtService: JWTService

    func addRoutes(to group: RouterGroup<AppRequestContext>) {
        group.post("register", use: register)
        group.post("login", use: login)
    }

    @Sendable
    func register(request: Request, context: AppRequestContext) async throws -> EditedResponse<
        AuthResponse
    > {
        let input = try await request.decode(as: RegisterRequest.self, context: context)

        // Check if user already exists
        if (try await userRepository.findByEmail(input.email)) != nil {
            throw HTTPError(.conflict, message: "Email already registered")
        }

        // Hash password on thread pool to avoid blocking async tasks
        // Use cost 10 to match Go's bcrypt.DefaultCost
        let passwordHash = try await NIOThreadPool.singleton.runIfActive {
            Bcrypt.hash(input.password, cost: 10)
        }

        // Create user
        let user = User(
            email: input.email,
            passwordHash: passwordHash,
            name: input.name
        )

        let createdUser = try await userRepository.create(user)

        // Generate token
        let token = try await jwtService.generateToken(for: createdUser)

        let response = AuthResponse(
            token: token,
            user: UserResponse(from: createdUser)
        )

        return EditedResponse(status: .created, response: response)
    }

    @Sendable
    func login(request: Request, context: AppRequestContext) async throws -> AuthResponse {
        let input = try await request.decode(as: LoginRequest.self, context: context)

        // Find user
        guard let user = try await userRepository.findByEmail(input.email) else {
            throw HTTPError(.unauthorized, message: "Invalid credentials")
        }

        // Verify password on thread pool to avoid blocking async tasks
        let passwordValid = try await NIOThreadPool.singleton.runIfActive {
            Bcrypt.verify(input.password, hash: user.passwordHash)
        }
        guard passwordValid else {
            throw HTTPError(.unauthorized, message: "Invalid credentials")
        }

        // Generate token
        let token = try await jwtService.generateToken(for: user)

        return AuthResponse(
            token: token,
            user: UserResponse(from: user)
        )
    }
}
