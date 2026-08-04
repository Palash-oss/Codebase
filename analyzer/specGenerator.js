// ────────────────────────────────────────────────────────────────────────────
// Pillar 2: Living System Specifications & Compliance Engine
// ────────────────────────────────────────────────────────────────────────────

export function generateSystemSpec(files, stack, arch, graph, languageBreakdown) {
  // 1. API Endpoint Registry
  const apiEndpoints = [];
  for (const f of files) {
    if (f.apiRoute || (f.httpMethods && f.httpMethods.length > 0)) {
      const methods = (f.httpMethods && f.httpMethods.length > 0)
        ? f.httpMethods
        : ['GET'];

      // Infer route path from file path
      let routePath = f.relativePath;
      const apiMatch = routePath.match(/(?:api|routes|controllers)\/(.*)/i);
      if (apiMatch) {
        routePath = '/api/' + apiMatch[1]
          .replace(/\.(js|ts|jsx|tsx|mjs|cjs)$/i, '')
          .replace(/\/index$/i, '')
          .replace(/\[([^\]]+)\]/g, ':$1');
      }

      apiEndpoints.push({
        path: routePath,
        methods,
        handler: f.relativePath,
        layer: f.layer || 'Unknown',
        lines: f.lines || 0
      });
    }
  }

  // 2. Environment Variable Inventory
  const envVarMap = new Map(); // varName -> { files: [], status: 'defined' | 'missing' }
  const definedEnvVars = new Set();

  // Collect defined env vars from findings
  for (const f of files) {
    for (const ev of (f.envVars || [])) {
      if (!envVarMap.has(ev)) {
        envVarMap.set(ev, { files: [], status: 'unknown' });
      }
      envVarMap.get(ev).files.push(f.relativePath);
    }
  }

  // Check which env vars have findings for "Missing Env Var"
  const graphNodes = graph?.nodes || [];
  for (const node of graphNodes) {
    for (const finding of (node.findings || [])) {
      if (finding.rule === 'Missing Env Var') {
        const match = finding.message.match(/process\.env\.(\w+)/);
        if (match && envVarMap.has(match[1])) {
          envVarMap.get(match[1]).status = 'missing';
        }
      }
    }
  }

  // Mark remaining as defined
  for (const [key, val] of envVarMap) {
    if (val.status === 'unknown') val.status = 'defined';
  }

  const envVarInventory = Array.from(envVarMap.entries()).map(([name, data]) => ({
    name,
    status: data.status,
    usedInFiles: [...new Set(data.files)],
    fileCount: new Set(data.files).size
  })).sort((a, b) => {
    if (a.status === 'missing' && b.status !== 'missing') return -1;
    if (a.status !== 'missing' && b.status === 'missing') return 1;
    return b.fileCount - a.fileCount;
  });

  // 3. External Dependency Map
  const externalDeps = new Map();
  for (const f of files) {
    for (const imp of (f.imports || [])) {
      if (imp.status === 'external' || (!imp.resolvedPath && imp.specifier && !imp.specifier.startsWith('.'))) {
        const pkg = imp.specifier;
        if (!pkg) continue;
        // Normalize scoped packages
        const pkgName = pkg.startsWith('@') ? pkg.split('/').slice(0, 2).join('/') : pkg.split('/')[0];
        if (!externalDeps.has(pkgName)) {
          externalDeps.set(pkgName, { usedInFiles: new Set(), category: 'library' });
        }
        externalDeps.get(pkgName).usedInFiles.add(f.relativePath);
      }
    }
  }

  // Categorize known external deps
  const depCategories = {
    'express': 'server', 'fastify': 'server', 'koa': 'server', 'hapi': 'server',
    'react': 'frontend', 'vue': 'frontend', 'svelte': 'frontend', 'angular': 'frontend', 'next': 'frontend',
    'prisma': 'database', 'drizzle-orm': 'database', 'mongoose': 'database', 'sequelize': 'database', 'typeorm': 'database',
    'redis': 'cache', 'ioredis': 'cache',
    'jsonwebtoken': 'auth', 'bcrypt': 'auth', 'passport': 'auth', 'next-auth': 'auth',
    'jest': 'testing', 'vitest': 'testing', 'mocha': 'testing', 'cypress': 'testing',
    'aws-sdk': 'cloud', '@aws-sdk': 'cloud', 'firebase': 'cloud', '@supabase': 'cloud',
    'docker': 'devops', 'dotenv': 'config', 'cors': 'middleware', 'multer': 'middleware'
  };

  const externalDependencies = Array.from(externalDeps.entries()).map(([name, data]) => {
    let category = 'library';
    for (const [key, cat] of Object.entries(depCategories)) {
      if (name.includes(key)) { category = cat; break; }
    }
    return {
      name,
      category,
      usedInFileCount: data.usedInFiles.size,
      usedInFiles: [...data.usedInFiles].slice(0, 10)
    };
  }).sort((a, b) => b.usedInFileCount - a.usedInFileCount);

  // 4. Architecture Component Summary
  const componentSummary = (arch?.components || []).map(c => ({
    id: c.id,
    name: c.name,
    type: c.type,
    description: c.description,
    zoneId: c.zoneId,
    connectedTo: c.connectedTo || []
  }));

  // 5. Codebase Statistics
  const totalFiles = files.length;
  const totalLines = files.reduce((sum, f) => sum + (f.lines || 0), 0);
  const layerDistribution = {};
  for (const f of files) {
    const layer = f.layer || 'Unknown';
    layerDistribution[layer] = (layerDistribution[layer] || 0) + 1;
  }

  return {
    apiEndpoints,
    envVarInventory,
    externalDependencies,
    componentSummary,
    languageBreakdown: languageBreakdown || [],
    statistics: {
      totalFiles,
      totalLines,
      layerDistribution,
      apiEndpointCount: apiEndpoints.length,
      envVarCount: envVarInventory.length,
      missingEnvVarCount: envVarInventory.filter(e => e.status === 'missing').length,
      externalDepCount: externalDependencies.length
    }
  };
}

// Generate downloadable markdown specification
export function generateSpecMarkdown(spec, projectName) {
  const lines = [];
  lines.push(`# ${projectName} — System Architecture Specification`);
  lines.push(`> Auto-generated by CodeBase X-Ray | ${new Date().toISOString().split('T')[0]}`);
  lines.push('');

  // Statistics
  lines.push('## Codebase Overview');
  lines.push(`| Metric | Value |`);
  lines.push(`| :--- | :--- |`);
  lines.push(`| Total Files | ${spec.statistics.totalFiles} |`);
  lines.push(`| Total Lines of Code | ${spec.statistics.totalLines.toLocaleString()} |`);
  lines.push(`| API Endpoints | ${spec.statistics.apiEndpointCount} |`);
  lines.push(`| Environment Variables | ${spec.statistics.envVarCount} (${spec.statistics.missingEnvVarCount} missing) |`);
  lines.push(`| External Dependencies | ${spec.statistics.externalDepCount} |`);
  lines.push('');

  // Layer distribution
  lines.push('## Layer Distribution');
  lines.push('| Layer | File Count |');
  lines.push('| :--- | :--- |');
  for (const [layer, count] of Object.entries(spec.statistics.layerDistribution).sort((a, b) => b[1] - a[1])) {
    lines.push(`| ${layer} | ${count} |`);
  }
  lines.push('');

  // API Endpoints
  if (spec.apiEndpoints.length > 0) {
    lines.push('## API Endpoint Registry');
    lines.push('| Methods | Route Path | Handler | Layer |');
    lines.push('| :--- | :--- | :--- | :--- |');
    for (const ep of spec.apiEndpoints) {
      lines.push(`| ${ep.methods.join(', ')} | ${ep.path} | ${ep.handler} | ${ep.layer} |`);
    }
    lines.push('');
  }

  // Environment Variables
  if (spec.envVarInventory.length > 0) {
    lines.push('## Environment Variable Audit');
    lines.push('| Variable | Status | Used In |');
    lines.push('| :--- | :--- | :--- |');
    for (const ev of spec.envVarInventory) {
      const statusIcon = ev.status === 'missing' ? 'MISSING' : 'Defined';
      lines.push(`| ${ev.name} | ${statusIcon} | ${ev.fileCount} file(s) |`);
    }
    lines.push('');
  }

  // External Dependencies
  if (spec.externalDependencies.length > 0) {
    lines.push('## External Dependencies');
    lines.push('| Package | Category | Used In |');
    lines.push('| :--- | :--- | :--- |');
    for (const dep of spec.externalDependencies.slice(0, 30)) {
      lines.push(`| ${dep.name} | ${dep.category} | ${dep.usedInFileCount} file(s) |`);
    }
    lines.push('');
  }

  // Architecture Components
  if (spec.componentSummary.length > 0) {
    lines.push('## Architecture Components');
    lines.push('| Component | Type | Description |');
    lines.push('| :--- | :--- | :--- |');
    for (const comp of spec.componentSummary) {
      lines.push(`| ${comp.name} | ${comp.type} | ${comp.description} |`);
    }
  }

  return lines.join('\n');
}
