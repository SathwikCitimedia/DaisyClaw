import Foundation
import Testing
@testable import DaisyClaw

@Suite(.serialized) struct NodeServiceManagerTests {
    @Test func `builds node service commands with current CLI shape`() async throws {
        try await TestIsolation.withUserDefaultsValues(["daisyclaw.gatewayProjectRootPath": nil]) {
            let tmp = try makeTempDirForTests()
            CommandResolver.setProjectRoot(tmp.path)

            let daisyclawPath = tmp.appendingPathComponent("node_modules/.bin/daisyclaw")
            try makeExecutableForTests(at: daisyclawPath)

            let start = NodeServiceManager._testServiceCommand(["start"])
            #expect(start == [daisyclawPath.path, "node", "start", "--json"])

            let stop = NodeServiceManager._testServiceCommand(["stop"])
            #expect(stop == [daisyclawPath.path, "node", "stop", "--json"])
        }
    }
}
