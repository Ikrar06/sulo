// Test builds only (Debug, and the synthetic and debug .ipa: SULO_PROBE, scripts/ios.mjs); never in a release.
#if DEBUG || SULO_PROBE
import Capacitor
import Foundation

/// The Fase 1 checks (Probe.swift) for the hidden dev screen.
@objc(SuloProbePlugin)
public class SuloProbePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SuloProbePlugin"
    public let jsName = "SuloProbe"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "write", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clear", returnType: CAPPluginReturnPromise),
    ]

    @objc func status(_ call: CAPPluginCall) {
        Probe.status { call.resolve($0) }
    }

    /// Writes the check values and schedules the test notifications (asks for permission once).
    @objc func write(_ call: CAPPluginCall) {
        Probe.write()
        Probe.scheduleNotifications { granted in call.resolve(["notifications": granted]) }
    }

    @objc func clear(_ call: CAPPluginCall) {
        Probe.clear()
        call.resolve()
    }
}
#endif
