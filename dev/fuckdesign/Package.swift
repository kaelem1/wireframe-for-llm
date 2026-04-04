// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "FuckDesign",
    platforms: [
        .macOS(.v14)
    ],
    products: [
        .executable(name: "FuckDesign", targets: ["FuckDesign"])
    ],
    targets: [
        .executableTarget(name: "FuckDesign"),
        .testTarget(
            name: "FuckDesignTests",
            dependencies: ["FuckDesign"],
            swiftSettings: [
                .unsafeFlags(["-target", "arm64-apple-macosx15.0"])
            ]
        )
    ]
)
