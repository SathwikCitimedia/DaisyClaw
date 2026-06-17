import Testing
@testable import DaisyClaw

@Suite(.serialized) struct DaisyClawAppDelegateTests {
    @Test @MainActor func resolvesRegistryModelBeforeViewTaskAssignsDelegateModel() {
        let registryModel = NodeAppModel()
        DaisyClawAppModelRegistry.appModel = registryModel
        defer { DaisyClawAppModelRegistry.appModel = nil }

        let delegate = DaisyClawAppDelegate()

        #expect(delegate._test_resolvedAppModel() === registryModel)
    }

    @Test @MainActor func prefersExplicitDelegateModelOverRegistryFallback() {
        let registryModel = NodeAppModel()
        let explicitModel = NodeAppModel()
        DaisyClawAppModelRegistry.appModel = registryModel
        defer { DaisyClawAppModelRegistry.appModel = nil }

        let delegate = DaisyClawAppDelegate()
        delegate.appModel = explicitModel

        #expect(delegate._test_resolvedAppModel() === explicitModel)
    }
}
