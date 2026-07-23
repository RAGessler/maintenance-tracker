import AVFAudio

struct VehicleFingerprint {
  let id: String
  let name: String
  let routeUID: String
  let isCarPlay: Bool

  static let all = [
    VehicleFingerprint(
      id: "car-a",
      name: "Car A",
      routeUID: "00:00:00:00:00:00-Audio-AudioMain",
      isCarPlay: true
    ),
    VehicleFingerprint(
      id: "car-b",
      name: "Car B",
      routeUID: "94:BA:06:72:72:56-Audio-AudioMain",
      isCarPlay: true
    ),
    VehicleFingerprint(
      id: "car-c",
      name: "Car C",
      routeUID: "00:18:E4:DC:DA:D7-tacl",
      isCarPlay: false
    )
  ]

  static func matching(_ port: AVAudioSessionPortDescription) -> VehicleFingerprint? {
    all.first { fingerprint in
      fingerprint.isCarPlay
        ? normalizedCarPlayUID(port.uid) == fingerprint.routeUID
        : port.uid == fingerprint.routeUID
    }
  }

  static func named(_ name: String?) -> VehicleFingerprint? {
    all.first { $0.name == name }
  }

  static func normalizedCarPlayUID(_ uid: String) -> String {
    guard let range = uid.range(of: "-Audio-AudioMain-") else { return uid }
    return String(uid[..<range.upperBound]).dropLast().description
  }
}
