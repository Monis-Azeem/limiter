package com.boundly.app.enforcement

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import com.boundly.app.MainActivity
import java.time.LocalDate

class BoundlyLockActivity : Activity() {
  private val handler = Handler(Looper.getMainLooper())
  private var secondsRemaining = AUTO_CLOSE_SECONDS
  private lateinit var countdownText: TextView

  private val countdownRunnable = object : Runnable {
    override fun run() {
      if (secondsRemaining <= 0) {
        openHomeAndFinish()
        return
      }
      countdownText.text = "Returning to Home in ${secondsRemaining}s"
      secondsRemaining -= 1
      handler.postDelayed(this, 1_000L)
    }
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    val blockedPackage = intent.getStringExtra(EXTRA_BLOCKED_PACKAGE) ?: "this app"
    val reason = intent.getStringExtra(EXTRA_BLOCK_REASON) ?: "Daily limit reached"
    val quote = pickQuote(blockedPackage)

    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      setPadding(72, 72, 72, 72)
    }

    val title = TextView(this).apply {
      text = "Take a short break"
      textSize = 22f
      gravity = Gravity.CENTER
    }

    val appText = TextView(this).apply {
      text = "$blockedPackage is blocked right now."
      textSize = 15f
      gravity = Gravity.CENTER
    }

    val reasonText = TextView(this).apply {
      text = reason
      textSize = 14f
      gravity = Gravity.CENTER
    }

    val quoteText = TextView(this).apply {
      text = quote
      textSize = 14f
      gravity = Gravity.CENTER
      setPadding(0, 24, 0, 8)
    }

    countdownText = TextView(this).apply {
      textSize = 13f
      gravity = Gravity.CENTER
    }

    val openBoundlyButton = Button(this).apply {
      text = "Open Boundly"
      setOnClickListener {
        handler.removeCallbacks(countdownRunnable)
        val appIntent = Intent(this@BoundlyLockActivity, MainActivity::class.java).apply {
          flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        startActivity(appIntent)
        finish()
      }
    }

    root.addView(title)
    root.addView(appText)
    root.addView(reasonText)
    root.addView(quoteText)
    root.addView(countdownText)
    root.addView(openBoundlyButton)
    setContentView(root)
    handler.post(countdownRunnable)
  }

  override fun onDestroy() {
    handler.removeCallbacks(countdownRunnable)
    super.onDestroy()
  }

  private fun pickQuote(seed: String): String {
    val quotes = listOf(
      "Small breaks now protect your focus later.",
      "Attention grows where time is protected.",
      "Your goals need minutes more than your feed does.",
      "A short pause can reset your whole day.",
      "Use your phone on purpose, not on autopilot."
    )
    val daySeed = LocalDate.now().toString()
    val rawIndex = (seed + daySeed).hashCode().toLong() and 0x7fffffff
    val index = (rawIndex % quotes.size.toLong()).toInt()
    return quotes[index]
  }

  private fun openHomeAndFinish() {
    val homeIntent = Intent(Intent.ACTION_MAIN).apply {
      addCategory(Intent.CATEGORY_HOME)
      flags = Intent.FLAG_ACTIVITY_NEW_TASK
    }
    startActivity(homeIntent)
    finish()
  }

  companion object {
    const val EXTRA_BLOCKED_PACKAGE = "blocked_package"
    const val EXTRA_BLOCK_REASON = "block_reason"
    private const val AUTO_CLOSE_SECONDS = 6
  }
}
