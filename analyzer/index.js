import path from 'path';
import { scanFiles } from './fileScanner.js';
import { detectStack } from './stackDetector.js';
import { parseImports } from './importParser.js';
import { detectLayers } from './layerDetector.js';
import { buildGraph, detectLayerViolations, computeSystemHealth } from './graphBuilder.js';
import { mapArchitecture } from './archMapper.js';
import { generateSystemSpec } from './specGenerator.js';
import { parseSchemas } from './schemaParser.js';

export async function analyzeProject(projectRoot, onProgress = null) {
  console.log(`[X-RAY] Initiating analysis on project root: ${projectRoot}`);
  
  // Phase 1: Scan files
  console.log('[X-RAY] Phase 1: Scanning files...');
  onProgress?.('scan', 15, 'Scanning source files & directory structure...');
  const { files, packageJson, tsconfigPaths, baseUrl } = await scanFiles(projectRoot);
  
  if (!files || files.length === 0) {
    throw new Error('No supported source files found in this project.');
  }
  console.log(`[X-RAY] Found ${files.length} source files.`);

  // Phase 2: Parse imports
  console.log('[X-RAY] Phase 2: Parsing multi-language imports & AST structure...');
  onProgress?.('parse', 35, `Parsing AST & imports across ${files.length} files...`);
  const parsedFiles = parseImports(files, projectRoot, tsconfigPaths || null);

  // Phase 3: Detect stack
  console.log('[X-RAY] Phase 3: Detecting tech stack...');
  onProgress?.('stack', 50, 'Fingerprinting frameworks & tech stack...');
  const stack = detectStack(packageJson || {}, parsedFiles);

  // Phase 4: Detect layers
  console.log('[X-RAY] Phase 4: Classifying architectural layers...');
  onProgress?.('layers', 65, 'Classifying domain layers & architecture...');
  const layeredFiles = detectLayers(parsedFiles);

  // Phase 5: Build graph
  console.log('[X-RAY] Phase 5: Building dependency graph & finding issues...');
  onProgress?.('graph', 80, 'Building dependency graph & detecting circular cycles...');
  const graph = buildGraph(layeredFiles);

  // Phase 6: Map architecture
  console.log('[X-RAY] Phase 6: Mapping system architecture components...');
  const arch = mapArchitecture(stack, layeredFiles, graph);

  // Phase 7: Detect layer violations (Pillar 1)
  console.log('[X-RAY] Phase 7: Detecting layer violations...');
  onProgress?.('metrics', 90, 'Computing coupling metrics & layer violations...');
  const layerViolations = detectLayerViolations(layeredFiles, graph.edges);

  // Phase 8: Compute system health metrics (Pillar 3)
  console.log('[X-RAY] Phase 8: Computing system health metrics...');
  const healthData = computeSystemHealth(graph.nodes, graph.edges, layeredFiles);

  // Phase 9: Parse database schemas (Pillar 4)
  console.log('[X-RAY] Phase 9: Parsing database schemas (Prisma/SQL/TypeORM/Mongoose/SQLAlchemy/Django)...');
  onProgress?.('schema', 95, 'Extracting database schema & relationships...');
  const dbSchema = parseSchemas(parsedFiles);
  console.log(`[X-RAY] Found ${dbSchema.length} database table schemas.`);

  console.log('[X-RAY] Analysis complete. Building response payload...');
  onProgress?.('spec', 98, 'Generating living system specification...');

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

  // Build final ScanResult
  const result = {
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
      missingEnvVars: graph.missingEnvVars,
      layerViolations
    },
    healthMetrics: healthData.metrics,
    healthSummary: healthData.summary,
    files: layeredFiles.map(f => {
      const node = graph.nodes.find(n => n.id === f.relativePath) || {};
      const healthNode = healthData.metrics.find(m => m.id === f.relativePath);
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
        isEntryPoint: node.isEntryPoint || false,
        afferentCoupling: healthNode?.afferentCoupling || 0,
        efferentCoupling: healthNode?.efferentCoupling || 0,
        instability: healthNode?.instability || 0.5,
        riskScore: healthNode?.riskScore || 0,
        healthFlags: healthNode?.flags || []
      };
    })
  };

  // Phase 10: Generate living system specification (Pillar 2)
  console.log('[X-RAY] Phase 10: Generating system specification...');
  result.systemSpec = generateSystemSpec(layeredFiles, stack, arch, graph, languageBreakdown);

  // Add database schema to result
  result.dbSchema = dbSchema;

  return result;
}

