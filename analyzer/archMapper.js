function getFileComponentId(file) {
  if (!file) return null;
  const layer = file.layer;
  if (layer === 'Test') return 'test-suite';
  if (layer === 'Persistence') return 'database-models';
  if (layer === 'Gateway') return 'api-controllers';
  if (layer === 'Domain') return 'domain-services';
  if (layer === 'Interaction') return 'state-stores';
  if (layer === 'Presentation') return 'ui-views';
  if (layer === 'Infrastructure' || layer === 'Foundation') return 'core-helpers';
  return null;
}

export function mapArchitecture(stack, files, graph) {
  const components = [];
  // Evidence-first naming: component structure should be driven by scanned/graph evidence.
  // Keep `stack` only as a best-effort label provider.
  const detectedKeys = new Set((stack?.detected || []).map(t => t.key));
  const hasTech = (key) => detectedKeys.has(key);

  const hasApiRoutes = files.some(f => f.apiRoute);
  const hasPresentation = files.some(f => f.layer === 'Presentation');
  const hasGateway = files.some(f => f.layer === 'Gateway');
  const hasDomain = files.some(f => f.layer === 'Domain');
  const hasPersistence = files.some(f => f.layer === 'Persistence');

  // 1) Client component (UI always exists when Presentation files exist)
  components.push({
    id: 'client',
    name: hasTech('nextjs') ? 'Next.js App' : (hasTech('react') ? 'React App' : (hasTech('vuejs') ? 'Vue App' : 'Web Client')),
    description: 'Web UI that triggers requests into the backend.',
    type: 'client',
    techKey: hasTech('nextjs') ? 'nextjs' : (hasTech('react') ? 'react' : (hasTech('vuejs') ? 'vuejs' : 'web')),
    brandColor: '#1a2a3a',
    zoneId: 'frontend-zone'
  });

  // 2) API Server component (only when we have gateway/api evidence)
  if (hasApiRoutes || hasGateway) {
    components.push({
      id: 'api-server',
      name: hasTech('express') ? 'Express Server' : (hasTech('nestjs') ? 'NestJS Server' : (hasTech('fastify') ? 'Fastify Server' : 'API Server')),
      description: 'Backend entry point for request routing.',
      type: 'api-gateway',
      techKey: hasTech('express') ? 'express' : (hasTech('nestjs') ? 'nestjs' : (hasTech('fastify') ? 'fastify' : 'api')),
      brandColor: '#1a1a1a',
      zoneId: 'api-zone'
    });
  }

  // 3) Auth component (evidence-based: auth-related dependencies or env usage)
  const authEvidence = files.some(f =>
    (f.imports || []).some(imp => {
      const s = (imp?.specifier || '').toLowerCase();
      return (
        s.includes('next-auth') ||
        s.includes('@auth0/nextjs-auth0') ||
        s.includes('@auth0/auth0-react') ||
        s.includes('@clerk/nextjs') ||
        s.includes('jsonwebtoken')
      );
    })
  );

  if (authEvidence || hasTech('nextauth') || hasTech('auth0') || hasTech('clerk') || hasTech('jwt')) {
    components.push({
      id: 'auth-service',
      name: hasTech('nextauth') ? 'NextAuth.js' : (hasTech('auth0') ? 'Auth0' : (hasTech('clerk') ? 'Clerk Auth' : 'Auth Service')),
      description: 'Authenticates users and protects routes.',
      type: 'auth',
      techKey: hasTech('nextauth') ? 'nextauth' : (hasTech('auth0') ? 'auth0' : (hasTech('clerk') ? 'clerk' : 'auth')),
      brandColor: '#1a0a2a',
      zoneId: 'api-zone'
    });
  }

  // 4) Database component (evidence-based from Persistence layer)
  if (hasPersistence) {
    const dbName = hasTech('mongoose') ? 'MongoDB'
      : (hasTech('postgresql') ? 'PostgreSQL'
        : (hasTech('mysql') ? 'MySQL'
          : (hasTech('sqlite') ? 'SQLite' : 'Database')));

    components.push({
      id: 'database',
      name: dbName,
      description: 'Persists domain data.',
      type: 'database',
      techKey: hasTech('mongoose') ? 'mongoose'
        : (hasTech('postgresql') ? 'postgresql'
          : (hasTech('mysql') ? 'mysql'
            : (hasTech('sqlite') ? 'sqlite' : 'db'))),
      brandColor: '#0a1a2a',
      zoneId: 'data-zone'
    });
  }

  // 5) Cache component (evidence-based from Redis usage)
  const cacheEvidence = files.some(f =>
    (f.imports || []).some(imp => String(imp?.specifier || '').toLowerCase().includes('redis'))
    || (f.envVars || []).some(v => String(v).toLowerCase().includes('redis'))
  );
  if (cacheEvidence || hasTech('redis')) {
    components.push({
      id: 'cache-server',
      name: 'Redis Cache',
      description: 'Caches computed results.',
      type: 'cache',
      techKey: 'redis',
      brandColor: '#2a0a0a',
      zoneId: 'data-zone'
    });
  }

  // 6) Optional Cloud/DevOps: only add when graph shows any import usage.
  const fileByRel = new Map(files.map(f => [f.relativePath, f]));
  const usesDependency = (depNeedle) => {
    const needle = String(depNeedle || '').toLowerCase();
    return (graph?.edges || []).some(e => {
      const src = fileByRel.get(e.source);
      const tgt = fileByRel.get(e.target);
      const hit = [src, tgt].some(x =>
        x && (x.imports || []).some(i => String(i?.specifier || '').toLowerCase().includes(needle))
      );
      return hit;
    });
  };

  const awsServices = (stack?.detected || []).filter(t => t.category === 'cloud' && t.key.startsWith('aws-'));
  for (const aws of awsServices) {
    const awsNeedle = (aws.service || aws.key || '').toLowerCase();
    if (!usesDependency(awsNeedle)) continue;

    let serviceType = 'cloud';
    if (aws.service === 'SQS') serviceType = 'queue';
    if (aws.service === 'DynamoDB') serviceType = 'database';

    components.push({
      id: `aws-${(aws.service || aws.key).toLowerCase()}`,
      name: aws.name,
      description: `AWS hosted cloud ${aws.service || ''} service.`,
      type: serviceType,
      techKey: aws.key,
      brandColor: '#FF9900',
      zoneId: 'cloud-zone'
    });
  }

  if (hasTech('supabase') && usesDependency('supabase')) {
    components.push({
      id: 'supabase',
      name: 'Supabase Platform',
      description: 'Backend-as-a-Service integration.',
      type: 'cloud',
      techKey: 'supabase',
      brandColor: '#3FCF8E',
      zoneId: 'cloud-zone'
    });
  }

  if (hasTech('firebase') && usesDependency('firebase')) {
    components.push({
      id: 'firebase',
      name: 'Firebase Platform',
      description: 'Backend-as-a-Service platform.',
      type: 'cloud',
      techKey: 'firebase',
      brandColor: '#FFCA28',
      zoneId: 'cloud-zone'
    });
  }

  if (hasTech('docker') && usesDependency('docker')) {
    components.push({
      id: 'docker',
      name: 'Docker Container',
      description: 'Containerized environment.',
      type: 'infra',
      techKey: 'docker',
      brandColor: '#2496ED',
      zoneId: 'infra-zone'
    });
  }

  if (hasTech('gha') && usesDependency('.github/workflows')) {
    components.push({
      id: 'github-actions',
      name: 'CI/CD Pipeline',
      description: 'GitHub workflow automation.',
      type: 'infra',
      techKey: 'gha',
      brandColor: '#2088FF',
      zoneId: 'infra-zone'
    });
  }


  // 2. Folder-Based Dynamic Components
  const counts = {
    'ui-views': 0,
    'api-controllers': 0,
    'domain-services': 0,
    'database-models': 0,
    'core-helpers': 0,
    'state-stores': 0,
    'test-suite': 0
  };
  for (const f of files) {
    const cid = getFileComponentId(f);
    if (cid) counts[cid]++;
  }

  if (counts['ui-views'] > 0) {
    components.push({
      id: 'ui-views',
      name: 'UI Views & Components',
      description: `Manages user interfaces and custom widgets (${counts['ui-views']} files).`,
      type: 'client',
      techKey: 'react',
      brandColor: '#A855F7',
      zoneId: 'frontend-zone'
    });
  }
  if (counts['state-stores'] > 0) {
    components.push({
      id: 'state-stores',
      name: 'State Stores & Hooks',
      description: `Manages client state machines and reactive custom hooks (${counts['state-stores']} files).`,
      type: 'client',
      techKey: 'zustand',
      brandColor: '#EC4899',
      zoneId: 'frontend-zone'
    });
  }
  if (counts['api-controllers'] > 0) {
    components.push({
      id: 'api-controllers',
      name: 'API Handlers & Controllers',
      description: `Handles REST endpoints, routing, and request routing (${counts['api-controllers']} files).`,
      type: 'api-gateway',
      techKey: 'express',
      brandColor: '#3B82F6',
      zoneId: 'api-zone'
    });
  }
  if (counts['domain-services'] > 0) {
    components.push({
      id: 'domain-services',
      name: 'Domain Logic Services',
      description: `Encapsulates business domain usecases and logic handlers (${counts['domain-services']} files).`,
      type: 'service',
      techKey: 'inline',
      brandColor: '#06B6D4',
      zoneId: 'api-zone'
    });
  }
  if (counts['database-models'] > 0) {
    components.push({
      id: 'database-models',
      name: 'Database Models & Operations',
      description: `Performs SQL schema mapping, model declaration, and DB queries (${counts['database-models']} files).`,
      type: 'database',
      techKey: 'prisma',
      brandColor: '#22C55E',
      zoneId: 'data-zone'
    });
  }
  if (counts['core-helpers'] > 0) {
    components.push({
      id: 'core-helpers',
      name: 'Core Helpers & Utilities',
      description: `Provides shared utilities, libraries, and common wrappers (${counts['core-helpers']} files).`,
      type: 'infra',
      techKey: 'inline',
      brandColor: '#7A7268',
      zoneId: 'infra-zone'
    });
  }
  if (counts['test-suite'] > 0) {
    components.push({
      id: 'test-suite',
      name: 'Automated Test Suite',
      description: `Contains tests, mocks, specs, and validation setups (${counts['test-suite']} files).`,
      type: 'infra',
      techKey: 'jest',
      brandColor: '#EAB308',
      zoneId: 'infra-zone'
    });
  }

  // Sort components by type priority to assign numbers
  const priorityMap = {
    'client': 1,
    'api-gateway': 2,
    'auth': 3,
    'database': 4,
    'cache': 5,
    'queue': 6,
    'cloud': 7,
    'infra': 8
  };
  components.sort((a, b) => (priorityMap[a.type] || 9) - (priorityMap[b.type] || 9));

  components.forEach((comp, idx) => {
    comp.number = idx + 1;
    comp.connectedTo = [];
  });

  const connections = [];
  const compMap = new Map();
  for (const comp of components) {
    compMap.set(comp.id, comp);
  }

  const connect = (fromId, toId) => {
    if (compMap.has(fromId) && compMap.has(toId)) {
      connections.push({ from: fromId, to: toId });
      const fromComp = compMap.get(fromId);
      if (!fromComp.connectedTo.includes(toId)) {
        fromComp.connectedTo.push(toId);
      }
    }
  };

  const hasComp = (id) => compMap.has(id);

  // Dynamic connections from codebase import graph
  for (const edge of graph.edges) {
    const sourceFile = files.find(f => f.relativePath === edge.source);
    const targetFile = files.find(f => f.relativePath === edge.target);
    const fromCompId = getFileComponentId(sourceFile);
    const toCompId = getFileComponentId(targetFile);
    if (fromCompId && toCompId && fromCompId !== toCompId) {
      connect(fromCompId, toCompId);
    }
  }

  // Connect base stack components
  if (hasComp('client')) {
    if (hasComp('ui-views')) connect('client', 'ui-views');
    else if (hasComp('api-server')) connect('client', 'api-server');
  }
  if (hasComp('ui-views')) {
    if (hasComp('state-stores')) connect('ui-views', 'state-stores');
    if (hasComp('api-controllers')) connect('ui-views', 'api-controllers');
    else if (hasComp('api-server')) connect('ui-views', 'api-server');
  }
  if (hasComp('state-stores') && hasComp('api-controllers')) {
    connect('state-stores', 'api-controllers');
  }
  if (hasComp('api-server')) {
    if (hasComp('api-controllers')) connect('api-server', 'api-controllers');
    if (hasComp('database')) connect('api-server', 'database');
    if (hasComp('cache-server')) connect('api-server', 'cache-server');
    if (hasComp('auth-service')) connect('api-server', 'auth-service');
  }
  if (hasComp('api-controllers')) {
    if (hasComp('domain-services')) connect('api-controllers', 'domain-services');
    else if (hasComp('database-models')) connect('api-controllers', 'database-models');
    else if (hasComp('database')) connect('api-controllers', 'database');
  }
  if (hasComp('domain-services')) {
    if (hasComp('database-models')) connect('domain-services', 'database-models');
    else if (hasComp('database')) connect('domain-services', 'database');
  }
  if (hasComp('database-models') && hasComp('database')) {
    connect('database-models', 'database');
  }

  // Connect AWS/Cloud integrations
  for (const comp of components) {
    if (comp.id.startsWith('aws-') || comp.id === 'supabase' || comp.id === 'firebase') {
      if (hasComp('domain-services')) connect('domain-services', comp.id);
      else if (hasComp('api-controllers')) connect('api-controllers', comp.id);
      else if (hasComp('api-server')) connect('api-server', comp.id);
    }
  }

  // Build zones
  const zones = [];
  const zoneDefs = [
    { id: 'frontend-zone', name: 'Frontend', color: 'rgba(255,77,0,0.06)', border: '#FF4D00' },
    { id: 'api-zone', name: 'API Layer', color: 'rgba(59,130,246,0.06)', border: '#3B82F6' },
    { id: 'data-zone', name: 'Data Layer', color: 'rgba(34,197,94,0.06)', border: '#22C55E' },
    { id: 'cloud-zone', name: 'Cloud Services', color: 'rgba(255,153,0,0.06)', border: '#FF9900' },
    { id: 'infra-zone', name: 'Infrastructure', color: 'rgba(75,85,99,0.06)', border: '#4B5563' }
  ];

  for (const zDef of zoneDefs) {
    const compIds = components.filter(c => c.zoneId === zDef.id).map(c => c.id);
    if (compIds.length > 0) {
      zones.push({
        id: zDef.id,
        name: zDef.name,
        color: zDef.color,
        border: zDef.border,
        componentIds: compIds
      });
    }
  }

  return { components, zones, connections };
}
