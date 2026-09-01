import express from 'express';
import multer from 'multer';
import cors from 'cors';
import open from 'open';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

import sseRouter from './routes/sse.routes.js';
import authRouter from './routes/auth.routes.js';
import paymentRouter from './routes/payment.routes.js';
import supportRouter from './routes/support.routes.js';
import { createGithubRouter } from './routes/github.routes.js';
import { createAnalysisRouter } from './routes/analysis.routes.js';
import { createAnalysisController } from './controllers/analysis.controller.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Automatic .env file loader
try {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [key, ...valParts] = trimmed.split('=');
        const k = key.trim();
        const v = valParts.join('=').trim().replace(/^['"]|['"]$/g, '');
        if (k && (!process.env[k] || process.env[k] === '')) {
          process.env[k] = v;
        }
      }
    });
    console.log('[X-RAY] Loaded .env environment variables successfully.');
  }
} catch (envErr) {
  console.warn('[X-RAY] Warning loading .env file:', envErr.message);
}

const app = express();
const PORT = process.env.PORT || 3001;

// Setup directories in OS Temp
const uploadsDir = path.join(os.tmpdir(), 'codebase-xray-uploads');
const tempDir = path.join(os.tmpdir(), 'codebase-xray-temp');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Multer storage in OS Temp
const upload = multer({ dest: uploadsDir });

app.use(cors());
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'unsafe-none');
  res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use('/assets', (req, res, next) => {
  const assetPath = path.join(__dirname, 'public', 'assets', req.path);
  if (!fs.existsSync(assetPath)) {
    return res.status(404).type('text/plain').send('Asset not found');
  }
  next();
});
app.use(express.static(path.join(__dirname, 'public')));

// Cache directory setup
let CACHE_DIR = path.join(__dirname, '.cache');
try {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
} catch (err) {
  CACHE_DIR = path.join(os.tmpdir(), 'codebase-xray-cache');
  if (!fs.existsSync(CACHE_DIR)) {
    try { fs.mkdirSync(CACHE_DIR, { recursive: true }); } catch (tempErr) {}
  }
}
const CACHE_FILE = path.join(CACHE_DIR, 'latest-analysis.json');

let latestAnalysisResult = null;
try {
  if (fs.existsSync(CACHE_FILE)) {
    const rawCache = fs.readFileSync(CACHE_FILE, 'utf8');
    latestAnalysisResult = JSON.parse(rawCache);
    console.log('[X-RAY] Loaded latest analysis result from disk cache.');
  }
} catch (cacheErr) {
  console.warn('[X-RAY] Failed to load latest result cache:', cacheErr.message);
}
let lastScanResult = latestAnalysisResult;

function getLastScanResult() {
  if (lastScanResult) return lastScanResult;
  if (latestAnalysisResult) {
    lastScanResult = latestAnalysisResult;
    return lastScanResult;
  }
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const rawCache = fs.readFileSync(CACHE_FILE, 'utf8');
      latestAnalysisResult = JSON.parse(rawCache);
      lastScanResult = latestAnalysisResult;
      return lastScanResult;
    }
  } catch (e) {}
  return null;
}

function saveAnalysisCache(result) {
  latestAnalysisResult = result;
  lastScanResult = result;
  fs.promises.writeFile(CACHE_FILE, JSON.stringify(result), 'utf8')
    .then(() => console.log('[X-RAY] Saved analysis result to disk cache asynchronously.'))
    .catch(err => console.warn('[X-RAY] Failed to write analysis cache:', err.message));
}

function resetAnalysisCache() {
  latestAnalysisResult = null;
  lastScanResult = null;
  if (fs.existsSync(CACHE_FILE)) {
    try { fs.unlinkSync(CACHE_FILE); } catch (e) {}
  }
}

// Controller instantiation
const analysisController = createAnalysisController({
  tempDir,
  upload,
  getLastScanResult,
  saveAnalysisCache,
  resetAnalysisCache
});

// Router Mounting
app.use('/api/sse', sseRouter);

app.use('/api/auth', authRouter);
app.use('/api/payment', paymentRouter);
app.use('/api/billing', paymentRouter);
app.use('/api/support', supportRouter);

app.use('/github', createGithubRouter(getLastScanResult));
app.use('/api/github', createGithubRouter(getLastScanResult));

const analysisRouter = createAnalysisRouter(analysisController, upload, getLastScanResult);
app.use('/api', analysisRouter);
app.use('/', analysisRouter);

// SPA Fallback Route
app.get(['/', '/report'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Favicon 204 Handler
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Server Start
const isMainScript = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('server.js');
if (isMainScript && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`[X-RAY] Modular Server started at http://localhost:${PORT}`);
    open(`http://localhost:${PORT}`).catch(err => {
      console.warn(`[X-RAY] Could not open browser automatically: ${err.message}`);
    });
  });
}

export default app;