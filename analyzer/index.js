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

  // Phase 2: Detect stack
  console.log('[X-RAY] Phase 3: Detecting stack...');
  const stack = detectStack(packageJson || {}, files);

  // Phase 3: Parse imports
  console.log('[X-RAY] Phase 4: Parsing imports & AST structure...');
  const parsedFiles = parseImports(files, tsconfigPaths || {}, projectRoot);

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

  // Build and return final ScanResult
  return {
    project: {
      name: packageJson?.name || path.basename(projectRoot),
      version: packageJson?.version || '0.0.0',
      description: packageJson?.description || '',
      totalFiles: files.length,
      totalLines: files.reduce((sum, f) => sum + f.lines, 0),
      scannedAt: new Date().toISOString()
    },
    stack: stack,
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
