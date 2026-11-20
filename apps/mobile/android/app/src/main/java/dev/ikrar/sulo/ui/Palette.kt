package dev.ikrar.sulo.ui

import android.app.Activity
import android.content.res.Configuration
import android.graphics.Color

/** The app's tokens (tokens.css) for the system theme, for the native screens (SIKOLA and NEOSIA pages). */
internal class Palette(val screen: Int, val card: Int, val inset: Int, val line: Int, val text: Int, val muted: Int, val dark: Boolean = false) {
    /**
     * The system bars in the screen's own colors: the status bar as the top
     * bar (card), the navigation bar as the screen, dark icons on light. Without
     * it the theme's grey status bar showed above the white bar (emulator, 20 Nov 2026).
     */
    @Suppress("DEPRECATION")
    fun applyTo(a: Activity, root: android.view.View) {
        a.window.statusBarColor = card
        a.window.navigationBarColor = screen
        androidx.core.view.WindowInsetsControllerCompat(a.window, root).apply {
            isAppearanceLightStatusBars = !dark
            isAppearanceLightNavigationBars = !dark
        }
    }

    companion object {
        fun of(a: Activity): Palette {
            val dark = (a.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
            return if (dark) Palette(Color.parseColor("#0B0B0E"), Color.parseColor("#17171C"), Color.parseColor("#232329"), Color.parseColor("#2C2C34"), Color.parseColor("#F2F2F5"), Color.parseColor("#8A8A96"), dark = true)
            else Palette(Color.parseColor("#F1F1F4"), Color.parseColor("#FFFFFF"), Color.parseColor("#E7E7EC"), Color.parseColor("#E3E3E9"), Color.parseColor("#111114"), Color.parseColor("#5F5F6B"))
        }
    }
}
