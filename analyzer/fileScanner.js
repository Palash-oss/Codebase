import fs from 'fs';
import path from 'path';

export async function scanFiles(projectRoot) {
  const files = [];

  // Directories that are almost always irrelevant for dependency graphs.
  // Keeping this conservative avoids skipping “important” source code.
  const skipDirs = new Set([
    'node_modules', '.git', 'dist', 'build', '.next', 'out',
    'coverage', '.turbo', '__pycache__', '.cache', '.vercel',
    '.netlify', '.svelte-kit', 'vendor', 'bower_components',
    '.idea', '.vscode', '.github', 'public'
  ]);

  // Avoid scanning likely-binary assets.
  const excludeExts = new Set([
    '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.webp', '.avif',
    '.mp4', '.webm', '.ogg', '.mp3', '.wav', '.flac', '.aac',
    '.ttf', '.otf', '.woff', '.woff2', '.eot',
    '.pdf', '.zip', '.tar', '.gz', '.rar', '.7z', '.exe', '.dll', '.so', '.dylib', '.bin', '.dat'
  ]);

  // Efficiency guardrails (do not change the “meaning” of analysis; just prevent
  // pathological memory/CPU blowups on very large repos).
  // If limits are hit, we stop further scanning (not dropping already scanned files).
  const MAX_FILES = Number(process.env.CODEBASE_XRAY_MAX_FILES || 15000);
  const MAX_TOTAL_BYTES = Number(process.env.CODEBASE_XRAY_MAX_TOTAL_BYTES || 25 * 1024 * 1024); // 25MB
  const MAX_BYTES_PER_FILE = Number(process.env.CODEBASE_XRAY_MAX_BYTES_PER_FILE || 2 * 1024 * 1024); // 2MB

  let totalBytesRead = 0;

  function walk(dir) {
    if (files.length >= MAX_FILES) return;
    if (totalBytesRead >= MAX_TOTAL_BYTES) return;

    const list = fs.readdirSync(dir);
    for (const item of list) {
      if (files.length >= MAX_FILES) return;
      if (totalBytesRead >= MAX_TOTAL_BYTES) return;

      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        if (skipDirs.has(item)) continue;
        walk(fullPath);
        continue;
      }

      if (!stat.isFile()) continue;

      const ext = path.extname(item).toLowerCase();
      if (excludeExts.has(ext)) continue;

      // EXCLUDE checks: anything ending in .d.ts, .min.js, .min.ts,
      // .test.js.map, .spec.js.map, lockfiles.
      if (
        item.endsWith('.d.ts') ||
        item.endsWith('.min.js') ||
        item.endsWith('.min.ts') ||
        item.endsWith('.test.js.map') ||
        item.endsWith('.spec.js.map') ||
        item === 'package-lock.json' ||
        item === 'yarn.lock' ||
        item === 'pnpm-lock.yaml'
      ) {
        continue;
      }

      // Read content only while within budget. If a file is too large (or we
      // exceeded total budget), keep metadata but avoid heavy parsing.
      let content = '';
      let lines = 0;

      const shouldReadContent =
        stat.size > 0 &&
        stat.size <= MAX_BYTES_PER_FILE &&
        (totalBytesRead + stat.size) <= MAX_TOTAL_BYTES;

      if (shouldReadContent) {
        content = fs.readFileSync(fullPath, 'utf8');
        lines = content.split('\n').length;
        totalBytesRead += stat.size;
      }

      const relative = path.relative(projectRoot, fullPath);
      const relativePath = relative.replace(/\\/g, '/'); // Use forward slashes

      files.push({
        path: path.resolve(fullPath),
        relativePath,
        name: item,
        extension: ext,
        content,
        lines,
        size: stat.size,
        directory: path.dirname(relativePath).replace(/\\/g, '/')
      });
    }
  }

  walk(projectRoot);

  // Helper: attempt to find best nested package.json / tsconfig in monorepos.
  // We keep scanRoot as projectRoot for file paths, but for dependency detection
  // we try to locate the most relevant config within a bounded depth.
  function readJsonIfExists(p) {
    if (!fs.existsSync(p)) return null;
    try {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch {
      return null;
    }
  }

  function parseTsConfig(tsPath) {
    if (!fs.existsSync(tsPath)) return null;
    try {
      let rawConfig = fs.readFileSync(tsPath, 'utf8');
      rawConfig = rawConfig.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '$1');
      const config = JSON.parse(rawConfig);
      return config;
    } catch {
      return null;
    }
  }

  function findBestConfigFiles(root) {
    // Bounded search to avoid pathological monorepos.
    const MAX_DEPTH = 6;
    const start = path.resolve(root);
    const results = {
      pkg: null,
      pkgScore: -Infinity,
      ts: null,
      baseUrl: null,
      tsScore: -Infinity
    };

    function scorePath(p) {
      const rel = path.relative(start, p).replace(/\\/g, '/').toLowerCase();
      let s = 0;
      // Prioritize common package boundaries.
      if (rel.includes('/frontend/') || rel.startsWith('frontend/')) s += 50;
      if (rel.includes('/client/') || rel.startsWith('client/')) s += 45;
      if (rel.includes('/backend/') || rel.startsWith('backend/')) s += 45;
      if (rel.includes('/server/') || rel.startsWith('server/')) s += 40;
      if (rel.includes('/api/') || rel.startsWith('api/')) s += 35;
      if (rel.includes('/packages/')) s += 10;
      // Prefer shallower paths.
      const depth = rel.split('/').filter(Boolean).length;
      s -= depth * 2;
      return s;
    }

    function walk(dir, depth) {
      if (depth > MAX_DEPTH) return;
      let list;
      try {
        list = fs.readdirSync(dir);
      } catch {
        return;
      }

      for (const item of list) {
        const full = path.join(dir, item);
        let stat;
        try {
          stat = fs.statSync(full);
        } catch {
          continue;
        }
        if (stat.isDirectory()) {
          const name = item;
          if (skipDirs.has(name)) continue;
          walk(full, depth + 1);
          continue;
        }
        if (!stat.isFile()) continue;

        if (item === 'package.json') {
          const parsed = readJsonIfExists(full);
          if (parsed) {
            const s = scorePath(full);
            if (s > results.pkgScore) {
              results.pkgScore = s;
              results.pkg = parsed;
            }
          }
        }

        if (item === 'tsconfig.json' || item === 'jsconfig.json') {
          const parsed = parseTsConfig(full);
          if (parsed && parsed.compilerOptions) {
            const s = scorePath(full);
            if (s > results.tsScore) {
              results.tsScore = s;
              results.ts = parsed;
              results.baseUrl = parsed.compilerOptions.baseUrl || null;
            }
          }
        }
      }
    }

    walk(start, 0);

    let tsconfigPaths = null;
    if (results.ts && results.ts.compilerOptions) {
      tsconfigPaths = results.ts.compilerOptions.paths || null;
    }

    return { packageJson: results.pkg, tsconfigPaths, baseUrl: results.baseUrl };
  }

  // Read package.json (prefer exact root; fallback to nested monorepo best match)
  let packageJson = null;
  const pkgPath = path.join(projectRoot, 'package.json');
  if (fs.existsSync(pkgPath)) {
    const parsed = readJsonIfExists(pkgPath);
    if (parsed) packageJson = parsed;
  }

  // Read tsconfig.json or jsconfig.json (prefer exact root; fallback to nested best match)
  let tsconfigPaths = null;
  let baseUrl = null;
  let configPath = path.join(projectRoot, 'tsconfig.json');
  if (!fs.existsSync(configPath)) {
    configPath = path.join(projectRoot, 'jsconfig.json');
  }

  if (fs.existsSync(configPath)) {
    const parsed = parseTsConfig(configPath);
    if (parsed && parsed.compilerOptions) {
      tsconfigPaths = parsed.compilerOptions.paths || null;
      baseUrl = parsed.compilerOptions.baseUrl || null;
    }
  }

  // Fallback: if either packageJson or tsconfigPaths is missing, try a best nested match.
  if (!packageJson || !tsconfigPaths || baseUrl === null) {
    const best = findBestConfigFiles(projectRoot);
    if (!packageJson && best.packageJson) packageJson = best.packageJson;
    if (!tsconfigPaths && best.tsconfigPaths) tsconfigPaths = best.tsconfigPaths;
    if ((baseUrl === null || baseUrl === undefined) && best.baseUrl !== undefined) baseUrl = best.baseUrl;
  }

  return { files, packageJson, tsconfigPaths, baseUrl };
}

