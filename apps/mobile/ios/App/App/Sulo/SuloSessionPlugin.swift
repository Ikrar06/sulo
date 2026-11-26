import Capacitor
import Foundation
import UIKit

/// SuloSession on iOS. Fase 1 has only what the synthetic build asks the real phone for
/// (the device for the performance tier, and haptics); the SIKOLA session itself comes in
/// Fase 2 (login in WKWebView, the cookie in the Keychain, requests through URLSession).
@objc(SuloSessionPlugin)
public class SuloSessionPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SuloSessionPlugin"
    public let jsName = "SuloSession"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "deviceInfo", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "haptic", returnType: CAPPluginReturnPromise),
    ]

    /// What the phone says about itself, for the performance tier (core perf/tier.ts). Memory only.
    /// iOS has no low-RAM flag; Low Power Mode asks for the same light tier, so it stands in for it.
    @objc func deviceInfo(_ call: CAPPluginCall) {
        let info = ProcessInfo.processInfo
        call.resolve([
            "lowRamDevice": info.isLowPowerModeEnabled,
            "totalRamMb": Int(info.physicalMemory / 1_048_576),
            "cpuCores": info.activeProcessorCount,
            "webView": "iOS " + UIDevice.current.systemVersion,
        ])
    }

    @objc func haptic(_ call: CAPPluginCall) {
        let firm = call.getString("kind") == "firm"
        DispatchQueue.main.async {
            let generator = UIImpactFeedbackGenerator(style: firm ? .medium : .light)
            generator.impactOccurred()
            call.resolve()
        }
    }
}
