import fs from 'fs';
import path from 'path';

export function buildGraph(files) {
  // Find projectRoot
  let projectRoot = '';
  if (files.length > 0) {
    const firstFile = files[0];
    const absoluteDir = path.dirname(firstFile.path);
    const relDir = firstFile.directory;
    if (relDir === '' || relDir === '.') {
      projectRoot = absoluteDir;
    } else {
      projectRoot = path.resolve(absoluteDir, '..'.repeat(relDir.split('/').length));
    }
  }

  // Build Nodes
  const nodes = files.map(file => {
    // isEntryPoint check
    const lowerName = file.name.toLowerCase();
    let isEntryPoint = false;
    
    if (lowerName === 'index.js' || lowerName === 'index.ts' ||
        lowerName === 'main.js' || lowerName === 'main.ts' ||
        lowerName === 'app.js' || lowerName === 'app.tsx' ||
        lowerName === 'server.js' || lowerName === 'server.ts') {
      isEntryPoint = true;
    }
    
    return {
      id: file.relativePath,
      label: file.name,
      layer: file.layer || 'Unknown',
      incomingCount: 0,
      outgoingCount: 0,
      centrality: 0,
      isEntryPoint,
      findings: []
    };
  });

  const nodeMap = new Map();
  for (const node of nodes) {
    nodeMap.set(node.id, node);
  }

  // Build Edges
  const edges = [];
  for (const file of files) {
    for (const imp of file.imports) {
      if (imp.status === 'resolved' && imp.resolvedPath) {
        edges.push({
          source: file.relativePath,
          target: imp.resolvedPath,
          kind: 'static'
        });
      }
    }
  }

  // Compute incoming/outgoing counts
  for (const edge of edges) {
    const src = nodeMap.get(edge.source);
    const tgt = nodeMap.get(edge.target);
    if (src) src.outgoingCount++;
    if (tgt) tgt.incomingCount++;
  }

  // Compute EntryPoints from pages/ or app/ root with no incoming edges
  for (const node of nodes) {
    if (!node.isEntryPoint) {
      const isPageOrApp = node.id.startsWith('pages/') || node.id.startsWith('app/') || node.id.startsWith('src/pages/') || node.id.startsWith('src/app/');
      if (isPageOrApp && node.incomingCount === 0) {
        node.isEntryPoint = true;
      }
    }
  }

  // Compute centrality
  for (const node of nodes) {
    node.centrality = node.incomingCount * node.outgoingCount;
  }

  // 1. Find circular dependencies using DFS
  const circularDeps = [];
  const visited = new Set();
  
  function detectCycles() {
    const pathStack = [];
    const pathSet = new Set();
    const localVisited = new Set();

    function dfs(nodeId) {
      if (pathSet.has(nodeId)) {
        const idx = pathStack.indexOf(nodeId);
        const cycle = pathStack.slice(idx);
        cycle.push(nodeId); // complete the cycle visually
        // Avoid duplicate representations of the same cycle
        const sortedStr = [...cycle].sort().join(',');
        if (!visited.has(sortedStr)) {
          visited.add(sortedStr);
          circularDeps.push(cycle);
        }
        return;
      }
      if (localVisited.has(nodeId)) return;

      pathStack.push(nodeId);
      pathSet.add(nodeId);
      localVisited.add(nodeId);

      const outgoingEdges = edges.filter(e => e.source === nodeId);
      for (const edge of outgoingEdges) {
        dfs(edge.target);
      }

      pathSet.delete(nodeId);
      pathStack.pop();
    }

    for (const node of nodes) {
      dfs(node.id);
    }
  }
  detectCycles();

  // 2. Find dead files (incomingCount === 0 AND isEntryPoint === false)
  const deadFiles = nodes
    .filter(n => n.incomingCount === 0 && !n.isEntryPoint)
    .map(n => n.id);

  // Add findings to dead files
  for (const dfId of deadFiles) {
    const node = nodeMap.get(dfId);
    if (node) {
      node.findings.push({
        type: 'warning',
        rule: 'Dead File',
        message: 'This file has no incoming imports and is not an entry point.',
        suggestion: 'Consider deleting this file or importing it.'
      });
    }
  }

  // 3. Find dead exports
  const deadExports = [];
  for (const file of files) {
    for (const exp of file.exports) {
      // Skip wildcard/reexports from dead exports check
      if (exp.name === '*' || exp.kind === 'reexport') continue;

      let isUsed = false;
      // Search all other files
      for (const otherFile of files) {
        if (otherFile.relativePath === file.relativePath) continue;
        for (const imp of otherFile.imports) {
          if (imp.resolvedPath === file.relativePath) {
            // If it's a namespace import '*', all exports might be used
            if (imp.type === 'namespace' || imp.names.includes('*')) {
              isUsed = true;
              break;
            }
            if (imp.names.includes(exp.name)) {
              isUsed = true;
              break;
            }
            // If it's default import and we are checking default export
            if (exp.name === 'default' && imp.type === 'default') {
              isUsed = true;
              break;
            }
          }
        }
        if (isUsed) break;
      }

      if (!isUsed) {
        deadExports.push({
          file: file.relativePath,
          export: exp.name,
          kind: exp.kind
        });
      }
    }
  }

  // Add dead export findings
  for (const de of deadExports) {
    const node = nodeMap.get(de.file);
    if (node) {
      node.findings.push({
        type: 'warning',
        rule: 'Dead Export',
        message: `Export '${de.export}' (${de.kind}) is not imported anywhere in the project.`,
        suggestion: `Remove the 'export' keyword or delete the unused export.`
      });
    }
  }

  // 4. Find missing env vars
  const missingEnvVars = [];
  const envExampleNames = new Set();
  const envFiles = ['.env.example', '.env.local.example', '.env'];
  
  if (projectRoot) {
    for (const ef of envFiles) {
      const efPath = path.join(projectRoot, ef);
      if (fs.existsSync(efPath)) {
        try {
          const content = fs.readFileSync(efPath, 'utf8');
          content.split('\n').forEach(line => {
            const m = line.match(/^\s*([^#=\s]+)\s*=/);
            if (m) {
              envExampleNames.add(m[1].trim());
            }
          });
        } catch {}
      }
    }
  }

  // Collect all envVars across files
  const allEnvVars = new Set();
  for (const file of files) {
    for (const ev of (file.envVars || [])) {
      allEnvVars.add(ev);
    }
  }

  for (const ev of allEnvVars) {
    if (!envExampleNames.has(ev)) {
      missingEnvVars.push(ev);
    }
  }

  // Add missing env var findings to files referencing them
  for (const ev of missingEnvVars) {
    for (const file of files) {
      if (file.envVars && file.envVars.includes(ev)) {
        const node = nodeMap.get(file.relativePath);
        if (node) {
          node.findings.push({
            type: 'error',
            rule: 'Missing Env Var',
            message: `Environment variable 'process.env.${ev}' is used but not defined in any .env.example files.`,
            suggestion: `Add '${ev}=' to your .env.example file.`
          });
        }
      }
    }
  }

  // Add circular dependencies findings to nodes involved
  for (const cycle of circularDeps) {
    // Mark nodes in cycle
    for (const nodeId of cycle) {
      const node = nodeMap.get(nodeId);
      if (node) {
        node.findings.push({
          type: 'warning',
          rule: 'Circular Dependency',
          message: `File is part of a circular dependency path: ${cycle.join(' -> ')}`,
          suggestion: 'Refactor imports to break the cycle (e.g., move shared code to a common helper).'
        });
      }
    }
  }

  return { nodes, edges, circularDeps, deadFiles, deadExports, missingEnvVars };
}

export function computeImpactRadius(targetRelativePath, nodes, edges) {
  const directSet = new Set();
  for (const edge of edges) {
    if (edge.target === targetRelativePath && edge.source !== targetRelativePath) {
      directSet.add(edge.source);
    }
  }
  const directImpact = Array.from(directSet);

  const indirectSet = new Set();
  for (const direct of directImpact) {
    for (const edge of edges) {
      if (edge.target === direct && edge.source !== direct) {
        if (!directSet.has(edge.source) && edge.source !== targetRelativePath) {
          indirectSet.add(edge.source);
        }
      }
    }
  }
  const indirectImpact = Array.from(indirectSet).slice(0, 50);

  const totalFiles = nodes.length || 1;
  const affected = directImpact.length + indirectImpact.length;
  const safetyScore = Math.round(Math.max(0, 100 - (affected / totalFiles) * 100));

  let severity = 'safe';
  if (safetyScore < 25) {
    severity = 'critical';
  } else if (safetyScore < 50) {
    severity = 'high';
  } else if (safetyScore < 70) {
    severity = 'medium';
  } else if (safetyScore < 90) {
    severity = 'low';
  }

  return {
    targetPath: targetRelativePath,
    directImpact,
    indirectImpact,
    totalAffected: affected,
    safetyScore,
    severity
  };
}
