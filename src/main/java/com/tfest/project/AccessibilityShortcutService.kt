package com.tfest.project

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.view.KeyEvent
import android.view.accessibility.AccessibilityEvent

class AccessibilityShortcutService : AccessibilityService() {

    private var volumeUpPressed = false
    private var volumeDownPressed = false
    private var lastPressTime = 0L

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        // Not needed for global key interception
    }

    override fun onInterrupt() {
        // Required override
    }

    override fun onKeyEvent(event: KeyEvent): Boolean {
        val keyCode = event.keyCode
        val action = event.action
        val currentTime = System.currentTimeMillis()

        if (keyCode == KeyEvent.KEYCODE_VOLUME_UP) {
            if (action == KeyEvent.ACTION_DOWN) {
                volumeUpPressed = true
            } else if (action == KeyEvent.ACTION_UP) {
                volumeUpPressed = false
            }
        }

        if (keyCode == KeyEvent.KEYCODE_VOLUME_DOWN) {
            if (action == KeyEvent.ACTION_DOWN) {
                volumeDownPressed = true
            } else if (action == KeyEvent.ACTION_UP) {
                volumeDownPressed = false
            }
        }

        // Check if both volume up and volume down are pressed simultaneously
        if (volumeUpPressed && volumeDownPressed) {
            if (currentTime - lastPressTime > 1000) { // debounce 1 second
                lastPressTime = currentTime
                launchApp()
                return true // consume event
            }
        }

        return super.onKeyEvent(event)
    }

    private fun launchApp() {
        val intent = Intent(this, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }
        startActivity(intent)
    }
}
