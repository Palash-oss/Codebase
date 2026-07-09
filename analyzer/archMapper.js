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
  const detectedKeys = new Set(stack.detected.map(t => t.key));
  const hasTech = (key) => detectedKeys.has(key);

  // 1. Stack Components
  // Client component
  let clientComp = null;
  if (hasTech('nextjs')) {
    clientComp = { id: 'client', name: 'Next.js App', description: 'Unified React frontend and API router.', type: 'client', techKey: 'nextjs', brandColor: '#1a1a2e', zoneId: 'frontend-zone' };
  } else if (hasTech('react')) {
    clientComp = { id: 'client', name: 'React App', description: 'Single-page React web application.', type: 'client', techKey: 'react', brandColor: '#1a2a3a', zoneId: 'frontend-zone' };
  } else if (hasTech('vuejs')) {
    clientComp = { id: 'client', name: 'Vue App', description: 'Single-page Vue web application.', type: 'client', techKey: 'vuejs', brandColor: '#1a2a1a', zoneId: 'frontend-zone' };
  } else {
    clientComp = { id: 'client', name: 'Web Client', description: 'Web browser user interface.', type: 'client', techKey: 'react', brandColor: '#2a2a2a', zoneId: 'frontend-zone' };
  }
  components.push(clientComp);

  // API Server component
  let apiComp = null;
  const hasApiRoutes = files.some(f => f.apiRoute);
  if (hasTech('express')) {
    apiComp = { id: 'api-server', name: 'Express Server', description: 'REST API backend service.', type: 'api-gateway', techKey: 'express', brandColor: '#1a1a1a', zoneId: 'api-zone' };
  } else if (hasTech('nestjs')) {
    apiComp = { id: 'api-server', name: 'NestJS Server', description: 'Modular enterprise API backend.', type: 'api-gateway', techKey: 'nestjs', brandColor: '#2a0a0a', zoneId: 'api-zone' };
  } else if (hasTech('fastify')) {
    apiComp = { id: 'api-server', name: 'Fastify Server', description: 'High-performance HTTP server.', type: 'api-gateway', techKey: 'fastify', brandColor: '#1a1a1a', zoneId: 'api-zone' };
  } else if (hasTech('nextjs') && hasApiRoutes) {
    apiComp = { id: 'api-server', name: 'Next.js API Routes', description: 'Serverless backend endpoints.', type: 'api-gateway', techKey: 'nextjs', brandColor: '#1a1a2e', zoneId: 'api-zone' };
  } else if (hasApiRoutes) {
    apiComp = { id: 'api-server', name: 'API Server', description: 'Backend API service endpoints.', type: 'api-gateway', techKey: 'express', brandColor: '#1a1a1a', zoneId: 'api-zone' };
  }
  if (apiComp) {
    components.push(apiComp);
  }

  // Auth Component
  let authComp = null;
  if (hasTech('nextauth')) {
    authComp = { id: 'auth-service', name: 'NextAuth.js', description: 'Self-hosted authentication service.', type: 'auth', techKey: 'nextauth', brandColor: '#1a0a2a', zoneId: 'api-zone' };
  } else if (hasTech('auth0')) {
    authComp = { id: 'auth-service', name: 'Auth0', description: 'External identity provider manager.', type: 'auth', techKey: 'auth0', brandColor: '#2a1a0a', zoneId: 'api-zone' };
  } else if (hasTech('clerk')) {
    authComp = { id: 'auth-service', name: 'Clerk Auth', description: 'User management identity platform.', type: 'auth', techKey: 'clerk', brandColor: '#1a0a2a', zoneId: 'api-zone' };
  } else if (hasTech('jwt')) {
    authComp = { id: 'auth-service', name: 'JWT Auth', description: 'Token-based auth system.', type: 'auth', techKey: 'jwt', brandColor: '#1a0a2a', zoneId: 'api-zone' };
  }
  if (authComp) {
    components.push(authComp);
  }

  // Database Component
  let dbComp = null;
  if (hasTech('prisma') && hasTech('postgresql')) {
    dbComp = { id: 'database', name: 'PostgreSQL via Prisma', description: 'Relational database mapping.', type: 'database', techKey: 'postgresql', brandColor: '#0a1a2a', zoneId: 'data-zone' };
  } else if (hasTech('prisma') && hasTech('mysql')) {
    dbComp = { id: 'database', name: 'MySQL via Prisma', description: 'Relational MySQL database mapping.', type: 'database', techKey: 'mysql', brandColor: '#0a1a2a', zoneId: 'data-zone' };
  } else if (hasTech('mongoose')) {
    dbComp = { id: 'database', name: 'MongoDB', description: 'Document database storage.', type: 'database', techKey: 'mongoose', brandColor: '#0a2a0a', zoneId: 'data-zone' };
  } else if (hasTech('postgresql')) {
    dbComp = { id: 'database', name: 'PostgreSQL', description: 'Relational database storage.', type: 'database', techKey: 'postgresql', brandColor: '#0a1a2a', zoneId: 'data-zone' };
  } else if (hasTech('mysql')) {
    dbComp = { id: 'database', name: 'MySQL', description: 'Relational SQL database storage.', type: 'database', techKey: 'mysql', brandColor: '#0a1a2a', zoneId: 'data-zone' };
  } else if (hasTech('sqlite')) {
    dbComp = { id: 'database', name: 'SQLite Database', description: 'In-process database file.', type: 'database', techKey: 'sqlite', brandColor: '#003b57', zoneId: 'data-zone' };
  }
  if (dbComp) {
    components.push(dbComp);
  }

  // Redis Cache Component
  if (hasTech('redis')) {
    components.push({ id: 'cache-server', name: 'Redis Cache', description: 'Key-value cache database.', type: 'cache', techKey: 'redis', brandColor: '#2a0a0a', zoneId: 'data-zone' });
  }

  // Cloud components
  const awsServices = stack.detected.filter(t => t.category === 'cloud' && t.key.startsWith('aws-'));
  for (const aws of awsServices) {
    let serviceType = 'cloud';
    if (aws.service === 'SQS') serviceType = 'queue';
    if (aws.service === 'DynamoDB') serviceType = 'database';
    components.push({
      id: `aws-${aws.service.toLowerCase()}`,
      name: aws.name,
      description: `AWS hosted cloud ${aws.service} service.`,
      type: serviceType,
      techKey: aws.key,
      brandColor: '#FF9900',
      zoneId: 'cloud-zone'
    });
  }

  if (hasTech('supabase')) {
    components.push({ id: 'supabase', name: 'Supabase Platform', description: 'Backend-as-a-Service integration.', type: 'cloud', techKey: 'supabase', brandColor: '#3FCF8E', zoneId: 'cloud-zone' });
  }
  if (hasTech('firebase')) {
    components.push({ id: 'firebase', name: 'Firebase Platform', description: 'Backend-as-a-Service platform.', type: 'cloud', techKey: 'firebase', brandColor: '#FFCA28', zoneId: 'cloud-zone' });
  }

  // DevOps
  if (hasTech('docker')) {
    components.push({ id: 'docker', name: 'Docker Container', description: 'Containerized environment.', type: 'infra', techKey: 'docker', brandColor: '#2496ED', zoneId: 'infra-zone' });
  }
  if (hasTech('gha')) {
    components.push({ id: 'github-actions', name: 'CI/CD Pipeline', description: 'GitHub workflow automation.', type: 'infra', techKey: 'gha', brandColor: '#2088FF', zoneId: 'infra-zone' });
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
