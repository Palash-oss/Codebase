/**
 * aiDesign.controller.js
 * AI-powered System Design generator.
 *
 * Budget-safe design for small scale (2-3 users):
 *  - Sends only ~1,500 tokens of metadata (not full source code)
 *  - In-memory rate limit: 3 requests per IP per hour
 *  - Primary: Gemini Flash  →  Fallback: Groq Llama
 *  - Disk-caches results per repo hash (permanent, zero cost on rescan)
 *  - Cost: ~$0.0003 per diagram generation
 */

import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import os from 'os';

// ─── In-Memory Rate Limiter ────────────────────────────────────────────────
// Structure: { ip: { count: number, windowStart: timestamp } }
const rateLimitMap = new Map();
const RATE_LIMIT_MAX = 3;          // max AI Generate calls per window
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    // New window
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    const resetIn = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - entry.windowStart)) / 60000);
    return { allowed: false, remaining: 0, resetInMinutes: resetIn };
  }
  entry.count += 1;
  return { allowed: true, remaining: RATE_LIMIT_MAX - entry.count };
}

// ─── Cache Setup ───────────────────────────────────────────────────────────
let AI_CACHE_DIR;
try {
  AI_CACHE_DIR = path.join(process.cwd(), '.cache', 'ai-designs');
  if (!fs.existsSync(AI_CACHE_DIR)) fs.mkdirSync(AI_CACHE_DIR, { recursive: true });
} catch {
  AI_CACHE_DIR = path.join(os.tmpdir(), 'codebase-xray-ai-designs');
  if (!fs.existsSync(AI_CACHE_DIR)) fs.mkdirSync(AI_CACHE_DIR, { recursive: true });
}

function getCacheKey(scanResult) {
  const name = scanResult?.project?.name || 'unknown';
  const fileCount = scanResult?.project?.totalFiles || 0;
  const stack = (scanResult?.stack?.detected || []).map(t => t.key).sort().join(',');
  // Simple hash from project identity — not cryptographic, just a stable key
  const raw = `${name}:${fileCount}:${stack}`;
  return raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
}

function readCache(key) {
  try {
    const file = path.join(AI_CACHE_DIR, `${key}.json`);
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
  } catch { /* ignore */ }
  return null;
}

function writeCache(key, data) {
  try {
    const file = path.join(AI_CACHE_DIR, `${key}.json`);
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  } catch { /* ignore cache write failures */ }
}

// ─── Compact Metadata Summary Builder ─────────────────────────────────────
// Builds a ~1,200 token JSON summary — NOT raw source code
function buildMetadataSummary(scanResult) {
  const files = scanResult?.files || [];
  const stack = (scanResult?.stack?.detected || []).map(t => t.key);
  const project = scanResult?.project || {};

  // Collect routes from parsed Python/JS files
  const allRoutes = [];
  files.forEach(f => {
    if (f.routes && f.routes.length > 0) {
      f.routes.forEach(r => allRoutes.push(`${r.method} ${r.path} → ${r.functionName}()`));
    }
  });

  // Collect function signatures (non-private, non-method, max 15)
  const allFunctions = [];
  files.forEach(f => {
    if (f.functions && f.functions.length > 0) {
      f.functions
        .filter(fn => !fn.isMethod && !fn.name.startsWith('_') && fn.name !== 'main')
        .slice(0, 3)
        .forEach(fn => {
          const sig = fn.params.length > 0
            ? `${fn.name}(${fn.params.slice(0, 3).join(', ')})`
            : `${fn.name}()`;
          allFunctions.push(`${f.relativePath}: ${sig}`);
        });
    }
  });

  // Collect ORM schema classes with fields (max 5 models)
  const allSchemas = [];
  files.forEach(f => {
    if (f.schema && f.schema.length > 0) {
      f.schema.forEach(s => {
        allSchemas.push(`${s.model}(${s.fields.slice(0, 6).join(', ')})`);
      });
    }
  });

  // Collect class names
  const allClasses = [];
  files.forEach(f => {
    if (f.classes && f.classes.length > 0) {
      f.classes.filter(c => c !== '__init__').forEach(c => allClasses.push(c));
    }
  });

  // Top-level file structure (max 20 files)
  const fileList = files
    .filter(f => f.relativePath && !f.relativePath.includes('node_modules') && !f.relativePath.includes('.cache'))
    .slice(0, 20)
    .map(f => `${f.relativePath} (${f.layer || 'unknown'}, ${f.lines || 0} lines)`);

  // Env vars (no values — just keys)
  const envVars = [];
  files.forEach(f => {
    if (f.envVars) f.envVars.forEach(v => { if (!envVars.includes(v)) envVars.push(v); });
  });

  return {
    projectName: project.name || 'Unknown Project',
    totalFiles: project.totalFiles || files.length,
    totalLines: project.totalLines || 0,
    techStack: stack,
    fileStructure: fileList,
    apiRoutes: allRoutes.slice(0, 12),
    functions: allFunctions.slice(0, 15),
    ormSchemas: allSchemas.slice(0, 6),
    classes: [...new Set(allClasses)].slice(0, 10),
    envVars: envVars.slice(0, 10)
  };
}

// ─── System Prompt ─────────────────────────────────────────────────────────
function buildPrompt(summary) {
  return `You are an expert software architect. Given the extracted metadata of a real codebase, generate an accurate system design.

CODEBASE METADATA:
${JSON.stringify(summary, null, 2)}

INSTRUCTIONS:
- Analyze the tech stack, API routes, function signatures, and class names carefully.
- Infer the true purpose and architecture of this specific project.
- Do NOT generate generic or templated diagrams. Make it specific to THIS codebase.
- If API routes show POST /chat and POST /quiz → these are actual endpoints, not guesses.
- If two LLM providers exist (e.g. Grok + Gemini), infer if they are alternatives or both used.
- If no relational DB is detected but vector DB is, say so clearly.

Generate a JSON response with EXACTLY this structure:
{
  "projectSummary": "2-3 sentence accurate description of what this project actually does",
  "hld": {
    "description": "What HLD shows for this specific project",
    "components": [
      {
        "id": "unique-id",
        "label": "Component Name",
        "sublabel": "Specific detail (real endpoint paths, actual library calls, real class names)",
        "zone": "client|gateway|backend|data|cloud|ops",
        "zoneLabel": "Zone display name",
        "techKey": "react|flask|fastapi|express|langchain|openai|postgresql|pinecone|redis|etc",
        "connections": ["ids of components this connects TO"]
      }
    ]
  },
  "lld": {
    "description": "What LLD shows for this specific project",
    "components": [
      {
        "id": "lld-unique-id",
        "label": "Implementation Component",
        "sublabel": "Actual function sigs: chat(query), quiz(topic) OR actual table: User(id,email,role)",
        "zone": "client|gateway|backend|data|cloud|ops",
        "zoneLabel": "Zone display name",
        "techKey": "same as above",
        "connections": ["lld-ids this connects TO"]
      }
    ]
  },
  "dbSchema": {
    "hasDatabase": true|false,
    "dbType": "postgresql|mongodb|sqlite|none|vector-only",
    "tables": [
      { "name": "TableName", "fields": ["id", "field1", "field2"], "description": "What this table stores" }
    ],
    "vectorIndex": { "provider": "pinecone|chromadb|faiss|none", "namespace": "how it is namespaced", "embeddingDimensions": "384|1536|etc" }
  }
}

IMPORTANT: 
- Use ONLY real data from the metadata. Do not invent tables, routes, or components not evident in the code.
- Keep sublabels concise (under 80 chars) but specific.
- Zone must be one of: client, gateway, backend, data, cloud, ops
- Return ONLY the JSON object, no markdown code blocks, no explanation text.`;
}

// ─── Gemini API Call ───────────────────────────────────────────────────────
async function callGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 2048,
      responseMimeType: 'application/json'
    }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25000)
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned empty response');
  return text;
}

// ─── Groq Fallback API Call ────────────────────────────────────────────────
async function callGroq(prompt) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY not configured');

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 2048,
      response_format: { type: 'json_object' }
    }),
    signal: AbortSignal.timeout(25000)
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq API error ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('Groq returned empty response');
  return text;
}

// ─── JSON Parser (robust) ──────────────────────────────────────────────────
function parseAIResponse(text) {
  // Strip markdown code blocks if present
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  }

  const parsed = JSON.parse(cleaned); // will throw if invalid JSON

  // Validate required structure
  if (!parsed.hld || !parsed.lld) {
    throw new Error('AI response missing hld or lld fields');
  }
  if (!Array.isArray(parsed.hld.components) || parsed.hld.components.length === 0) {
    throw new Error('AI response has empty hld.components');
  }
  return parsed;
}

// ─── Main Handler ──────────────────────────────────────────────────────────
export async function generateAIDesign(req, res, getLastScanResult) {
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.socket?.remoteAddress
    || '0.0.0.0';

  // Rate limit check
  const rateCheck = checkRateLimit(clientIp);
  if (!rateCheck.allowed) {
    return res.status(429).json({
      error: `Rate limit reached. You can use AI Generate ${RATE_LIMIT_MAX} times per hour. Resets in ${rateCheck.resetInMinutes} minutes.`,
      resetInMinutes: rateCheck.resetInMinutes
    });
  }

  // Get scan result
  const scanResult = getLastScanResult();
  if (!scanResult || !scanResult.files || scanResult.files.length === 0) {
    return res.status(400).json({
      error: 'No repository scan found. Please scan a repository first.'
    });
  }

  // Check cache
  const cacheKey = getCacheKey(scanResult);
  const cached = readCache(cacheKey);
  if (cached) {
    console.log(`[AI-DESIGN] Serving cached design for key: ${cacheKey}`);
    return res.json({ success: true, cached: true, remaining: rateCheck.remaining, ...cached });
  }

  // Build prompt
  const summary = buildMetadataSummary(scanResult);
  const prompt = buildPrompt(summary);
  console.log(`[AI-DESIGN] Generating design for "${summary.projectName}" (${summary.totalFiles} files, ${summary.techStack.join(', ')})`);

  let aiText = null;
  let provider = 'gemini';

  // Try Gemini first, fall back to Groq
  try {
    aiText = await callGemini(prompt);
    console.log('[AI-DESIGN] Gemini succeeded');
  } catch (geminiErr) {
    console.warn(`[AI-DESIGN] Gemini failed: ${geminiErr.message} — trying Groq fallback`);
    try {
      aiText = await callGroq(prompt);
      provider = 'groq';
      console.log('[AI-DESIGN] Groq fallback succeeded');
    } catch (groqErr) {
      console.error(`[AI-DESIGN] Both providers failed. Gemini: ${geminiErr.message} | Groq: ${groqErr.message}`);
      return res.status(503).json({
        error: 'AI service temporarily unavailable. Both Gemini and Groq returned errors. Please try again in a moment.'
      });
    }
  }

  // Parse response
  let design;
  try {
    design = parseAIResponse(aiText);
  } catch (parseErr) {
    console.error('[AI-DESIGN] Failed to parse AI response:', parseErr.message);
    console.error('[AI-DESIGN] Raw AI text:', aiText?.slice(0, 500));
    return res.status(500).json({
      error: 'AI returned invalid JSON. Please try again.'
    });
  }

  // Cache and respond
  const result = { design, provider, generatedAt: new Date().toISOString() };
  writeCache(cacheKey, result);

  return res.json({ success: true, cached: false, remaining: rateCheck.remaining, ...result });
}
