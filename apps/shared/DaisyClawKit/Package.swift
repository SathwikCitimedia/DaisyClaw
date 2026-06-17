// swift-tools-version: 6.2

import PackageDescription

let package = Package(
    name: "DaisyClawKit",
    platforms: [
        .iOS(.v18),
        .macOS(.v15),
    ],
    products: [
        .library(name: "DaisyClawProtocol", targets: ["DaisyClawProtocol"]),
        .library(name: "DaisyClawKit", targets: ["DaisyClawKit"]),
        .library(name: "DaisyClawChatUI", targets: ["DaisyClawChatUI"]),
    ],
    traits: [
        .trait(name: "Talk", description: "ElevenLabs cloud TTS / talk support"),
        .default(enabledTraits: ["Talk"]),
    ],
    dependencies: [
        .package(url: "https://github.com/steipete/ElevenLabsKit", exact: "0.1.1"),
        .package(url: "https://github.com/gonzalezreal/textual", exact: "0.3.1"),
    ],
    targets: [
        .target(
            name: "DaisyClawProtocol",
            path: "Sources/DaisyClawProtocol",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .target(
            name: "DaisyClawKit",
            dependencies: [
                "DaisyClawProtocol",
                .product(name: "ElevenLabsKit", package: "ElevenLabsKit", condition: .when(traits: ["Talk"])),
            ],
            path: "Sources/DaisyClawKit",
            resources: [
                .process("Resources"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .target(
            name: "DaisyClawChatUI",
            dependencies: [
                "DaisyClawKit",
                .product(
                    name: "Textual",
                    package: "textual",
                    condition: .when(platforms: [.macOS, .iOS])),
            ],
            path: "Sources/DaisyClawChatUI",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .testTarget(
            name: "DaisyClawKitTests",
            dependencies: ["DaisyClawKit", "DaisyClawChatUI"],
            path: "Tests/DaisyClawKitTests",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
                .enableExperimentalFeature("SwiftTesting"),
            ]),
    ])
