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

// Guarantee .env keys are present
try {
  const rootEnvPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(rootEnvPath)) {
    const raw = fs.readFileSync(rootEnvPath, 'utf8');
    raw.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [k, ...v] = trimmed.split('=');
        const key = k.trim();
        const val = v.join('=').trim().replace(/^['"]|['"]$/g, '');
        if (key && !process.env[key]) process.env[key] = val;
      }
    });
  }
} catch (e) {}

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

// ─── Universal Technology-Agnostic System Prompt ───────────────────────────
function buildPrompt(summary) {
  return `You are a Principal Software Architect. Given the extracted static analysis metadata of a real codebase, generate an extremely accurate, repo-specific High-Level Design (HLD) and Low-Level Design (LLD).

CODEBASE METADATA:
${JSON.stringify(summary, null, 2)}

INSTRUCTIONS:
1. Support ANY tech stack, framework, language, or architecture pattern present (Java/Spring, C#/.NET, Python/Django/FastAPI/Flask, Node/Express/NestJS, Go, Rust, Ruby/Rails, PHP/Laravel, React, Next.js, Vue, Angular, Svelte, Microservices, Monolith, Serverless, Event-Driven/Kafka/RabbitMQ, AI/ML/RAG/Agents, Relational/NoSQL/Vector DBs).
2. Do NOT hardcode or assume any specific framework (e.g. do not assume LangChain unless actually detected). Analyze whatever files, routes, classes, and imports exist in THIS project.
3. Map component zones strictly to one of:
   - "client" (UI pages, web apps, mobile apps, desktop apps, hooks, state stores)
   - "gateway" (API routes, controllers, HTTP endpoints, RPC handlers, GraphQL, auth middleware)
   - "backend" (business domain logic, services, workers, AI agents, message consumers, pipeline nodes)
   - "data" (databases, ORM schemas, vector indexes, caches, key-value stores)
   - "cloud" (external SaaS APIs, cloud storage, third-party identity providers, external LLMs)
   - "ops" (runtime environment, config, secrets, logging, metrics)
4. HLD components represent architecture building blocks with concise labels and specific sublabels (e.g. real endpoint methods/paths, database engine name, actual external service names).
5. LLD components represent deep implementation details with actual function signatures, class methods, or ORM table schema fields from the metadata.
6. Connect components logically: client → gateway → backend → data / cloud. Do not leave floating unlinked boxes.

Generate a valid JSON object with EXACTLY this structure:
{
  "projectSummary": "2-3 sentence description of what this repository actually does based on its code",
  "hld": {
    "description": "High-level service architecture overview",
    "components": [
      {
        "id": "hld-comp-id",
        "label": "Component Name",
        "sublabel": "Concise specific detail (e.g. real endpoints, technologies used)",
        "zone": "client|gateway|backend|data|cloud|ops",
        "zoneLabel": "Display Zone Name",
        "techKey": "tech-identifier (e.g. react, spring, fastapi, postgresql, redis, etc)",
        "connections": ["target-hld-comp-ids"]
      }
    ]
  },
  "lld": {
    "description": "Low-level implementation detail breakdown",
    "components": [
      {
        "id": "lld-comp-id",
        "label": "Module / Class Name",
        "sublabel": "Real function signatures (e.g. handleRequest(req), processOrder(id)) or schema fields",
        "zone": "client|gateway|backend|data|cloud|ops",
        "zoneLabel": "Display Zone Name",
        "techKey": "tech-identifier",
        "connections": ["target-lld-comp-ids"]
      }
    ]
  },
  "dbSchema": {
    "hasDatabase": true|false,
    "dbType": "postgresql|mysql|mongodb|sqlite|redis|vector|none",
    "tables": [
      { "name": "TableName", "fields": ["id", "field1", "field2"], "description": "Table description" }
    ],
    "vectorIndex": { "provider": "pinecone|chromadb|faiss|qdrant|weaviate|none", "namespace": "namespace format", "embeddingDimensions": "dimensions" }
  }
}

CRITICAL: Return ONLY valid, raw JSON. No markdown backticks, no markdown code blocks, no trailing comments.`;
}

// ─── Gemini API Call ───────────────────────────────────────────────────────
async function callGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.2,
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

// ─── Groq API Call (Primary) ───────────────────────────────────────────────
async function callGroq(prompt) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY not configured');

  // Try working primary Groq models in order
  const models = ['openai/gpt-oss-120b', 'qwen/qwen3.6-27b', 'groq/compound'];
  let lastErr = null;

  for (const model of models) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2,
          max_tokens: 2048,
          response_format: { type: 'json_object' }
        }),
        signal: AbortSignal.timeout(25000)
      });

      if (res.ok) {
        const data = await res.json();
        const text = data?.choices?.[0]?.message?.content;
        if (text) return text;
      } else {
        const errTxt = await res.text();
        lastErr = new Error(`Groq (${model}) error ${res.status}: ${errTxt.slice(0, 150)}`);
      }
    } catch (e) {
      lastErr = e;
    }
  }

  throw lastErr || new Error('Groq models failed');
}

// ─── JSON Parser (robust) ──────────────────────────────────────────────────
function parseAIResponse(text) {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  }

  const parsed = JSON.parse(cleaned);

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
  let provider = 'groq';

  // Try Groq first (known working key), fall back to Gemini
  try {
    aiText = await callGroq(prompt);
    provider = 'groq';
    console.log('[AI-DESIGN] Groq primary succeeded');
  } catch (groqErr) {
    console.warn(`[AI-DESIGN] Groq failed: ${groqErr.message} — trying Gemini fallback`);
    try {
      aiText = await callGemini(prompt);
      provider = 'gemini';
      console.log('[AI-DESIGN] Gemini fallback succeeded');
    } catch (geminiErr) {
      console.error(`[AI-DESIGN] Both providers failed. Groq: ${groqErr.message} | Gemini: ${geminiErr.message}`);
      return res.status(503).json({
        error: 'AI service temporarily unavailable. Please try again in a moment.'
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

