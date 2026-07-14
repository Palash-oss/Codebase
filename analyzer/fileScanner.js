import fs from 'fs';
import path from 'path';

export async function scanFiles(projectRoot) {
  const files = [];
  
  const skipDirs = new Set([
    'node_modules', '.git', 'dist', 'build', '.next', 'out',
    'coverage', '.turbo', '__pycache__', '.cache', '.vercel',
    '.netlify', '.svelte-kit', 'vendor', 'bower_components'
  ]);
  
  // We no longer limit by includeExts. We fetch ALL files except binaries.
  const excludeExts = new Set([
    '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.webp', '.avif',
    '.mp4', '.webm', '.ogg', '.mp3', '.wav', '.flac', '.aac',
    '.ttf', '.otf', '.woff', '.woff2', '.eot',
    '.pdf', '.zip', '.tar', '.gz', '.rar', '.7z', '.exe', '.dll', '.so', '.dylib', '.bin', '.dat'
  ]);
  
  function walk(dir) {
    const list = fs.readdirSync(dir);
    for (const item of list) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        if (skipDirs.has(item)) {
          continue;
        }
        walk(fullPath);
      } else if (stat.isFile()) {
        const ext = path.extname(item).toLowerCase();
        if (!excludeExts.has(ext)) {
          // EXCLUDE checks: anything ending in .d.ts, .min.js, .min.ts, .test.js.map, .spec.js.map
          if (item.endsWith('.d.ts') || 
              item.endsWith('.min.js') || 
              item.endsWith('.min.ts') || 
              item.endsWith('.test.js.map') || 
              item.endsWith('.spec.js.map') ||
              item === 'package-lock.json' ||
              item === 'yarn.lock' ||
              item === 'pnpm-lock.yaml') {
            continue;
          }
          
          const content = fs.readFileSync(fullPath, 'utf8');
          const relative = path.relative(projectRoot, fullPath);
          const relativePath = relative.replace(/\\/g, '/'); // Use forward slashes
          
          files.push({
            path: path.resolve(fullPath),
            relativePath,
            name: item,
            extension: ext,
            content,
            lines: content.split('\n').length,
            size: stat.size,
            directory: path.dirname(relativePath).replace(/\\/g, '/')
          });
        }
      }
    }
  }
  
  walk(projectRoot);
  
  // Read package.json
  let packageJson = null;
  const pkgPath = path.join(projectRoot, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      packageJson = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    } catch (e) {
      console.warn(`[X-RAY] Warning: Failed to parse package.json: ${e.message}`);
    }
  }
  
  // Read tsconfig.json or jsconfig.json (handling comments)
  let tsconfigPaths = null;
  let baseUrl = null;
  let configPath = path.join(projectRoot, 'tsconfig.json');
  if (!fs.existsSync(configPath)) {
    configPath = path.join(projectRoot, 'jsconfig.json');
  }
  if (fs.existsSync(configPath)) {
    try {
      let rawConfig = fs.readFileSync(configPath, 'utf8');
      // Strip comments
      rawConfig = rawConfig.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '$1');
      const config = JSON.parse(rawConfig);
      if (config.compilerOptions) {
        tsconfigPaths = config.compilerOptions.paths || null;
        baseUrl = config.compilerOptions.baseUrl || null;
      }
    } catch (e) {
      console.warn(`[X-RAY] Warning: Failed to parse configuration file: ${e.message}`);
    }
  }
  
  return { files, packageJson, tsconfigPaths, baseUrl };
}
