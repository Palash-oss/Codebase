import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import AdmZip from 'adm-zip';
import { analyzeProject } from '../analyzer/index.js';
import { computeImpactRadius, computeBlastRadius } from '../analyzer/graphBuilder.js';
import { computeGraphDiff } from '../analyzer/diffBuilder.js';
import { generateSpecMarkdown } from '../analyzer/specGenerator.js';
import { broadcastProgress } from './sse.controller.js';
import {
  getUserByToken,
  saveProjectWorkspace,
  getUserProjects,
  getProjectById,
  deleteProjectWorkspace,
  checkIpScanLimit,
  recordIpScan
} from '../database/index.js';

export function createAnalysisController({ tempDir, upload, getLastScanResult, saveAnalysisCache, resetAnalysisCache }) {

  return {
    async uploadZip(req, res) {
      console.log('[X-RAY] Received ZIP file upload.');

      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;
      const authHeader = req.headers.authorization || '';
      const token = authHeader.replace(/^Bearer\s+/i, '');
      const userEmail = req.headers['x-user-email'] || '';
      const ipCheck = checkIpScanLimit(clientIp, token, userEmail);
      if (!ipCheck.allowed) {
        return res.status(429).json(ipCheck);
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded. Please upload a ZIP project file.' });
      }

      const zipPath = req.file.path;
      const uniqueName = `project-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const extractPath = path.join(tempDir, uniqueName);

      try {
        broadcastProgress('extract', 10, 'Extracting ZIP project files...');
        fs.mkdirSync(extractPath, { recursive: true });

        const zip = new AdmZip(zipPath);
        zip.extractAllTo(extractPath, true);

        let projectRoot = extractPath;
        const topContents = fs.readdirSync(extractPath);
        const subdirs = topContents.filter(item => fs.statSync(path.join(extractPath, item)).isDirectory());
        const filesInTop = topContents.filter(item => fs.statSync(path.join(extractPath, item)).isFile());

        if (subdirs.length === 1 && filesInTop.length === 0) {
          projectRoot = path.join(extractPath, subdirs[0]);
        }

        const result = await analyzeProject(projectRoot, (phase, percentage, message) => {
          broadcastProgress(phase, percentage, message);
        });

        saveAnalysisCache(result);
        recordIpScan(clientIp, userEmail);
        broadcastProgress('complete', 100, 'Analysis complete!');

        res.json({ success: true, ...result });
      } catch (error) {
        console.error('[X-RAY] Error during ZIP analysis:', error);
        res.status(500).json({ error: error.message });
      } finally {
        if (fs.existsSync(extractPath)) {
          try { fs.rmSync(extractPath, { recursive: true, force: true }); } catch (e) {}
        }
        if (fs.existsSync(zipPath)) {
          try { fs.unlinkSync(zipPath); } catch (e) {}
        }
      }
    },

    async analyzeGithub(req, res) {
      const { url, branch: targetBranch } = req.body;
      console.log(`[X-RAY] Received GitHub clone request for: ${url} (Branch: ${targetBranch || 'default'})`);

      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;
      const authHeader = req.headers.authorization || '';
      const token = authHeader.replace(/^Bearer\s+/i, '');
      const userEmail = req.headers['x-user-email'] || '';
      const ipCheck = checkIpScanLimit(clientIp, token, userEmail);
      if (!ipCheck.allowed) {
        return res.status(429).json(ipCheck);
      }

      if (!url || !url.includes('github.com')) {
        return res.status(400).json({ error: 'Invalid URL. Please provide a valid GitHub repository URL.' });
      }

      let cleanUrl = url.trim().replace(/\/$/, '').replace(/\.git$/, '');
      const match = cleanUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
      if (!match) {
        return res.status(400).json({ error: 'Failed to parse owner/repo from GitHub URL.' });
      }
      const owner = match[1];
      const repo = match[2];

      let branch = targetBranch || 'HEAD';
      if (branch === 'HEAD' && cleanUrl.includes('/tree/')) {
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
        broadcastProgress('download', 10, `Downloading GitHub repository ${owner}/${repo}...`);
        const candidateUrls = [
          finalZipUrl,
          `https://github.com/${owner}/${repo}/archive/HEAD.zip`,
          `https://github.com/${owner}/${repo}/archive/refs/heads/main.zip`,
          `https://github.com/${owner}/${repo}/archive/refs/heads/master.zip`
        ].filter((val, idx, self) => self.indexOf(val) === idx);

        let fetchResponse = null;
        for (const testUrl of candidateUrls) {
          try {
            const res = await fetch(testUrl, { headers: { 'User-Agent': 'CodeBase-X-Ray' } });
            if (res.ok) { fetchResponse = res; break; }
          } catch (e) {}
        }

        if (!fetchResponse || !fetchResponse.ok) {
          return res.status(404).json({ error: `Failed to download repository https://github.com/${owner}/${repo}.` });
        }

        broadcastProgress('extract', 20, 'Extracting repository source tree...');
        const buffer = await fetchResponse.arrayBuffer();
        const zip = new AdmZip(Buffer.from(buffer));

        fs.mkdirSync(clonePath, { recursive: true });
        zip.extractAllTo(clonePath, true);

        let projectRoot = clonePath;
        const topContents = fs.readdirSync(clonePath);
        const subdirs = topContents.filter(item => fs.statSync(path.join(clonePath, item)).isDirectory());
        const filesInTop = topContents.filter(item => fs.statSync(path.join(clonePath, item)).isFile());

        if (subdirs.length === 1 && filesInTop.length === 0) {
          projectRoot = path.join(clonePath, subdirs[0]);
        }

        const result = await analyzeProject(projectRoot, (phase, percentage, message) => {
          broadcastProgress(phase, percentage, message);
        });

        if (result.project) {
          result.project.activeBranch = branch === 'HEAD' ? 'main' : branch;
          result.project.repoUrl = cleanUrl;
        }

        saveAnalysisCache(result);
        recordIpScan(clientIp, userEmail);
        broadcastProgress('complete', 100, 'Analysis complete!');

        res.json({ success: true, ...result });

      } catch (error) {
        console.error('[X-RAY] Error during GitHub analysis:', error);
        res.status(500).json({ error: error.message });
      } finally {
        if (fs.existsSync(clonePath)) {
          try { fs.rmSync(clonePath, { recursive: true, force: true }); } catch (e) {}
        }
      }
    },

    getLatestResult(req, res) {
      const lastRes = getLastScanResult();
      if (lastRes) {
        res.json(lastRes);
      } else {
        res.json({
          project: { name: 'Codebase', totalFiles: 0, activeBranch: 'main' },
          files: [],
          graph: { nodes: [], edges: [] },
          detectedStack: []
        });
      }
    },

    computeImpact(req, res) {
      const { relativePath } = req.body || {};
      if (!relativePath) return res.status(400).json({ error: 'relativePath parameter is required' });

      const lastRes = getLastScanResult();
      if (!lastRes || !lastRes.graph) {
        return res.json({ targetPath: relativePath, directImpact: [], indirectImpact: [], totalAffected: 0, safetyScore: 100, severity: 'safe' });
      }

      try {
        const impact = computeImpactRadius(relativePath, lastRes.graph.nodes || [], lastRes.graph.edges || []);
        res.json(impact);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    },

    getSystemSpec(req, res) {
      const lastRes = getLastScanResult();
      if (!lastRes || !lastRes.systemSpec) return res.json({ error: 'No analysis data available.' });
      res.json(lastRes.systemSpec);
    },

    getSystemSpecMarkdown(req, res) {
      const lastRes = getLastScanResult();
      if (!lastRes || !lastRes.systemSpec) return res.status(404).send('No analysis data available.');
      const projectName = lastRes.project?.name || 'System';
      const markdown = generateSpecMarkdown(lastRes.systemSpec, projectName);
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${projectName.replace(/\s+/g, '_')}_system_spec.md"`);
      res.send(markdown);
    },

    computeDiff(req, res) {
      try {
        const { baseGraph, targetGraph } = req.body;
        if (!baseGraph || !targetGraph) return res.status(400).json({ error: 'baseGraph and targetGraph required' });
        const diffResult = computeGraphDiff(baseGraph, targetGraph);
        res.json({ success: true, diff: diffResult });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    },

    computeBlast(req, res) {
      try {
        const { relativePath, nodes: bodyNodes, edges: bodyEdges } = req.body || {};
        if (!relativePath) return res.status(400).json({ error: 'relativePath required' });
        const lastRes = getLastScanResult();
        const nodes = bodyNodes || lastRes?.graph?.nodes || [];
        const edges = bodyEdges || lastRes?.graph?.edges || [];
        const blast = computeBlastRadius(relativePath, nodes, edges);
        res.json(blast);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    },

    resetCache(req, res) {
      resetAnalysisCache();
      res.json({ success: true });
    },

    saveProject(req, res) {
      try {
        const authHeader = req.headers.authorization || '';
        const token = authHeader.replace(/^Bearer\s+/i, '');
        const user = getUserByToken(token);
        const userId = user ? user.id : 'guest';

        let projectData = req.body.projectData || getLastScanResult();
        if (!projectData) return res.status(400).json({ error: 'No active analysis scan available to save' });

        const saved = saveProjectWorkspace(userId, projectData);
        res.json({ success: true, project: saved });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    },

    getProjects(req, res) {
      try {
        const authHeader = req.headers.authorization || '';
        const token = authHeader.replace(/^Bearer\s+/i, '');
        const user = getUserByToken(token);
        const userId = user ? user.id : 'guest';
        const projects = getUserProjects(userId);
        res.json({ projects });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    },

    getProject(req, res) {
      try {
        const project = getProjectById(req.params.id);
        if (!project) return res.status(404).json({ error: 'Workspace project not found' });
        res.json({ project });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    },

    deleteProject(req, res) {
      try {
        const authHeader = req.headers.authorization || '';
        const token = authHeader.replace(/^Bearer\s+/i, '');
        const user = getUserByToken(token);
        const userId = user ? user.id : 'guest';
        const deleted = deleteProjectWorkspace(userId, req.params.id);
        if (!deleted) return res.status(404).json({ error: 'Workspace project not found' });
        res.json({ success: true, message: 'Workspace deleted' });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    },

    getShareableLink(req, res) {
      try {
        const project = getProjectById(req.params.id);
        if (!project) return res.status(404).json({ error: 'Shared workspace not found' });
        res.json({ shareable: true, title: project.name, updatedAt: project.updatedAt, data: project.data });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    },

    getBadge(req, res) {
      const lastRes = getLastScanResult();
      const fileCount = lastRes?.project?.totalFiles || 58;
      const grade = 'A+';

      const svgBadge = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="34" viewBox="0 0 320 34" fill="none">
  <defs>
    <linearGradient id="grad-sunset" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FF5E1A" />
      <stop offset="50%" stop-color="#FF2E93" />
      <stop offset="100%" stop-color="#FFB800" />
    </linearGradient>
    <linearGradient id="bg-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0F172A" />
      <stop offset="100%" stop-color="#020617" />
    </linearGradient>
  </defs>
  <rect width="320" height="34" rx="8" fill="url(#bg-grad)" stroke="#334155" stroke-width="1"/>
  <rect x="0" y="0" width="5" height="34" rx="2" fill="url(#grad-sunset)"/>
  <g transform="translate(14, 9)">
    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#FF5E1A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
  <text x="42" y="21" fill="#F8FAFC" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="800" letter-spacing="0.5">CODEBASE X-RAY</text>
  <line x1="168" y1="7" x2="168" y2="27" stroke="#334155" stroke-width="1"/>
  <rect x="180" y="7" width="68" height="20" rx="4" fill="#1E293B" stroke="#475569" stroke-width="0.8"/>
  <text x="214" y="21" fill="#94A3B8" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="10" font-weight="700" text-anchor="middle">${fileCount} Files</text>
  <rect x="256" y="7" width="54" height="20" rx="4" fill="url(#grad-sunset)"/>
  <text x="283" y="21" fill="#FFFFFF" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="10" font-weight="800" text-anchor="middle">Grade ${grade}</text>
</svg>`;

      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Cache-Control', 'max-age=60');
      res.send(svgBadge);
    }
  };
}
