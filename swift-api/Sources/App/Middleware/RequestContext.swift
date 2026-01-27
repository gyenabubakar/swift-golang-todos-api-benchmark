import Foundation
import Hummingbird
import HummingbirdAuth
import Logging
import NIOCore

struct AppRequestContext: AuthRequestContext, RequestContext {
    var coreContext: CoreRequestContextStorage
    var auth: LoginCache

    init(source: Source) {
        self.coreContext = .init(source: source)
        self.auth = .init()
    }

    var requestDecoder: some RequestDecoder {
        JSONDecoder()
    }

    var responseEncoder: some ResponseEncoder {
        JSONEncoder()
    }
}

// Authenticated user info stored in context
struct AuthenticatedUser: Sendable {
    let id: UUID
    let email: String
}
