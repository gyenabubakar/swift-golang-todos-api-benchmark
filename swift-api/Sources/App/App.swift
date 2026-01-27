import ArgumentParser
import Hummingbird
import Logging

@main
struct App: AsyncParsableCommand {
    @Option(name: .shortAndLong)
    var hostname: String = "0.0.0.0"

    @Option(name: .shortAndLong)
    var port: Int = 8080

    @Option(name: .long)
    var logLevel: String?

    func run() async throws {
        let envLogLevel = Environment().get("LOG_LEVEL")
        let level = Logger.Level(rawValue: logLevel ?? envLogLevel ?? "info") ?? .info

        var logger = Logger(label: "TodosAPI")
        logger.logLevel = level

        let app = try await buildApplication(
            configuration: .init(
                address: .hostname(hostname, port: port),
                serverName: "TodosAPI"
            ),
            logger: logger
        )

        try await app.runService()
    }
}
