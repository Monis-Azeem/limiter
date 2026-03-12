package com.boundly.app.enforcement

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.TypedValue
import android.view.Gravity
import android.view.View
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
      countdownText.text = "Closing in ${secondsRemaining}s"
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
      setPadding(0, 0, 0, 0)
      setBackgroundColor(Color.parseColor("#E8000000"))
    }

    val card = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      setPadding(dpToPx(32), dpToPx(36), dpToPx(32), dpToPx(28))
      val marginParams = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        LinearLayout.LayoutParams.WRAP_CONTENT
      ).apply {
        setMargins(dpToPx(24), 0, dpToPx(24), 0)
      }
      layoutParams = marginParams
      background = GradientDrawable().apply {
        shape = GradientDrawable.RECTANGLE
        cornerRadius = dpToPx(20).toFloat()
        setColor(Color.WHITE)
      }
    }

    val blockedIcon = TextView(this).apply {
      text = "\u23F1"
      textSize = 40f
      gravity = Gravity.CENTER
      setPadding(0, 0, 0, dpToPx(8))
    }

    val title = TextView(this).apply {
      text = "$blockedAppName"
      textSize = 22f
      setTypeface(Typeface.create("sans-serif-medium", Typeface.BOLD))
      gravity = Gravity.CENTER
      setTextColor(Color.parseColor("#0F172A"))
    }

    val subtitle = TextView(this).apply {
      text = "Time limit reached"
      textSize = 15f
      gravity = Gravity.CENTER
      setTypeface(Typeface.create("sans-serif", Typeface.NORMAL))
      setTextColor(Color.parseColor("#DC2626"))
      setPadding(0, dpToPx(4), 0, 0)
    }

    val reasonText = TextView(this).apply {
      text = reason
      textSize = 13f
      gravity = Gravity.CENTER
      setTypeface(Typeface.create("sans-serif", Typeface.NORMAL))
      setTextColor(Color.parseColor("#64748B"))
      setPadding(0, dpToPx(4), 0, dpToPx(16))
    }

    val divider = View(this).apply {
      layoutParams = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        dpToPx(1)
      ).apply {
        setMargins(0, 0, 0, dpToPx(16))
      }
      setBackgroundColor(Color.parseColor("#F1F5F9"))
    }

    val quoteText = TextView(this).apply {
      text = "\u201C$quote\u201D"
      textSize = 17f
      gravity = Gravity.CENTER
      setTypeface(Typeface.create("serif", Typeface.ITALIC))
      setTextColor(Color.parseColor("#1E293B"))
      setPadding(dpToPx(8), 0, dpToPx(8), dpToPx(20))
      setLineSpacing(dpToPx(4).toFloat(), 1f)
    }

    countdownText = TextView(this).apply {
      textSize = 13f
      gravity = Gravity.CENTER
      setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL))
      setTextColor(Color.parseColor("#94A3B8"))
      setPadding(0, 0, 0, dpToPx(12))
    }

    val manageLink = TextView(this).apply {
      text = "Manage limits"
      textSize = 13f
      gravity = Gravity.CENTER
      setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL))
      setTextColor(Color.parseColor("#3B82F6"))
      setPadding(0, 0, 0, 0)
      setOnClickListener {
        handler.removeCallbacks(countdownRunnable)
        val appIntent = Intent(this@BoundlyLockActivity, MainActivity::class.java).apply {
          flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        startActivity(appIntent)
        finish()
      }
    }

    card.addView(blockedIcon)
    card.addView(title)
    card.addView(subtitle)
    card.addView(reasonText)
    card.addView(divider)
    card.addView(quoteText)
    card.addView(countdownText)
    card.addView(manageLink)
    root.addView(card)
    setContentView(root)
    handler.post(countdownRunnable)
  }

  override fun onDestroy() {
    handler.removeCallbacks(countdownRunnable)
    super.onDestroy()
  }

  @Suppress("DEPRECATION")
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

  private fun dpToPx(dp: Int): Int {
    return TypedValue.applyDimension(
      TypedValue.COMPLEX_UNIT_DIP,
      dp.toFloat(),
      resources.displayMetrics
    ).toInt()
  }

  companion object {
    const val EXTRA_BLOCKED_PACKAGE = "blocked_package"
    const val EXTRA_BLOCK_REASON = "block_reason"
    private const val AUTO_CLOSE_SECONDS = 6
  }
}
