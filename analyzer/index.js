import path from 'path';
import { scanFiles } from './fileScanner.js';
import { detectStack } from './stackDetector.js';
import { parseImports } from './importParser.js';
import { detectLayers } from './layerDetector.js';
import { buildGraph } from './graphBuilder.js';
import { mapArchitecture } from './archMapper.js';

export async function analyzeProject(projectRoot) {
  console.log(`[X-RAY] Initiating analysis on project root: ${projectRoot}`);
  
  // Phase 1: Scan files
  console.log('[X-RAY] Phase 2: Scanning files...');
  const { files, packageJson, tsconfigPaths, baseUrl } = await scanFiles(projectRoot);
  
  if (!files || files.length === 0) {
    throw new Error('No JavaScript or TypeScript files found in this project.');
  }
  console.log(`[X-RAY] Found ${files.length} source files.`);

  // Phase 3: Parse imports
  console.log('[X-RAY] Phase 4: Parsing imports & AST structure...');
  const parsedFiles = parseImports(files, projectRoot, tsconfigPaths || null);


  // Phase 2: Detect stack
  console.log('[X-RAY] Phase 3: Detecting stack...');
  const stack = detectStack(packageJson || {}, parsedFiles);

  // Phase 4: Detect layers
  console.log('[X-RAY] Phase 6: Detecting layers...');
  const layeredFiles = detectLayers(parsedFiles);

  // Phase 5: Build graph
  console.log('[X-RAY] Phase 5: Building dependency graph & finding issues...');
  const graph = buildGraph(layeredFiles);

  // Phase 6: Map architecture
  console.log('[X-RAY] Phase 7: Mapping system architecture components...');
  const arch = mapArchitecture(stack, layeredFiles, graph);

  console.log('[X-RAY] Analysis complete. Building response payload...');

  // Compute real language breakdown by total bytes (like GitHub's language bar)
  const langExtMap = {
    '.ts': 'TypeScript', '.tsx': 'TypeScript',
    '.js': 'JavaScript', '.jsx': 'JavaScript', '.mjs': 'JavaScript', '.cjs': 'JavaScript',
    '.css': 'CSS', '.scss': 'CSS', '.sass': 'CSS', '.less': 'CSS',
    '.html': 'HTML', '.htm': 'HTML',
    '.py': 'Python',
    '.sh': 'Shell', '.bash': 'Shell', '.zsh': 'Shell',
    '.go': 'Go',
    '.rb': 'Ruby',
    '.java': 'Java',
    '.rs': 'Rust',
    '.c': 'C', '.h': 'C',
    '.cpp': 'C++', '.cc': 'C++', '.cxx': 'C++', '.hpp': 'C++',
    '.cs': 'C#',
    '.php': 'PHP',
    '.swift': 'Swift',
    '.kt': 'Kotlin',
    '.md': 'Markdown',
    '.json': 'JSON',
    '.yaml': 'YAML', '.yml': 'YAML',
    '.prisma': 'Prisma',
    '.graphql': 'GraphQL', '.gql': 'GraphQL',
    '.sql': 'SQL'
  };
  const langBytes = {};
  let totalLangBytes = 0;
  for (const f of files) {
    const lang = langExtMap[f.extension] || null;
    if (lang && f.size > 0) {
      langBytes[lang] = (langBytes[lang] || 0) + f.size;
      totalLangBytes += f.size;
    }
  }
  const languageBreakdown = Object.entries(langBytes)
    .filter(([, b]) => b > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([lang, bytes]) => ({
      language: lang,
      bytes,
      percentage: totalLangBytes > 0 ? Math.round((bytes / totalLangBytes) * 1000) / 10 : 0
    }));

  // Build and return final ScanResult
  return {
    project: {
      name: packageJson?.name || path.basename(projectRoot),
      version: packageJson?.version || '0.0.0',
      description: packageJson?.description || '',
      totalFiles: files.length,
      totalLines: files.reduce((sum, f) => sum + f.lines, 0),
      scannedAt: new Date().toISOString(),
      projectRoot
    },
    stack: stack,
    languageBreakdown,
    graph: {
      nodes: graph.nodes,
      edges: graph.edges
    },
    layers: {
      Presentation: layeredFiles.filter(f => f.layer === 'Presentation').map(f => f.relativePath),
      Interaction: layeredFiles.filter(f => f.layer === 'Interaction').map(f => f.relativePath),
      Gateway: layeredFiles.filter(f => f.layer === 'Gateway').map(f => f.relativePath),
      Domain: layeredFiles.filter(f => f.layer === 'Domain').map(f => f.relativePath),
      Persistence: layeredFiles.filter(f => f.layer === 'Persistence').map(f => f.relativePath),
      Foundation: layeredFiles.filter(f => f.layer === 'Foundation').map(f => f.relativePath),
      Infrastructure: layeredFiles.filter(f => f.layer === 'Infrastructure').map(f => f.relativePath),
      Test: layeredFiles.filter(f => f.layer === 'Test').map(f => f.relativePath),
      Unknown: layeredFiles.filter(f => f.layer === 'Unknown').map(f => f.relativePath)
    },
    arch: arch,
    findings: {
      circularDeps: graph.circularDeps,
      deadFiles: graph.deadFiles,
      deadExports: graph.deadExports,
      missingEnvVars: graph.missingEnvVars
    },
    files: layeredFiles.map(f => {
      const node = graph.nodes.find(n => n.id === f.relativePath) || {};
      return {
        relativePath: f.relativePath,
        name: f.name,
        extension: f.extension,
        layer: f.layer,
        lines: f.lines,
        size: f.size,
        directory: f.directory,
        imports: f.imports || [],
        exports: f.exports || [],
        apiRoute: f.apiRoute || false,
        httpMethods: f.httpMethods || [],
        fetchUrls: f.fetchUrls || [],
        envVars: f.envVars || [],
        findings: node.findings || [],
        incomingCount: node.incomingCount || 0,
        outgoingCount: node.outgoingCount || 0,
        centrality: node.centrality || 0,
        isEntryPoint: node.isEntryPoint || false
      };
    })
  };
}

