package com.boundly.app.enforcement

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.view.Gravity
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import com.boundly.app.MainActivity

class BoundlyLockActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    val blockedPackage = intent.getStringExtra(EXTRA_BLOCKED_PACKAGE) ?: "this app"

    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      setPadding(64, 64, 64, 64)
    }

    val title = TextView(this).apply {
      text = "Boundly blocked ${blockedPackage}"
      textSize = 20f
      gravity = Gravity.CENTER
    }

    val description = TextView(this).apply {
      text = "Usage limits or schedule rules are active. Open Boundly to review or use emergency override."
      textSize = 15f
      gravity = Gravity.CENTER
    }

    val openBoundlyButton = Button(this).apply {
      text = "Open Boundly"
      setOnClickListener {
        val appIntent = Intent(this@BoundlyLockActivity, MainActivity::class.java).apply {
          flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        startActivity(appIntent)
        finish()
      }
    }

    root.addView(title)
    root.addView(description)
    root.addView(openBoundlyButton)
    setContentView(root)
  }

  companion object {
    const val EXTRA_BLOCKED_PACKAGE = "blocked_package"
  }
}
