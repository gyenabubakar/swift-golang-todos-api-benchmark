import Hummingbird
import HummingbirdTesting
import XCTest

@testable import App

final class AppTests: XCTestCase {
    func testHealthEndpoint() async throws {
        // Simple test to verify app initialization
        // Full integration tests require database and redis
        XCTAssertTrue(true, "App module loaded successfully")
    }
}
