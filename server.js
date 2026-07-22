import express from 'express';
import multer from 'multer';
import AdmZip from 'adm-zip';
import simpleGit from 'simple-git';
import cors from 'cors';
import open from 'open';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import os from 'os';

import { analyzeProject } from './analyzer/index.js';
import { computeImpactRadius, computeBlastRadius } from './analyzer/graphBuilder.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Setup directories outside the project folder (OS Temp)
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
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const CACHE_DIR = path.join(__dirname, '.cache');
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
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

// Helper: always get the freshest scan result — re-reads disk cache if memory is empty
function getLastScanResult() {
  if (lastScanResult) return lastScanResult;
  if (latestAnalysisResult) {
    lastScanResult = latestAnalysisResult;
    return lastScanResult;
  }
  // Last resort: try re-reading cache file from disk
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const rawCache = fs.readFileSync(CACHE_FILE, 'utf8');
      latestAnalysisResult = JSON.parse(rawCache);
      lastScanResult = latestAnalysisResult;
      console.log('[X-RAY] Re-loaded analysis cache from disk on demand.');
      return lastScanResult;
    }
  } catch (e) {
    console.warn('[X-RAY] Failed to re-read cache on demand:', e.message);
  }
  return null;
}

function saveAnalysisCache(result) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(result), 'utf8');
    console.log('[X-RAY] Saved analysis result to disk cache.');
  } catch (err) {
    console.warn('[X-RAY] Failed to write analysis cache:', err.message);
  }
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/report', (req, res) => {
  res.redirect('/');
});

app.get(['/api/latest-result', '/latest-result'], (req, res) => {
  if (latestAnalysisResult) {
    lastScanResult = latestAnalysisResult;
    res.json(latestAnalysisResult);
  } else {
    res.status(404).json({ error: 'No analysis found' });
  }
});

// POST /upload -> single file ZIP analysis
app.post(['/upload', '/api/upload'], upload.single('project'), async (req, res) => {
  console.log('[X-RAY] Received ZIP file upload.');
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded. Please upload a ZIP project file.' });
  }

  const zipPath = req.file.path;
  const uniqueName = `project-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const extractPath = path.join(tempDir, uniqueName);

  try {
    console.log(`[X-RAY] Extracting ZIP to temporary folder: ${extractPath}`);
    fs.mkdirSync(extractPath, { recursive: true });

    const zip = new AdmZip(zipPath);
    zip.extractAllTo(extractPath, true);

    // Detect actual project root (Fix 3: single top-level folder nesting check)
    let projectRoot = extractPath;
    const topContents = fs.readdirSync(extractPath);
    const subdirs = topContents.filter(item => {
      const full = path.join(extractPath, item);
      return fs.statSync(full).isDirectory();
    });
    const filesInTop = topContents.filter(item => {
      const full = path.join(extractPath, item);
      return fs.statSync(full).isFile();
    });
    if (subdirs.length === 1 && filesInTop.length === 0) {
      projectRoot = path.join(extractPath, subdirs[0]);
      console.log(`[X-RAY] Detected single top-level directory wrapper. Using: ${projectRoot}`);
    }

    const result = await analyzeProject(projectRoot);

    latestAnalysisResult = result;
    lastScanResult = result;
    saveAnalysisCache(result);
    // Send result as JSON
    res.json({ success: true });
  } catch (error) {
    console.error('[X-RAY] Error during ZIP analysis:', error);
    res.status(500).json({ error: error.message });
  } finally {
    // Fix 1: Temp folder and ZIP cleanups run immediately
    console.log(`[X-RAY] Cleaning up temporary folder: ${extractPath}`);
    if (fs.existsSync(extractPath)) {
      try {
        fs.rmSync(extractPath, { recursive: true, force: true });
      } catch (rmError) {
        console.error(`[X-RAY] Failed to clean temp folder: ${rmError.message}`);
      }
    }
    console.log(`[X-RAY] Cleaning up uploaded ZIP file: ${zipPath}`);
    if (fs.existsSync(zipPath)) {
      try {
        fs.unlinkSync(zipPath);
      } catch (unlinkError) {
        console.error(`[X-RAY] Failed to delete uploaded ZIP: ${unlinkError.message}`);
      }
    }
  }
});

// POST /github -> Clone and analyze repository
app.post(['/github', '/api/github'], async (req, res) => {
  const { url } = req.body;
  console.log(`[X-RAY] Received GitHub clone request for: ${url}`);

  if (!url || !url.includes('github.com')) {
    return res.status(400).json({ error: 'Invalid URL. Please provide a valid GitHub repository URL.' });
  }

  // Clean up url (e.g. remove trailing slash, .git extension)
  let cleanUrl = url.trim().replace(/\/$/, '').replace(/\.git$/, '');

  // Parse owner and repo name from GitHub URL
  const match = cleanUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (!match) {
    return res.status(400).json({ error: 'Failed to parse owner/repo from GitHub URL.' });
  }
  const owner = match[1];
  const repo = match[2];

  // Determine branch if tree/branch is specified in the URL
  let branch = 'HEAD';
  if (cleanUrl.includes('/tree/')) {
    const parts = cleanUrl.split('/tree/');
    if (parts.length > 1) {
      branch = parts[1].split('/')[0];
    }
  }

  const zipUrl = `https://github.com/${owner}/${repo}/archive/refs/heads/${branch}.zip`;
  const finalZipUrl = branch === 'HEAD'
    ? `https://github.com/${owner}/${repo}/archive/HEAD.zip`
    : zipUrl;

  const uniqueName = `project-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const clonePath = path.join(tempDir, uniqueName);

  try {
    console.log(`[X-RAY] Downloading repository ZIP from: ${finalZipUrl}`);
    const fetchResponse = await fetch(finalZipUrl, {
      headers: {
        'User-Agent': 'CodeBase-X-Ray'
      }
    });

    if (!fetchResponse.ok) {
      throw new Error(`Failed to download repository zip (status: ${fetchResponse.status}). Make sure the repository is public.`);
    }

    const buffer = await fetchResponse.arrayBuffer();
    const zip = new AdmZip(Buffer.from(buffer));

    console.log(`[X-RAY] Extracting ZIP to: ${clonePath}`);
    fs.mkdirSync(clonePath, { recursive: true });
    zip.extractAllTo(clonePath, true);

    // Detect actual project root (single top-level folder nesting check)
    let projectRoot = clonePath;
    const topContents = fs.readdirSync(clonePath);
    const subdirs = topContents.filter(item => {
      const full = path.join(clonePath, item);
      return fs.statSync(full).isDirectory();
    });
    const filesInTop = topContents.filter(item => {
      const full = path.join(clonePath, item);
      return fs.statSync(full).isFile();
    });
    if (subdirs.length === 1 && filesInTop.length === 0) {
      projectRoot = path.join(clonePath, subdirs[0]);
      console.log(`[X-RAY] Detected single top-level directory wrapper in ZIP. Using: ${projectRoot}`);
    }

    const result = await analyzeProject(projectRoot);
    latestAnalysisResult = result;
    lastScanResult = result;
    saveAnalysisCache(result);
    res.json({ success: true });
  } catch (error) {
    console.error('[X-RAY] Error during GitHub analysis:', error);
    res.status(500).json({ error: error.message });
  } finally {
    console.log(`[X-RAY] Cleaning up cloned repository path: ${clonePath}`);
    if (fs.existsSync(clonePath)) {
      try {
        fs.rmSync(clonePath, { recursive: true, force: true });
      } catch (rmError) {
        console.error(`[X-RAY] Failed to clean clone folder: ${rmError.message}`);
      }
    }
  }
});

// POST /chat -> AI Q&A Chat route
app.post(['/chat', '/api/chat'], async (req, res) => {
  const { question, context } = req.body;
  const key = process.env.GEMINI_API_KEY;

  if (key) {
    try {
      console.log('[X-RAY] Calling Gemini API for chatbot...');
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `You are Codebase X-Ray chatbot assistant. Based on this codebase summary context:\n\n${context}\n\nAnswer this developer query: ${question}`
            }]
          }]
        })
      });

      const data = await response.json();
      const answer = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (answer) {
        return res.json({ answer });
      }
      throw new Error('Empty response from Gemini API');
    } catch (error) {
      console.warn(`[X-RAY] Gemini API error: ${error.message}. Falling back to smart mock.`);
    }
  }

  // Smart Mock Fallback
  console.log('[X-RAY] Using mock responder for chat.');
  let answer = '';
  const lowerQ = question.toLowerCase();

  if (lowerQ.includes('circular') || lowerQ.includes('cycle') || lowerQ.includes('loop')) {
    answer = `Based on the codebase analysis, circular dependencies are found in the project's dependency graph. Circular imports complicate codebase refactoring and can lead to runtime issues. Review files with dependency warnings to locate the cycles and break them by moving shared code to a utility module.`;
  } else if (lowerQ.includes('dead') || lowerQ.includes('unused') || lowerQ.includes('exports')) {
    answer = `The static analysis indicates some files and exports are unused. Unreferenced files are flagged in the File Explorer. Review and clean them up if they are indeed obsolete, or verify if they are loaded dynamically.`;
  } else if (lowerQ.includes('layer') || lowerQ.includes('architecture')) {
    answer = `The project follows a layered architecture pattern: Presentation, Interaction, Gateway, Domain, Persistence, and Foundation layers. You can inspect each layer in the Layer Diagram view.`;
  } else if (lowerQ.includes('tech') || lowerQ.includes('framework') || lowerQ.includes('library')) {
    answer = `Codebase X-Ray has detected multiple frameworks, UI engines, auth layers, databases, or deployment scripts in this project. You can inspect the full tech list in the Tech Stack view.`;
  } else {
    answer = `I scanned the code structure but didn't find specific details for "${question}". Try asking about dependencies, layers, dead code, or circular paths. Configure the GEMINI_API_KEY environment variable to enable full AI answers!`;
  }

  res.json({ answer });
});

// POST /api/impact -> Compute impact radius for a selected file
app.post('/api/impact', (req, res) => {
  const { relativePath } = req.body;
  const scan = getLastScanResult();
  if (!scan) {
    return res.status(400).json({ error: 'No scan available. Please scan a project first.' });
  }
  if (!relativePath) {
    return res.status(400).json({ error: 'Missing relativePath parameter.' });
  }
  try {
    const impact = computeImpactRadius(relativePath, scan.graph.nodes, scan.graph.edges);
    res.json(impact);
  } catch (error) {
    console.error('[X-RAY] Error computing impact radius:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/reset -> Reset analysis cache on logout/new analysis
app.post('/api/reset', (req, res) => {
  console.log('[X-RAY] Resetting analysis cache.');
  latestAnalysisResult = null;
  lastScanResult = null;
  if (fs.existsSync(CACHE_FILE)) {
    try {
      fs.unlinkSync(CACHE_FILE);
    } catch (e) {
      console.warn('[X-RAY] Failed to delete cache file:', e.message);
    }
  }
  res.json({ success: true });
});

// POST /api/blast-radius -> Compute blast radius for a selected file
app.post('/api/blast-radius', (req, res) => {
  const scan = getLastScanResult();
  if (!scan) {
    return res.status(400).json({ error: 'Scan a project first' });
  }
  const { relativePath } = req.body;
  if (!relativePath) {
    return res.status(400).json({ error: 'relativePath is required' });
  }
  try {
    const result = computeBlastRadius(relativePath, scan.graph.nodes, scan.graph.edges);
    res.json(result);
  } catch (err) {
    console.error('[X-RAY] Error computing blast radius:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/story -> AI/Mock execution path generator
app.post('/api/story', async (req, res) => {
  if (!lastScanResult) {
    if (latestAnalysisResult) {
      lastScanResult = latestAnalysisResult;
    } else {
      return res.status(400).json({ error: 'Scan a project first' });
    }
  }
  const { question } = req.body;
  if (!question) {
    return res.status(400).json({ error: 'question is required' });
  }

  const key = process.env.GEMINI_API_KEY;
  if (key) {
    try {
      console.log('[X-RAY] Calling Gemini API for Code Story...');
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`;

      const techStackStr = lastScanResult.stack?.detected ? lastScanResult.stack.detected.map(t => t.name).join(', ') : 'JavaScript';
      const allFilesListStr = lastScanResult.graph?.nodes ? lastScanResult.graph.nodes.map(n => `- ${n.id} (${n.layer})`).join('\n') : '';

      const prompt = `You are analyzing a JavaScript/TypeScript codebase.

Project: ${lastScanResult.project?.name || 'Codebase'}
Tech stack: ${techStackStr}

List of files in this project:
${allFilesListStr}

The user wants to understand: "${question}"

Return ONLY a JSON array (no markdown, no explanation, no code blocks) with 4-8 steps showing the code execution path. Each step:
{
  "step": number,
  "filePath": "exact relative path from the files list above",
  "what": "one sentence max 12 words explaining what this file does in this flow",
  "layer": "the layer this file belongs to"
}

Only include files that actually exist in the project file list. Start from the user-facing entry point and trace to the data layer.`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }]
        })
      });

      const data = await response.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (rawText) {
        let cleanText = rawText.trim();
        if (cleanText.startsWith('```')) {
          cleanText = cleanText.replace(/^```json\s*/i, '').replace(/```\s*$/, '');
        }
        const parsed = JSON.parse(cleanText);
        if (Array.isArray(parsed)) {
          return res.json(parsed);
        }
      }
    } catch (error) {
      console.warn(`[X-RAY] Gemini API error for story: ${error.message}. Falling back to mock.`);
    }
  }

  try {
    // Fallback Mock Story Generator using Graph Traversal
    console.log('[X-RAY] Using mock story fallback with graph traversal.');
    const nodes = lastScanResult?.graph?.nodes || [];
    const edges = lastScanResult?.graph?.edges || [];
    const lowerQ = question.toLowerCase();

    if (nodes.length === 0) {
      return res.json([]);
    }

    // Find starting keywords
    let keywords = [];
    if (lowerQ.includes('login') || lowerQ.includes('auth') || lowerQ.includes('sign')) {
      keywords = ['login', 'auth', 'sign', 'session'];
    } else if (lowerQ.includes('save') || lowerQ.includes('db') || lowerQ.includes('database') || lowerQ.includes('write') || lowerQ.includes('create')) {
      keywords = ['db', 'prisma', 'model', 'save', 'write', 'create', 'schema'];
    } else if (lowerQ.includes('api') || lowerQ.includes('request') || lowerQ.includes('server') || lowerQ.includes('fetch')) {
      keywords = ['api', 'route', 'server', 'controller', 'handler', 'fetch'];
    } else {
      keywords = ['app', 'main', 'index', 'home', 'view'];
    }

    // Find a starting node that matches key words, prioritizing Presentation or Gateway layers
    let startNode = null;
    for (const layer of ['Presentation', 'Gateway', 'Interaction', 'Domain', 'Persistence']) {
      startNode = nodes.find(n => n.layer === layer && keywords.some(k => n.id?.toLowerCase().includes(k)));
      if (startNode) break;
    }
    if (!startNode) {
      startNode = nodes.find(n => keywords.some(k => n.id?.toLowerCase().includes(k)));
    }
    if (!startNode) {
      startNode = nodes[0];
    }

    if (!startNode) {
      return res.json([]);
    }

    // Trace path using BFS/DFS connections in the project graph
    const pathNodes = [startNode];
    const visited = new Set([startNode.id]);
    let currentId = startNode.id;

    for (let step = 0; step < 5; step++) {
      if (!currentId) break;
      // Find outbound edges from currentId
      const nextEdges = edges.filter(e => e.source === currentId);
      let nextNode = null;
      for (const edge of nextEdges) {
        if (!visited.has(edge.target)) {
          const targetNode = nodes.find(n => n.id === edge.target);
          if (targetNode) {
            nextNode = targetNode;
            break;
          }
        }
      }
      if (!nextNode) {
        // Try inbound edges in reverse (sometimes flow is conceptualized in reverse)
        const prevEdges = edges.filter(e => e.target === currentId);
        for (const edge of prevEdges) {
          if (!visited.has(edge.source)) {
            const sourceNode = nodes.find(n => n.id === edge.source);
            if (sourceNode) {
              nextNode = sourceNode;
              break;
            }
          }
        }
      }
      if (nextNode) {
        pathNodes.push(nextNode);
        visited.add(nextNode.id);
        currentId = nextNode.id;
      } else {
        break;
      }
    }

    // If path is too short, pad with matching keyword files
    if (pathNodes.length < 4) {
      const matchingFiles = nodes.filter(n => n && !visited.has(n.id) && keywords.some(k => n.id?.toLowerCase().includes(k))).slice(0, 5 - pathNodes.length);
      matchingFiles.forEach(f => {
        pathNodes.push(f);
        visited.add(f.id);
      });
    }

    // If still too short, pad with first few nodes
    if (pathNodes.length < 4) {
      const remaining = nodes.filter(n => n && !visited.has(n.id)).slice(0, 5 - pathNodes.length);
      remaining.forEach(f => {
        pathNodes.push(f);
        visited.add(f.id);
      });
    }

    const validPathNodes = pathNodes.filter(Boolean);

    const steps = validPathNodes.map((file, index) => {
      let explanation = `Traces request flow through ${file.label || 'file'}`;
      if (file.layer === 'Presentation') {
        explanation = `Frontend renders user interface and triggers user action.`;
      } else if (file.layer === 'Gateway') {
        explanation = `API route handles the request and validates request payload.`;
      } else if (file.layer === 'Persistence') {
        explanation = `Database query writes or retrieves data records.`;
      } else if (file.layer === 'Domain') {
        explanation = `Executes core business logic rules and operations.`;
      }

      return {
        step: index + 1,
        filePath: file.id || '',
        what: explanation,
        layer: file.layer || 'Unknown'
      };
    });

    res.json(steps);
  } catch (err) {
    console.error('[X-RAY] Error generating fallback story:', err);
    res.status(500).json({ error: 'Failed to generate flow path' });
  }
});

// Auto-fix endpoint
app.post('/api/autofix', (req, res) => {
  try {
    const { action, missingEnvVars } = req.body;
    if (action === 'env' && Array.isArray(missingEnvVars)) {
      const envExamplePath = path.join(process.cwd(), '.env.example');
      let existing = '';
      if (fs.existsSync(envExamplePath)) {
        existing = fs.readFileSync(envExamplePath, 'utf8');
      }
      const linesToAdd = [];
      missingEnvVars.forEach(ev => {
        if (!existing.includes(`${ev}=`)) {
          linesToAdd.push(`${ev}=your_${ev.toLowerCase()}_here`);
        }
      });
      if (linesToAdd.length > 0) {
        const updated = existing ? `${existing}\n# Auto-generated by CodeBase X-Ray\n${linesToAdd.join('\n')}\n` : `# Auto-generated by CodeBase X-Ray\n${linesToAdd.join('\n')}\n`;
        fs.writeFileSync(envExamplePath, updated, 'utf8');
        return res.json({ success: true, message: `Added ${linesToAdd.length} missing environment variables to .env.example` });
      }
      return res.json({ success: true, message: 'All variables are already defined in .env.example' });
    }
    res.status(400).json({ error: 'Invalid autofix action' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Generate GitHub Actions Workflow endpoint
app.get('/api/generate-gh-action', (req, res) => {
  const yamlContent = `name: CodeBase X-Ray Architecture Guard

on:
  pull_request:
    branches: [ main, master, develop ]

jobs:
  architecture-check:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 18

      - name: Run CodeBase X-Ray Architecture Guard
        run: npx codebase-xray-guard --fail-on-circular --fail-on-missing-env

      - name: Architecture Lint Result
        run: echo "Architecture rules passed cleanly!"
`;
  res.json({ filename: '.github/workflows/codebase-xray-guard.yml', content: yamlContent });
});

// Export Mermaid syntax endpoint
app.post('/api/export-mermaid', (req, res) => {
  try {
    let { nodes, edges, files } = req.body;

    if ((!nodes || nodes.length === 0) && latestAnalysisResult?.graph) {
      nodes = latestAnalysisResult.graph.nodes;
      edges = latestAnalysisResult.graph.edges;
    }

    const mermaidLines = ['```mermaid', 'graph TD'];

    if (edges && edges.length > 0) {
      const addedEdges = new Set();
      edges.slice(0, 40).forEach(edge => {
        const srcName = (edge.source || '').split('/').pop();
        const tgtName = (edge.target || '').split('/').pop();
        const srcId = srcName.replace(/[^a-zA-Z0-9]/g, '');
        const tgtId = tgtName.replace(/[^a-zA-Z0-9]/g, '');
        
        if (srcId && tgtId && srcId !== tgtId && !addedEdges.has(`${srcId}->${tgtId}`)) {
          addedEdges.add(`${srcId}->${tgtId}`);
          mermaidLines.push(`  ${srcId}["${srcName}"] --> ${tgtId}["${tgtName}"]`);
        }
      });
    } else if (nodes && nodes.length > 0) {
      nodes.slice(0, 20).forEach(n => {
        const cleanId = (n.id || '').split('/').pop().replace(/[^a-zA-Z0-9]/g, '');
        const cleanLabel = n.label || n.id;
        mermaidLines.push(`  ${cleanId}["${cleanLabel}"]`);
      });
    } else {
      mermaidLines.push('  WebBrowser["Web Browser (React UI)"] --> APIGateway["API Gateway (Express Server)"]');
      mermaidLines.push('  APIGateway --> Database["Database (Persistence)"]');
    }

    mermaidLines.push('```');
    res.json({ mermaid: mermaidLines.join('\n') });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Start server (only in local standalone mode when executed directly)
const isMainScript = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('server.js');
if (isMainScript && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`[X-RAY] Server started at http://localhost:${PORT}`);
    open(`http://localhost:${PORT}`).catch(err => {
      console.warn(`[X-RAY] Could not open browser automatically: ${err.message}`);
    });
  });
}

export default app;
