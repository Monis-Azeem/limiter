package com.boundly.app.enforcement

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import com.boundly.app.MainActivity

class BoundlyLockActivity : Activity() {
  private val handler = Handler(Looper.getMainLooper())
  private val quoteRepository by lazy { QuoteRepository(this) }
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
    val blockedAppName = resolveAppLabel(blockedPackage)
    val reason = intent.getStringExtra(EXTRA_BLOCK_REASON) ?: "Daily limit reached"
    val quote = quoteRepository.nextQuote()

    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      setPadding(56, 56, 56, 56)
      background = GradientDrawable(
        GradientDrawable.Orientation.TOP_BOTTOM,
        intArrayOf(Color.parseColor("#EAF1FF"), Color.parseColor("#F6FBFF"))
      )
    }

    val card = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      setPadding(48, 52, 48, 52)
      background = GradientDrawable().apply {
        shape = GradientDrawable.RECTANGLE
        cornerRadius = 28f
        setColor(Color.WHITE)
        setStroke(2, Color.parseColor("#E2E8F0"))
      }
    }

    val title = TextView(this).apply {
      text = "Time limit reached"
      textSize = 24f
      setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL))
      gravity = Gravity.CENTER
      setTextColor(Color.parseColor("#0F172A"))
    }

    val appText = TextView(this).apply {
      text = "$blockedAppName is blocked for now."
      textSize = 15f
      gravity = Gravity.CENTER
      setTypeface(Typeface.create("sans-serif", Typeface.NORMAL))
      setTextColor(Color.parseColor("#334155"))
      setPadding(0, 12, 0, 0)
    }

    val reasonText = TextView(this).apply {
      text = reason
      textSize = 14f
      gravity = Gravity.CENTER
      setTypeface(Typeface.create("sans-serif", Typeface.NORMAL))
      setTextColor(Color.parseColor("#475569"))
      setPadding(0, 8, 0, 12)
    }

    val quoteText = TextView(this).apply {
      text = "“$quote”"
      textSize = 19f
      gravity = Gravity.CENTER
      setTypeface(Typeface.create("serif", Typeface.ITALIC))
      setTextColor(Color.parseColor("#0F172A"))
      setPadding(0, 16, 0, 22)
    }

    countdownText = TextView(this).apply {
      textSize = 13f
      gravity = Gravity.CENTER
      setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL))
      setTextColor(Color.parseColor("#2563EB"))
    }

    val openBoundlyButton = Button(this).apply {
      text = "Open Boundly"
      setAllCaps(false)
      setOnClickListener {
        handler.removeCallbacks(countdownRunnable)
        val appIntent = Intent(this@BoundlyLockActivity, MainActivity::class.java).apply {
          flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        startActivity(appIntent)
        finish()
      }
    }

    card.addView(title)
    card.addView(appText)
    card.addView(reasonText)
    card.addView(quoteText)
    card.addView(countdownText)
    card.addView(openBoundlyButton)
    root.addView(card)
    setContentView(root)
    handler.post(countdownRunnable)
  }

  override fun onDestroy() {
    handler.removeCallbacks(countdownRunnable)
    super.onDestroy()
  }

  override fun onBackPressed() {
    openHomeAndFinish()
  }

  private fun openHomeAndFinish() {
    val homeIntent = Intent(Intent.ACTION_MAIN).apply {
      addCategory(Intent.CATEGORY_HOME)
      flags = Intent.FLAG_ACTIVITY_NEW_TASK
    }
    startActivity(homeIntent)
    finish()
  }

  private fun resolveAppLabel(packageName: String): String {
    return runCatching {
      val appInfo = packageManager.getApplicationInfo(packageName, 0)
      packageManager.getApplicationLabel(appInfo).toString()
    }.getOrDefault(packageName)
  }

  companion object {
    const val EXTRA_BLOCKED_PACKAGE = "blocked_package"
    const val EXTRA_BLOCK_REASON = "block_reason"
    private const val AUTO_CLOSE_SECONDS = 6
  }
}
