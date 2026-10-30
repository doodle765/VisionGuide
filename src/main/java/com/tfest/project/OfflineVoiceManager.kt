package com.tfest.project

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Log
import org.json.JSONObject
import org.vosk.Model
import org.vosk.Recognizer
import org.vosk.android.RecognitionListener
import org.vosk.android.SpeechService
import org.vosk.android.StorageService

class OfflineVoiceManager(
    private val context: Context,
    private val onResultCallback: (String) -> Unit
) : RecognitionListener {

    private var model: Model? = null
    private var speechService: SpeechService? = null
    private var isListening = false
    private var lastSentText: String = ""
    private var lastSentTime: Long = 0L
    private val mainHandler = Handler(Looper.getMainLooper())

    fun initialize(onReady: (() -> Unit)? = null) {
        StorageService.unpack(
            context,
            "model-en-us",
            "model",
            { loadedModel: Model ->
                this.model = loadedModel
                Log.d("OfflineVoiceManager", "Vosk model unpacked successfully")
                onReady?.invoke()
            },
            { exception: Exception ->
                Log.e("OfflineVoiceManager", "Failed to unpack Vosk model", exception)
            }
        )
    }

    @Synchronized
    fun startListening(): Boolean {
        val currentModel = model
        if (currentModel == null) {
            Log.w("OfflineVoiceManager", "Model not initialized yet")
            return false
        }

        if (isListening && speechService != null) {
            return true
        }

        try {
            val grammar = "[\"language\", \"english\", \"urdu\", \"repeat\", \"location\", \"[unk]\"]"
            val recognizer = Recognizer(currentModel, 16000.0f, grammar)
            speechService = SpeechService(recognizer, 16000.0f)
            lastSentText = ""
            isListening = true
            speechService?.startListening(this)
            Log.d("OfflineVoiceManager", "Started continuous listening with Vosk")
            return true
        } catch (e: Exception) {
            Log.e("OfflineVoiceManager", "Failed with grammar, trying fallback recognizer", e)
            try {
                val recognizer = Recognizer(currentModel, 16000.0f)
                speechService = SpeechService(recognizer, 16000.0f)
                lastSentText = ""
                isListening = true
                speechService?.startListening(this)
                return true
            } catch (ex: Exception) {
                Log.e("OfflineVoiceManager", "Fallback speech service failed", ex)
                isListening = false
                return false
            }
        }
    }

    @Synchronized
    fun stopListening() {
        if (isListening) {
            try {
                speechService?.stop()
                speechService?.shutdown()
            } catch (e: Exception) {
                Log.e("OfflineVoiceManager", "Error stopping speech service", e)
            }
            speechService = null
            isListening = false
            Log.d("OfflineVoiceManager", "Stopped listening")
        }
    }

    override fun onPartialResult(hypothesis: String?) {
        processResult(hypothesis, isPartial = true)
    }

    override fun onResult(hypothesis: String?) {
        processResult(hypothesis, isPartial = false)
    }

    override fun onFinalResult(hypothesis: String?) {
        processResult(hypothesis, isPartial = false)
    }

    override fun onError(exception: Exception?) {
        Log.e("OfflineVoiceManager", "Vosk error", exception)
        restartListeningDelayed()
    }

    override fun onTimeout() {
        Log.d("OfflineVoiceManager", "Vosk timeout")
        restartListeningDelayed()
    }

    private fun restartListeningDelayed() {
        stopListening()
        mainHandler.postDelayed({
            startListening()
        }, 500)
    }

    private fun processResult(hypothesis: String?, isPartial: Boolean) {
        if (hypothesis.isNullOrEmpty()) return
        try {
            val json = JSONObject(hypothesis)
            val text = if (json.has("text")) {
                json.optString("text", "")
            } else if (json.has("partial")) {
                json.optString("partial", "")
            } else {
                ""
            }.trim().lowercase()

            val now = System.currentTimeMillis()
            if (text.isNotEmpty() && text != "[unk]") {
                val targets = listOf("language", "english", "urdu", "repeat", "location")
                val matched = targets.find { text.contains(it) } ?: if (!isPartial) text else null

                if (matched != null && (matched != lastSentText || now - lastSentTime > 3000)) {
                    lastSentText = matched
                    lastSentTime = now
                    Log.d("OfflineVoiceManager", "Recognized command: $matched")
                    onResultCallback(matched)
                }
            }
        } catch (e: Exception) {
            Log.e("OfflineVoiceManager", "Error parsing result JSON", e)
        }
    }

    fun destroy() {
        stopListening()
        speechService = null
    }
}
