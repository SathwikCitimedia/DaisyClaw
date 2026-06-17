import Testing
@testable import DaisyClawKit

struct GatewayTLSPinningTests {
    @Test func `first use pinning requires system trust`() {
        #expect(GatewayTLSFirstUsePolicy.allowsFirstUsePin(systemTrustOk: true))
        #expect(!GatewayTLSFirstUsePolicy.allowsFirstUsePin(systemTrustOk: false))
    }
}
