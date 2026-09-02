/**
 * Shared Gemini API client with model fallback chain.
 * Tries models in order; first successful response wins.
 *
 * v2: Added getAvailableModel() — calls Gemini ListModels API, caches
 * available model IDs on disk for 24h to avoid burning quota on every request.
 * Falls back to the PREFERENCE_ORDER list if the cache can't be built.
 */

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const fs = require('fs');
const path = require('path');
const os = require('os');

// ── Preference order: newest → oldest. Used both as final fallback and as
//    sort key when ranking models returned by ListModels. ──────────────────────
const PREFERENCE_ORDER = [
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
];

// Backwards compat alias — existing code may reference MODEL_FALLBACK_CHAIN
const MODEL_FALLBACK_CHAIN = PREFERENCE_ORDER;

// ── Disk cache helpers ────────────────────────────────────────────────────────
const CACHE_DIR = path.join(os.homedir(), '.proyecto_mentor_data', 'gemini-cache');
const CACHE_FILE = path.join(CACHE_DIR, 'available-models.json');
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function _readCache() {
  try {
    if (!fs.existsSync(CACHE_FILE)) return null;
    const raw = fs.readFileSync(CACHE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed.models || !Array.isArray(parsed.models) || !parsed.ts) return null;
    if (Date.now() - parsed.ts > CACHE_TTL_MS) return null; // expired
    return parsed.models;
  } catch {
    return null;
  }
}

function _writeCache(models) {
  try {
    if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify({ ts: Date.now(), models }, null, 2));
  } catch { /* non-fatal */ }
}

// ── ListModels → filter generateContent-capable → sort by preference ──────────
/**
 * Returns the best available Gemini model ID.
 *
 * 1. Checks the 24h disk cache first.
 * 2. On miss, calls `GET /v1beta/models` to discover every model that
 *    advertises `generateContent` support.
 * 3. Sorts the result by PREFERENCE_ORDER ranking.
 * 4. Writes the sorted list to disk so the next call is instant.
 * 5. On any failure, returns the PREFERENCE_ORDER array as-is.
 *
 * @param {string} apiKey  - Gemini API key
 * @returns {Promise<string[]>} Sorted list of model IDs, best first
 */
async function getAvailableModels(apiKey) {
  if (!apiKey) return [...PREFERENCE_ORDER];

  const cached = _readCache();
  if (cached && cached.length > 0) {
    console.log('[geminiClient] Modelos desde cache:', cached);
    return cached;
  }

  console.log('[geminiClient] Cache miss — llamando ListModels...');
  try {
    const url = `${GEMINI_API_BASE}?key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn('[geminiClient] ListModels HTTP', res.status, '— usando fallback');
      return [...PREFERENCE_ORDER];
    }

    const data = await res.json();
    const allModels = data.models || [];

    // Filter: only models that support generateContent
    const generateContentModels = allModels
      .filter((m) => {
        if (!m.name || !m.supportedGenerationMethods) return false;
        return m.supportedGenerationMethods.includes('generateContent');
      })
      .map((m) => {
        // Strip "models/" prefix — "models/gemini-3.5-flash" → "gemini-3.5-flash"
        const id = m.name.replace(/^models\//, '');
        return id;
      });

    // Sort by preference rank (lower = better). Unknown models get rank Infinity.
    const rankMap = new Map(PREFERENCE_ORDER.map((id, i) => [id, i]));
    generateContentModels.sort((a, b) => (rankMap.get(a) ?? Infinity) - (rankMap.get(b) ?? Infinity));

    if (generateContentModels.length === 0) {
      console.warn('[geminiClient] ListModels devolvió 0 modelos generateContent — usando fallback');
      return [...PREFERENCE_ORDER];
    }

    console.log('[geminiClient] Modelos disponibles (generateContent):', generateContentModels);
    _writeCache(generateContentModels);
    return generateContentModels;
  } catch (err) {
    console.warn('[geminiClient] Error en ListModels:', err.message, '— usando fallback');
    return [...PREFERENCE_ORDER];
  }
}

// ── Core callGemini (unchanged logic, accepts `models` override) ──────────────
async function callGemini({ prompt, apiKey, generationConfig = {}, models }) {
  if (!apiKey) throw new Error('Gemini API key is required');

  const modelList = models || [...PREFERENCE_ORDER];

  console.log('🤖 Enviando a Gemini:', { models: modelList, promptLength: prompt.length });
  let lastError;

  for (const model of modelList) {
    try {
      const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 2048,
            topP: 0.8,
            topK: 40,
            ...generationConfig,
          },
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const msg = errData.error?.message || `HTTP ${response.status}`;
        console.debug(`❌ Gemini [${model}]:`, msg);
        if (response.status === 404 || msg.includes('not found')) {
          lastError = new Error(`Model ${model}: ${msg}`);
          continue;
        }
        if (response.status === 403 || response.status === 401 || msg.includes('denied') || msg.includes('disabled') || msg.includes('permission') || msg.includes('API key not valid')) {
          throw new Error('CREDENTIALS_ERROR: ' + msg);
        }
        // For 429 / rate-limit, keep trying next models
        if (response.status === 429 || msg.includes('quota') || msg.includes('rate')) {
          lastError = new Error(`Model ${model}: ${msg}`);
          continue;
        }
        throw new Error(msg);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('Empty response from Gemini');

      console.log('✅ Respuesta Gemini:', { model, responseLength: text.length });
      return { success: true, source: model, response: text };
    } catch (err) {
      lastError = err;
      console.debug(`❌ Gemini [${model}]:`, err.message);
      if (err.message.includes('not found') || err.message.includes('404')) {
        continue;
      }
      // Credentials errors and other non-retryable errors bubble up immediately
      throw err;
    }
  }

  throw lastError || new Error('All Gemini models failed');
}

module.exports = { callGemini, getAvailableModels, MODEL_FALLBACK_CHAIN, GEMINI_API_BASE, PREFERENCE_ORDER };
