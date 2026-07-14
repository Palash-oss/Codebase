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
const PORT = process.env.PORT || 3000;

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

let latestAnalysisResult = null;
let lastScanResult = null;

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/report', (req, res) => {
  res.redirect('/');
});

app.get('/api/latest-result', (req, res) => {
  if (latestAnalysisResult) {
    lastScanResult = latestAnalysisResult;
    res.json(latestAnalysisResult);
  } else {
    res.status(404).json({ error: 'No analysis found' });
  }
});

// POST /upload -> single file ZIP analysis
app.post('/upload', upload.single('project'), async (req, res) => {
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
app.post('/github', async (req, res) => {
  const { url } = req.body;
  console.log(`[X-RAY] Received GitHub clone request for: ${url}`);
  
  if (!url || !url.includes('github.com')) {
    return res.status(400).json({ error: 'Invalid URL. Please provide a valid GitHub repository URL.' });
  }

  const uniqueName = `project-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const clonePath = path.join(tempDir, uniqueName);

  try {
    console.log(`[X-RAY] Cloning repository into: ${clonePath}`);
    fs.mkdirSync(clonePath, { recursive: true });
    
    const git = simpleGit();
    await git.clone(url, clonePath);
    console.log('[X-RAY] Clone successful. Starting analysis...');

    // Use clonePath as projectRoot (Fix 2)
    const result = await analyzeProject(clonePath);
    latestAnalysisResult = result;
    lastScanResult = result;
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
app.post('/chat', async (req, res) => {
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
  if (!lastScanResult) {
    // Try to fallback to latestAnalysisResult if it exists
    if (latestAnalysisResult) {
      lastScanResult = latestAnalysisResult;
    } else {
      return res.status(400).json({ error: 'No scan available. Please scan a project first.' });
    }
  }
  
  if (!relativePath) {
    return res.status(400).json({ error: 'Missing relativePath parameter.' });
  }

  try {
    const impact = computeImpactRadius(relativePath, lastScanResult.graph.nodes, lastScanResult.graph.edges);
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
  res.json({ success: true });
});

// POST /api/blast-radius -> Compute blast radius for a selected file
app.post('/api/blast-radius', (req, res) => {
  if (!lastScanResult) {
    if (latestAnalysisResult) {
      lastScanResult = latestAnalysisResult;
    } else {
      return res.status(400).json({ error: 'Scan a project first' });
    }
  }
  const { relativePath } = req.body;
  if (!relativePath) {
    return res.status(400).json({ error: 'relativePath is required' });
  }
  try {
    const result = computeBlastRadius(relativePath, lastScanResult.graph.nodes, lastScanResult.graph.edges);
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
      const layersContextStr = lastScanResult.layers ? Object.entries(lastScanResult.layers).map(([layer, files]) => 
        files.length > 0 ? `${layer}: ${files.slice(0, 8).join(', ')}` : ''
      ).filter(Boolean).join('\n') : '';

      const prompt = `You are analyzing a JavaScript/TypeScript codebase.

Project: ${lastScanResult.project?.name || 'Codebase'}
Tech stack: ${techStackStr}

Files in this project grouped by layer:
${layersContextStr}

The user wants to understand: "${question}"

Return ONLY a JSON array (no markdown, no explanation, no code blocks) with 4-8 steps showing the code execution path. Each step:
{
  "step": number,
  "filePath": "exact relative path from the files list above",
  "what": "one sentence max 12 words explaining what this file does in this flow",
  "layer": "the layer this file belongs to"
}

Only include files that actually exist in the project. Start from the user-facing entry point and trace to the data layer.`;

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

  // Fallback Mock Story Generator
  console.log('[X-RAY] Using mock story fallback.');
  const allFiles = lastScanResult.graph.nodes;
  const lowerQ = question.toLowerCase();
  
  let selectedFiles = [];
  if (lowerQ.includes('login') || lowerQ.includes('auth') || lowerQ.includes('sign')) {
    selectedFiles = allFiles.filter(f => 
      f.id.includes('login') || f.id.includes('auth') || f.id.includes('session') || f.id.includes('page') || f.id.includes('route') || f.id.includes('db') || f.id.includes('prisma')
    ).slice(0, 5);
  } else if (lowerQ.includes('save') || lowerQ.includes('write') || lowerQ.includes('db') || lowerQ.includes('database')) {
    selectedFiles = allFiles.filter(f => 
      f.id.includes('db') || f.id.includes('prisma') || f.id.includes('save') || f.id.includes('write') || f.id.includes('model') || f.id.includes('route')
    ).slice(0, 5);
  } else if (lowerQ.includes('api') || lowerQ.includes('request') || lowerQ.includes('server')) {
    selectedFiles = allFiles.filter(f => 
      f.id.includes('api') || f.id.includes('route') || f.id.includes('server') || f.id.includes('controller') || f.id.includes('gateway')
    ).slice(0, 5);
  } else {
    selectedFiles = allFiles.slice(0, 5);
  }

  if (selectedFiles.length === 0) {
    selectedFiles = allFiles.slice(0, Math.min(allFiles.length, 5));
  }

  const steps = selectedFiles.map((file, index) => {
    let explanation = `Traces request flow through ${file.label}`;
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
      filePath: file.id,
      what: explanation,
      layer: file.layer
    };
  });

  res.json(steps);
});

// Start server
app.listen(PORT, () => {
  console.log(`[X-RAY] Server started at http://localhost:${PORT}`);
  open(`http://localhost:${PORT}`).catch(err => {
    console.warn(`[X-RAY] Could not open browser automatically: ${err.message}`);
  });
});
