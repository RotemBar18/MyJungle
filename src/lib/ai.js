/**
 * Bring-your-own-key AI layer.
 *
 * Three providers behind one `chat()` call. Each person supplies their own key,
 * so nobody's usage lands on anyone else's bill and the app needs no backend of
 * its own — the browser talks to the provider directly.
 *
 * Raw fetch rather than three official SDKs on purpose: we use exactly one
 * endpoint per provider, and bundling three SDKs into a phone-first PWA would
 * cost far more than the ~40 lines each adapter takes.
 *
 * Where the key lives: `localStorage`, on that device only. It is never written
 * to Firestore, so it is not shared with the other members of a jungle and it
 * never leaves the machine it was typed on. The trade-off is that it is stored
 * per-device and is readable by any script running on this origin — acceptable
 * for a personal key the owner chose to paste in, and the reason the settings
 * screen says so plainly.
 */

export const PROVIDERS = {
  gemini: {
    id: 'gemini',
    label: 'Google Gemini',
    free: true,
    defaultModel: 'gemini-flash-latest',
    keyUrl: 'https://aistudio.google.com/apikey',
    keyHint: 'AIza…',
  },
  openai: {
    id: 'openai',
    label: 'OpenAI',
    free: false,
    defaultModel: 'gpt-5',
    keyUrl: 'https://platform.openai.com/api-keys',
    keyHint: 'sk-…',
  },
  anthropic: {
    id: 'anthropic',
    label: 'Claude',
    free: false,
    defaultModel: 'claude-opus-5',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    keyHint: 'sk-ant-…',
  },
};

export const PROVIDER_IDS = Object.keys(PROVIDERS);

const SETTINGS_KEY = 'myjungle.ai';

export function loadAiSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    const provider = PROVIDERS[raw.provider] ? raw.provider : 'gemini';
    return {
      provider,
      apiKey: typeof raw.apiKey === 'string' ? raw.apiKey : '',
      model: raw.model || PROVIDERS[provider].defaultModel,
    };
  } catch {
    return { provider: 'gemini', apiKey: '', model: PROVIDERS.gemini.defaultModel };
  }
}

export const AI_SETTINGS_EVENT = 'myjungle:ai-settings';

export function saveAiSettings(s) {
  try {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ provider: s.provider, apiKey: s.apiKey, model: s.model }),
    );
  } catch {
    /* private browsing — the key simply will not persist */
  }
  // Lets the React layer notice a change made from outside it (see the retry in
  // `chat()`), so the settings screen never shows a model the app stopped using.
  window.dispatchEvent(new CustomEvent(AI_SETTINGS_EVENT, { detail: s }));
}

export const hasAiKey = () => Boolean(loadAiSettings().apiKey.trim());

/* ------------------------------------------------------------------- usage */

const USAGE_KEY = 'myjungle.ai.usage';

/**
 * A local tally of requests made today.
 *
 * No provider exposes "how much of my free quota is left", so this is the only
 * honest signal available: count what this device sent, show it next to the
 * provider's published daily limit, and be explicit that it counts this browser
 * only. It is a guide, not an accounting.
 */
export function readUsage() {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const u = JSON.parse(localStorage.getItem(USAGE_KEY) || '{}');
    return u.date === today ? { date: today, count: u.count || 0 } : { date: today, count: 0 };
  } catch {
    return { date: today, count: 0 };
  }
}

function countRequest() {
  const u = readUsage();
  try {
    localStorage.setItem(USAGE_KEY, JSON.stringify({ date: u.date, count: u.count + 1 }));
  } catch {
    /* private mode */
  }
}

/** Published free-tier ceilings, for context next to the tally. Null = paid only. */
export const FREE_DAILY_LIMIT = { gemini: 250, openai: null, anthropic: null };

/** Thrown with a `key` an i18n dictionary can translate. */
export class AiError extends Error {
  constructor(key, detail) {
    super(detail || key);
    this.key = key;
    this.detail = detail;
    // Providers that retire a model usually name its replacement in the error.
    // Carrying that out means the app can heal itself instead of asking the
    // owner to work out which of thirty-five models to pick.
    this.suggestedModel = suggestedModel(detail);
  }
}

function suggestedModel(detail = '') {
  const m = String(detail).match(/use\s+(?:models\/)?([a-z0-9][\w.-]{3,60})/i);
  return m ? m[1].replace(/[.,]$/, '') : null;
}

/**
 * One call, three providers.
 *
 * @param {object}  opts
 * @param {string}  opts.system     system / instruction prompt
 * @param {string}  opts.prompt     the user's turn
 * @param {Array}   opts.history    prior [{role:'user'|'assistant', text}]
 * @param {object}  opts.image      { base64, mimeType } — optional
 * @param {boolean} opts.json       ask the provider for a JSON object back
 * @returns {Promise<string>} raw text (JSON string when `json` is set)
 */
export async function chat({ system, prompt, history = [], image, json = false, signal, _retried } = {}) {
  const settings = loadAiSettings();
  const { provider, apiKey, model } = settings;
  if (!apiKey.trim()) throw new AiError('ai.errors.noKey');

  const adapter = ADAPTERS[provider];
  const started = Date.now();
  countRequest();
  try {
    const text = await adapter({ apiKey: apiKey.trim(), model, system, prompt, history, image, json, signal });
    if (!text) throw new AiError('ai.errors.empty');
    return text;
  } catch (err) {
    // Providers retire models. When one names its replacement, switch to it and
    // try again rather than handing the owner a dead end — once only, so a
    // provider that keeps redirecting cannot loop.
    if (err instanceof AiError && err.suggestedModel && err.suggestedModel !== model && !_retried) {
      saveAiSettings({ ...settings, model: err.suggestedModel });
      return chat({ system, prompt, history, image, json, signal, _retried: true });
    }
    if (err instanceof AiError) throw err;
    if (err.name === 'AbortError') throw new AiError('ai.errors.aborted');
    // A failed fetch with no status is almost always the network or a CORS
    // rejection, which for these three providers means "offline" in practice.
    if (!navigator.onLine) throw new AiError('ai.errors.offline');
    throw new AiError('ai.errors.network', `${err.message} (${Date.now() - started}ms)`);
  }
}

/** Cheap round trip used by the "test this key" button. */
export async function testKey() {
  const text = await chat({
    system: 'Reply with the single word OK.',
    prompt: 'Say OK.',
  });
  return text.trim().slice(0, 40);
}

/* ------------------------------------------------------------------ helpers */

async function readError(res) {
  let detail = '';
  try {
    const body = await res.json();
    detail = body?.error?.message || body?.message || JSON.stringify(body).slice(0, 400);
  } catch {
    detail = (await res.text().catch(() => '')).slice(0, 400);
  }
  // Classify on status first. An earlier version also matched /model/i anywhere
  // in the text, which swallowed the real reason for every error whose message
  // merely mentioned the word — including key problems, whose URLs contain
  // "models/". Only a 404, or a message that explicitly says the model was not
  // found, counts as a bad model name.
  // Google answers 400 (not 401/403) for a rejected key, so the reason has to be
  // read out of the body rather than inferred from the status alone.
  if (
    res.status === 401 ||
    res.status === 403 ||
    /api key not valid|api_key_invalid|invalid api key|incorrect api key|permission denied/i.test(detail)
  )
    throw new AiError('ai.errors.badKey', detail);
  if (res.status === 429 || /quota|rate limit|resource_exhausted/i.test(detail))
    throw new AiError('ai.errors.rateLimit', detail);
  if (/has not been used in project|is disabled|SERVICE_DISABLED/i.test(detail))
    throw new AiError('ai.errors.apiDisabled', detail);
  if (res.status === 404 || /model .*(not found|does not exist|not supported)|unknown model|invalid model/i.test(detail))
    throw new AiError('ai.errors.badModel', detail);
  if (res.status >= 500) throw new AiError('ai.errors.providerDown', detail);
  throw new AiError('ai.errors.request', detail);
}

/**
 * Ask the provider which models this key can actually use.
 *
 * Hard-coding model names is a losing game in a bring-your-own-key app: they
 * differ by provider, change over time, and vary by what a given key is
 * entitled to. Every provider exposes a list endpoint, so the settings screen
 * asks instead of guessing.
 */
export async function listModels() {
  const { provider, apiKey } = loadAiSettings();
  if (!apiKey.trim()) throw new AiError('ai.errors.noKey');
  const key = apiKey.trim();

  if (provider === 'gemini') {
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', {
      headers: { 'x-goog-api-key': key },
    });
    if (!res.ok) await readError(res);
    const data = await res.json();
    return (data.models || [])
      .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map((m) => String(m.name).replace(/^models\//, ''))
      // The catalogue also carries image, music, speech, robotics and research
      // models that cannot answer a chat turn about a plant.
      .filter(
        (id) =>
          !/embedding|aqa|imagen|veo|tts|image|lyria|banana|robotics|transcribe|computer-use|deep-research|antigravity|gemma/i.test(
            id,
          ),
      )
      .sort();
  }

  if (provider === 'openai') {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) await readError(res);
    const data = await res.json();
    return (data.data || [])
      .map((m) => m.id)
      .filter((id) => /^(gpt|o\d|chatgpt)/i.test(id) && !/embed|audio|tts|whisper|image|moderation|realtime/i.test(id))
      .sort();
  }

  const res = await fetch('https://api.anthropic.com/v1/models?limit=100', {
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
  });
  if (!res.ok) await readError(res);
  const data = await res.json();
  return (data.data || []).map((m) => m.id).sort();
}

/* ---------------------------------------------------------------- adapters */

const ADAPTERS = {
  /** Google AI Studio — the only one of the three with a standing free tier. */
  async gemini({ apiKey, model, system, prompt, history, image, json, signal }) {
    const contents = history.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.text }],
    }));
    const parts = [];
    if (image) parts.push({ inline_data: { mime_type: image.mimeType, data: image.base64 } });
    parts.push({ text: prompt });
    contents.push({ role: 'user', parts });

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents,
          ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
          generationConfig: {
            maxOutputTokens: 2048,
            ...(json ? { responseMimeType: 'application/json' } : {}),
          },
        }),
      },
    );
    if (!res.ok) await readError(res);
    const data = await res.json();
    if (data.promptFeedback?.blockReason) throw new AiError('ai.errors.blocked');
    return (data.candidates?.[0]?.content?.parts || [])
      .map((p) => p.text || '')
      .join('')
      .trim();
  },

  async openai({ apiKey, model, system, prompt, history, image, json, signal }) {
    const messages = [];
    if (system) messages.push({ role: 'system', content: system });
    for (const m of history) messages.push({ role: m.role, content: m.text });
    const content = [{ type: 'text', text: prompt }];
    if (image) {
      content.push({
        type: 'image_url',
        image_url: { url: `data:${image.mimeType};base64,${image.base64}` },
      });
    }
    messages.push({ role: 'user', content });

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages,
        max_completion_tokens: 2048,
        ...(json ? { response_format: { type: 'json_object' } } : {}),
      }),
    });
    if (!res.ok) await readError(res);
    const data = await res.json();
    return (data.choices?.[0]?.message?.content || '').trim();
  },

  async anthropic({ apiKey, model, system, prompt, history, image, json, signal }) {
    const messages = history.map((m) => ({ role: m.role, content: m.text }));
    const content = [];
    if (image) {
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: image.mimeType, data: image.base64 },
      });
    }
    // Anthropic has no JSON response mode; the instruction carries it instead.
    content.push({ type: 'text', text: json ? `${prompt}\n\nReply with JSON only — no prose, no code fences.` : prompt });
    messages.push({ role: 'user', content });

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        // Required for calls made straight from a browser.
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({ model, max_tokens: 2048, ...(system ? { system } : {}), messages }),
    });
    if (!res.ok) await readError(res);
    const data = await res.json();
    return (data.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();
  },
};

/**
 * Models sometimes wrap JSON in prose or a code fence despite being told not to.
 * Pull the first balanced object out rather than failing the whole interaction.
 */
export function parseJson(text) {
  const cleaned = text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        /* fall through */
      }
    }
    throw new AiError('ai.errors.badJson', text.slice(0, 200));
  }
}

/** Blob → the base64 payload these APIs expect (no data: prefix). */
export function toBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}
