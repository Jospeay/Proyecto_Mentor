/**
 * Shared Groq API client (OpenAI-compatible) with model fallback chain.
 * Tries models in order; first successful response wins.
 */

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// ── Model preference order: best quality → fastest fallback ──────────────────
const MODEL_FALLBACK_CHAIN = [
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
];

/**
 * Calls Groq chat/completions with the given messages and returns the text.
 *
 * @param {Object} opts
 * @param {string} opts.prompt       - User message text
 * @param {string} opts.apiKey       - Groq API key (Bearer token)
 * @param {string} [opts.systemPrompt] - Optional system message
 * @param {Object} [opts.generationConfig] - Optional overrides (temperature, max_tokens, etc.)
 * @param {string[]} [opts.models]   - Override model fallback chain
 * @returns {Promise<{success: boolean, source: string, response: string}>}
 */
async function callAI({ prompt, apiKey, systemPrompt, generationConfig = {}, models }) {
  if (!apiKey) throw new Error('Groq API key is required');

  const modelList = models || [...MODEL_FALLBACK_CHAIN];

  console.log('[aiClient] Enviando a Groq:', { models: modelList, promptLength: prompt.length });
  let lastError;

  for (const model of modelList) {
    try {
      const messages = [];
      if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
      }
      messages.push({ role: 'user', content: prompt });

      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: generationConfig.temperature ?? 0.3,
          max_tokens: generationConfig.maxOutputTokens ?? 2048,
          top_p: generationConfig.topP ?? 0.8,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const msg = errData.error?.message || `HTTP ${response.status}`;
        console.debug(`[aiClient] Groq [${model}]:`, msg);

        // 404 / model not found → try next model
        if (response.status === 404 || msg.includes('not found') || msg.includes('model_not_found')) {
          lastError = new Error(`Model ${model}: ${msg}`);
          continue;
        }
        // 401 / 403 → credentials error, don't retry
        if (response.status === 401 || response.status === 403 ||
            msg.includes('denied') || msg.includes('disabled') ||
            msg.includes('permission') || msg.includes('API key not valid') ||
            msg.includes('Invalid API Key')) {
          throw new Error('CREDENTIALS_ERROR: ' + msg);
        }
        // 429 / rate-limit → try next model
        if (response.status === 429 || msg.includes('quota') || msg.includes('rate') || msg.includes('rate_limit')) {
          lastError = new Error(`Model ${model}: ${msg}`);
          continue;
        }
        throw new Error(msg);
      }

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content;
      if (!text) throw new Error('Empty response from Groq');

      console.log('[aiClient] Respuesta Groq:', { model, responseLength: text.length });
      return { success: true, source: model, response: text };
    } catch (err) {
      lastError = err;
      console.debug(`[aiClient] Groq [${model}]:`, err.message);
      if (err.message.includes('CREDENTIALS_ERROR')) throw err;
      if (err.message.includes('not found') || err.message.includes('404')) continue;
      // For non-retryable errors, bubble up immediately
      if (!err.message.includes('429') && !err.message.includes('rate') && !err.message.includes('quota')) {
        throw err;
      }
    }
  }

  throw lastError || new Error('All Groq models failed');
}

/**
 * @deprecated Use callAI instead. Kept for backward compatibility.
 */
const callGemini = callAI;

module.exports = { callAI, callGemini, MODEL_FALLBACK_CHAIN, GROQ_API_URL };
