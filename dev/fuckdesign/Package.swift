// swift-tools-version: 5.9
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
            dependencies: ["FuckDesign"]
        )
    ]
)
