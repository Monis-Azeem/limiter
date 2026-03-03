package com.boundly.app.enforcement

import android.content.Context
import com.boundly.app.R
import org.json.JSONArray

class QuoteRepository(
  private val context: Context,
  private val policyStore: BoundlyPolicyStore = BoundlyPolicyStore(context)
) {
  @Volatile
  private var cachedQuotes: List<String>? = null

  fun nextQuote(): String {
    val quotes = loadQuotes()
    if (quotes.isEmpty()) {
      return FALLBACK_QUOTES[0]
    }
    val index = policyStore.getAndAdvanceQuoteIndex(quotes.size)
    return quotes.getOrElse(index) { quotes[0] }
  }

  private fun loadQuotes(): List<String> {
    val existing = cachedQuotes
    if (existing != null) {
      return existing
    }

    synchronized(this) {
      val secondCheck = cachedQuotes
      if (secondCheck != null) {
        return secondCheck
      }

      val parsed = runCatching {
        val rawJson = context.resources
          .openRawResource(R.raw.mobile_wellbeing_quotes)
          .bufferedReader(Charsets.UTF_8)
          .use { reader -> reader.readText() }
        val jsonArray = JSONArray(rawJson)
        buildList {
          for (index in 0 until jsonArray.length()) {
            val quote = jsonArray.optString(index, "").trim()
            if (quote.isNotBlank()) {
              add(quote)
            }
          }
        }
      }.getOrElse {
        FALLBACK_QUOTES
      }

      val normalized = if (parsed.isEmpty()) FALLBACK_QUOTES else parsed
      cachedQuotes = normalized
      return normalized
    }
  }

  companion object {
    private val FALLBACK_QUOTES = listOf(
      "Your attention is your most valuable resource.",
      "Use your phone with purpose, not impulse.",
      "Small pauses can reset your whole day.",
      "Protect your time like your future depends on it.",
      "Less scrolling, more living."
    )
  }
}
