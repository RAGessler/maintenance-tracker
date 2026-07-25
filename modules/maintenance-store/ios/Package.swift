// swift-tools-version: 6.0
import PackageDescription

let package = Package(
  name: "MaintenanceStoreCore",
  platforms: [.macOS(.v13)],
  products: [
    .library(name: "MaintenanceStoreCore", targets: ["MaintenanceStoreCore"]),
  ],
  targets: [
    .target(
      name: "MaintenanceStoreCore",
      linkerSettings: [.linkedLibrary("sqlite3")]
    ),
    .testTarget(
      name: "MaintenanceStoreCoreTests",
      dependencies: ["MaintenanceStoreCore"]
    ),
  ]
)
