// swift-tools-version: 6.2
// Package manifest for the DaisyClaw macOS companion (menu bar app + IPC library).

import PackageDescription

let package = Package(
    name: "DaisyClaw",
    platforms: [
        .macOS(.v15),
    ],
    products: [
        .library(name: "DaisyClawIPC", targets: ["DaisyClawIPC"]),
        .library(name: "DaisyClawDiscovery", targets: ["DaisyClawDiscovery"]),
        .executable(name: "DaisyClaw", targets: ["DaisyClaw"]),
        .executable(name: "daisyclaw-mac", targets: ["DaisyClawMacCLI"]),
    ],
    dependencies: [
        .package(url: "https://github.com/orchetect/MenuBarExtraAccess", exact: "1.3.0"),
        .package(url: "https://github.com/swiftlang/swift-subprocess.git", from: "0.4.0"),
        .package(url: "https://github.com/apple/swift-log.git", from: "1.10.1"),
        .package(url: "https://github.com/sparkle-project/Sparkle", from: "2.9.0"),
        .package(url: "https://github.com/steipete/Peekaboo.git", exact: "3.4.0"),
        .package(path: "../shared/DaisyClawKit"),
        .package(path: "../swabble"),
    ],
    targets: [
        .target(
            name: "DaisyClawIPC",
            dependencies: [],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .target(
            name: "DaisyClawDiscovery",
            dependencies: [
                .product(name: "DaisyClawKit", package: "DaisyClawKit"),
            ],
            path: "Sources/DaisyClawDiscovery",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .executableTarget(
            name: "DaisyClaw",
            dependencies: [
                "DaisyClawIPC",
                "DaisyClawDiscovery",
                .product(name: "DaisyClawKit", package: "DaisyClawKit"),
                .product(name: "DaisyClawChatUI", package: "DaisyClawKit"),
                .product(name: "DaisyClawProtocol", package: "DaisyClawKit"),
                .product(name: "SwabbleKit", package: "swabble"),
                .product(name: "MenuBarExtraAccess", package: "MenuBarExtraAccess"),
                .product(name: "Subprocess", package: "swift-subprocess"),
                .product(name: "Logging", package: "swift-log"),
                .product(name: "Sparkle", package: "Sparkle"),
                .product(name: "PeekabooBridge", package: "Peekaboo"),
                .product(name: "PeekabooAutomationKit", package: "Peekaboo"),
            ],
            exclude: [
                "Resources/Info.plist",
            ],
            resources: [
                .copy("Resources/DaisyClaw.icns"),
                .copy("Resources/DeviceModels"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .executableTarget(
            name: "DaisyClawMacCLI",
            dependencies: [
                "DaisyClawDiscovery",
                .product(name: "DaisyClawKit", package: "DaisyClawKit"),
                .product(name: "DaisyClawProtocol", package: "DaisyClawKit"),
            ],
            path: "Sources/DaisyClawMacCLI",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .testTarget(
            name: "DaisyClawIPCTests",
            dependencies: [
                "DaisyClawIPC",
                "DaisyClaw",
                "DaisyClawMacCLI",
                "DaisyClawDiscovery",
                .product(name: "DaisyClawProtocol", package: "DaisyClawKit"),
                .product(name: "SwabbleKit", package: "swabble"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
                .enableExperimentalFeature("SwiftTesting"),
            ]),
    ])
