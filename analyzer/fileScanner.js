import fs from 'fs';
import path from 'path';

export async function scanFiles(projectRoot) {
  const files = [];
  
  const skipDirs = new Set([
    'node_modules', '.git', 'dist', 'build', '.next', 'out',
    'coverage', '.turbo', '__pycache__', '.cache', '.vercel',
    '.netlify', '.svelte-kit', 'vendor', 'bower_components'
  ]);
  
  const includeExts = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']);
  
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
        if (includeExts.has(ext)) {
          // EXCLUDE checks: anything ending in .d.ts, .min.js, .min.ts, .test.js.map, .spec.js.map
          if (item.endsWith('.d.ts') || 
              item.endsWith('.min.js') || 
              item.endsWith('.min.ts') || 
              item.endsWith('.test.js.map') || 
              item.endsWith('.spec.js.map')) {
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
  
  // Read tsconfig.json (handling comments)
  let tsconfigPaths = null;
  let baseUrl = null;
  const tsConfigPath = path.join(projectRoot, 'tsconfig.json');
  if (fs.existsSync(tsConfigPath)) {
    try {
      let rawConfig = fs.readFileSync(tsConfigPath, 'utf8');
      // Strip comments
      rawConfig = rawConfig.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '$1');
      const tsconfig = JSON.parse(rawConfig);
      if (tsconfig.compilerOptions) {
        tsconfigPaths = tsconfig.compilerOptions.paths || null;
        baseUrl = tsconfig.compilerOptions.baseUrl || null;
      }
    } catch (e) {
      console.warn(`[X-RAY] Warning: Failed to parse tsconfig.json: ${e.message}`);
    }
  }
  
  return { files, packageJson, tsconfigPaths, baseUrl };
}
