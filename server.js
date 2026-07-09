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

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/report', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'report.html'));
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

    // Send result as JSON
    res.json(result);
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
    res.json(result);
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

// Start server
app.listen(PORT, () => {
  console.log(`[X-RAY] Server started at http://localhost:${PORT}`);
  open(`http://localhost:${PORT}`).catch(err => {
    console.warn(`[X-RAY] Could not open browser automatically: ${err.message}`);
  });
});
