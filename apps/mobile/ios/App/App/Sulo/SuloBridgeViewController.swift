import Capacitor
import UIKit

/// The app's web view, with Sulo's own plugins (Capacitor's are found on their own).
class SuloBridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(SuloStorePlugin())
        bridge?.registerPluginInstance(SuloSessionPlugin())
        bridge?.registerPluginInstance(SuloProbePlugin())
    }
}
