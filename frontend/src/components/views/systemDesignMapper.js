export function buildSystemDesign(DATA, fileList = []) {
  // Defensive: handle undefined/missing data
  if (!DATA) {
    return { components: [], zones: [], connections: [] };
  }

  const { stack, files, graph } = DATA;
  const detected = stack?.detected || [];
  if (!fileList || fileList.length === 0) {
    fileList = files || [];
  }

  const detectedKeys = new Set(detected.map(t => t.key));
  const hasTech = (key) => detectedKeys.has(key);

  const components = [];
  const zones = [];
  const connections = [];

  // Helper to find tech in detected stack
  const findTech = (keys) => {
    for (const k of keys) {
      const tech = detected.find(t => t.key === k);
      if (tech) return tech;
    }
    return null;
  };

  // Helper to get sublabel for database
  const getDatabaseSublabel = () => {
    if (hasTech('prisma') && hasTech('postgresql')) return 'PostgreSQL via Prisma';
    if (hasTech('prisma') && hasTech('mysql')) return 'MySQL via Prisma';
    if (hasTech('mongoose')) return 'MongoDB via Mongoose';
    if (hasTech('drizzle') && hasTech('postgresql')) return 'PostgreSQL via Drizzle';
    if (hasTech('drizzle') && hasTech('mysql')) return 'MySQL via Drizzle';
    if (hasTech('postgresql')) return 'PostgreSQL';
    if (hasTech('mysql')) return 'MySQL';
    if (hasTech('sqlite')) return 'SQLite';
    if (hasTech('prisma')) return 'Prisma ORM';
    return 'Database';
  };

  // Helper to get sublabel for auth
  const getAuthSublabel = () => {
    if (hasTech('nextauth')) return 'NextAuth.js';
    if (hasTech('auth0')) return 'Auth0';
    if (hasTech('clerk')) return 'Clerk';
    if (hasTech('jwt')) return 'JWT';
    return 'Auth Service';
  };

  let compCounter = 0;
  const nextNumber = () => ++compCounter;

  // ========================================
  // ALWAYS CREATE THESE
  // ========================================

  // DNS
  components.push({
    id: 'dns',
    number: nextNumber(),
    label: 'DNS',
    sublabel: 'Domain resolution',
    tier: 'network',
    icon: 'network',
    techKey: '',
    isDetected: true,
    zoneId: 'network-zone'
  });

  // API Gateway - always exists
  let apiGatewaySublabel = 'API Server';
  if (hasTech('nextjs')) apiGatewaySublabel = 'Next.js';
  else if (hasTech('express')) apiGatewaySublabel = 'Express.js';
  else if (hasTech('nestjs')) apiGatewaySublabel = 'NestJS';
  else if (hasTech('fastify')) apiGatewaySublabel = 'Fastify';

  components.push({
    id: 'api-gateway',
    number: nextNumber(),
    label: 'API Gateway',
    sublabel: apiGatewaySublabel,
    tier: 'gateway',
    icon: 'service',
    techKey: hasTech('nextjs') ? 'nextjs' : hasTech('express') ? 'express' : hasTech('nestjs') ? 'nestjs' : hasTech('fastify') ? 'fastify' : '',
    isDetected: true,
    zoneId: 'gateway-zone'
  });

  // Client components - always create
  const clientWebSublabel = hasTech('nextjs') ? 'Next.js SSR' : 'SPA';
  components.push({
    id: 'client-web',
    number: nextNumber(),
    label: 'Web Browser',
    sublabel: clientWebSublabel,
    tier: 'client',
    icon: 'browser',
    techKey: hasTech('nextjs') ? 'nextjs' : hasTech('react') ? 'react' : hasTech('vuejs') ? 'vuejs' : '',
    isDetected: true,
    zoneId: 'client-zone'
  });

  // Check for mobile
  const hasMobile = hasTech('react-native') || hasTech('expo') ||
    fileList.some(f => f.content && (f.content.includes('react-native') || f.content.includes('expo')));
  if (hasMobile) {
    components.push({
      id: 'client-mobile',
      number: nextNumber(),
      label: 'Mobile App',
      sublabel: 'React Native / Expo',
      tier: 'client',
      icon: 'mobile',
      techKey: 'react-native',
      isDetected: true,
      zoneId: 'client-zone'
    });
  }

  // ========================================
  // CREATE ONLY IF DETECTED IN STACK
  // ========================================

  // CDN / Edge (Vercel)
  if (hasTech('vercel')) {
    components.push({
      id: 'cdn',
      number: nextNumber(),
      label: 'CDN / Edge',
      sublabel: 'Vercel Edge Network',
      tier: 'edge',
      icon: 'network',
      techKey: 'vercel',
      isDetected: true,
      zoneId: 'edge-zone'
    });
  }

  // Load Balancer (inferred if project is large)
  const isLargeProject = fileList.length > 20;
  if (isLargeProject && !hasTech('vercel')) {
    components.push({
      id: 'load-balancer',
      number: nextNumber(),
      label: 'Load Balancer',
      sublabel: 'Inferred',
      tier: 'network',
      icon: 'network',
      techKey: '',
      isDetected: false,
      zoneId: 'network-zone'
    });
  }

  // Database
  const dbTechs = ['postgresql', 'mysql', 'mongodb', 'sqlite', 'prisma', 'mongoose', 'drizzle', 'typeorm'];
  if (dbTechs.some(t => hasTech(t))) {
    components.push({
      id: 'database',
      number: nextNumber(),
      label: 'Database',
      sublabel: getDatabaseSublabel(),
      tier: 'data',
      icon: 'database',
      techKey: findTech(dbTechs)?.key || '',
      isDetected: true,
      zoneId: 'data-zone'
    });
  }

  // Cache (Redis)
  if (hasTech('redis')) {
    components.push({
      id: 'cache',
      number: nextNumber(),
      label: 'Cache Layer',
      sublabel: 'Redis',
      tier: 'cache',
      icon: 'cache',
      techKey: 'redis',
      isDetected: true,
      zoneId: 'cache-zone'
    });
  }

  // Auth Service
  const authTechs = ['nextauth', 'auth0', 'clerk', 'jwt'];
  if (authTechs.some(t => hasTech(t))) {
    components.push({
      id: 'auth',
      number: nextNumber(),
      label: 'Auth Service',
      sublabel: getAuthSublabel(),
      tier: 'service',
      icon: 'service',
      techKey: findTech(authTechs)?.key || '',
      isDetected: true,
      zoneId: 'service-zone'
    });
  }

  // Message Queue (AWS SQS/SNS)
  if (hasTech('aws-sqs') || hasTech('aws-sns')) {
    const queueTech = hasTech('aws-sqs') ? 'aws-sqs' : 'aws-sns';
    components.push({
      id: 'message-queue',
      number: nextNumber(),
      label: 'Message Queue',
      sublabel: hasTech('aws-sqs') ? 'AWS SQS' : 'AWS SNS',
      tier: 'queue',
      icon: 'queue',
      techKey: queueTech,
      isDetected: true,
      zoneId: 'queue-zone'
    });
  }

  // Worker Service (AWS Lambda)
  if (hasTech('aws-lambda')) {
    components.push({
      id: 'worker',
      number: nextNumber(),
      label: 'Worker Service',
      sublabel: 'AWS Lambda',
      tier: 'service',
      icon: 'service',
      techKey: 'aws-lambda',
      isDetected: true,
      zoneId: 'service-zone'
    });
  }

  // Object Storage (AWS S3)
  if (hasTech('aws-s3')) {
    components.push({
      id: 'storage',
      number: nextNumber(),
      label: 'Object Storage',
      sublabel: 'AWS S3',
      tier: 'cloud',
      icon: 'cloud',
      techKey: 'aws-s3',
      isDetected: true,
      zoneId: 'cloud-zone'
    });
  }

  // Compute (EC2, Docker)
  if (hasTech('aws-ec2') || hasTech('docker')) {
    const computeSublabel = hasTech('aws-ec2') ? 'EC2' : 'Docker Container';
    components.push({
      id: 'compute',
      number: nextNumber(),
      label: 'Compute',
      sublabel: computeSublabel,
      tier: 'service',
      icon: 'service',
      techKey: hasTech('aws-ec2') ? 'aws-ec2' : 'docker',
      isDetected: true,
      zoneId: 'service-zone'
    });
  }

  // Supabase
  if (hasTech('supabase')) {
    components.push({
      id: 'supabase',
      number: nextNumber(),
      label: 'Supabase',
      sublabel: 'Database + Auth + Storage',
      tier: 'data',
      icon: 'database',
      techKey: 'supabase',
      isDetected: true,
      zoneId: 'data-zone'
    });
  }

  // Firebase
  if (hasTech('firebase')) {
    components.push({
      id: 'firebase',
      number: nextNumber(),
      label: 'Firebase',
      sublabel: 'BaaS Platform',
      tier: 'cloud',
      icon: 'cloud',
      techKey: 'firebase',
      isDetected: true,
      zoneId: 'cloud-zone'
    });
  }

  // CI/CD Pipeline
  if (hasTech('gha') || hasTech('docker')) {
    const cicdSublabel = hasTech('gha') ? 'GitHub Actions' : 'Docker Build';
    components.push({
      id: 'cicd',
      number: nextNumber(),
      label: 'CI/CD Pipeline',
      sublabel: cicdSublabel,
      tier: 'observability',
      icon: 'monitor',
      techKey: hasTech('gha') ? 'gha' : 'docker',
      isDetected: true,
      zoneId: 'observability-zone'
    });
  }

  // Testing
  const testTechs = ['jest', 'vitest', 'playwright'];
  if (testTechs.some(t => hasTech(t))) {
    const testTech = findTech(testTechs);
    components.push({
      id: 'testing',
      number: nextNumber(),
      label: 'Test Suite',
      sublabel: testTech?.name || 'Testing',
      tier: 'observability',
      icon: 'monitor',
      techKey: testTech?.key || '',
      isDetected: true,
      zoneId: 'observability-zone'
    });
  }

  // ========================================
  // INFERRED COMPONENTS (always show as inferred)
  // ========================================

  // Monitoring (always inferred unless explicitly detected)
  components.push({
    id: 'monitoring',
    number: nextNumber(),
    label: 'Monitoring',
    sublabel: 'Logs · Metrics · Traces',
    tier: 'observability',
    icon: 'monitor',
    techKey: '',
    isDetected: false,
    zoneId: 'observability-zone'
  });

  // ========================================
  // BUILD CONNECTIONS
  // ========================================

  const addConn = (from, to, label, style = 'solid') => {
    const fromComp = components.find(c => c.id === from);
    const toComp = components.find(c => c.id === to);
    if (fromComp && toComp) {
      connections.push({ from, to, label, style });
    }
  };

  // Client -> DNS
  addConn('client-web', 'dns', 'DNS lookup');
  if (components.find(c => c.id === 'client-mobile')) {
    addConn('client-mobile', 'dns', 'DNS lookup');
  }

  // DNS -> CDN or API Gateway
  if (components.find(c => c.id === 'cdn')) {
    addConn('dns', 'cdn', 'resolves to');
    addConn('cdn', 'api-gateway', 'cache miss / origin');
  } else {
    addConn('dns', 'api-gateway', 'resolves to');
  }

  // Load Balancer -> API Gateway
  if (components.find(c => c.id === 'load-balancer')) {
    addConn('load-balancer', 'api-gateway', 'routes traffic');
    // DNS -> Load Balancer instead of direct to API Gateway
    // Find and update the connection
    const dnsToApi = connections.find(c => c.from === 'dns' && c.to === 'api-gateway');
    if (dnsToApi) {
      dnsToApi.to = 'load-balancer';
      dnsToApi.label = 'resolves to';
    }
    addConn('dns', 'load-balancer', 'resolves to');
  }

  // API Gateway -> Auth
  if (components.find(c => c.id === 'auth')) {
    addConn('api-gateway', 'auth', 'validates token');
  }

  // API Gateway -> Database
  if (components.find(c => c.id === 'database')) {
    addConn('api-gateway', 'database', 'ORM query');
  }

  // API Gateway -> Cache
  if (components.find(c => c.id === 'cache')) {
    addConn('api-gateway', 'cache', 'cache lookup');
  }

  // Cache -> Database
  if (components.find(c => c.id === 'cache') && components.find(c => c.id === 'database')) {
    addConn('cache', 'database', 'cache miss → DB');
  }

  // API Gateway -> Message Queue
  if (components.find(c => c.id === 'message-queue')) {
    addConn('api-gateway', 'message-queue', 'pub');
  }

  // Message Queue -> Worker
  if (components.find(c => c.id === 'message-queue') && components.find(c => c.id === 'worker')) {
    addConn('message-queue', 'worker', 'sub');
  }

  // Worker -> Database
  if (components.find(c => c.id === 'worker') && components.find(c => c.id === 'database')) {
    addConn('worker', 'database', 'write');
  }

  // API Gateway -> Storage
  if (components.find(c => c.id === 'storage')) {
    addConn('api-gateway', 'storage', 'upload');
  }

  // API Gateway -> Monitoring (dashed for observability)
  if (components.find(c => c.id === 'monitoring')) {
    addConn('api-gateway', 'monitoring', 'logs / traces', 'dashed');
  }

  // ========================================
  // BUILD ZONES (wrap components by tier)
  // ========================================

  const tierOrder = [
    'client', 'network', 'edge', 'gateway', 'service',
    'data', 'cache', 'queue', 'cloud', 'observability'
  ];

  const tierLabels = {
    client: 'Client Tier',
    network: 'Network Layer',
    edge: 'Edge Layer',
    gateway: 'Gateway Layer',
    service: 'Service Layer',
    data: 'Data Layer',
    cache: 'Cache Layer',
    queue: 'Queue Layer',
    cloud: 'Cloud Services',
    observability: 'Observability'
  };

  const tierColors = {
    client: '#FF4D00',
    network: '#3B82F6',
    edge: '#06B6D4',
    gateway: '#8B5CF6',
    service: '#10B981',
    data: '#22C55E',
    cache: '#F59E0B',
    queue: '#EC4899',
    cloud: '#FF9900',
    observability: '#6B7280'
  };

  const tierZones = {};

  // Group components by tier
  for (const tier of tierOrder) {
    const tierComps = components.filter(c => c.tier === tier);
    if (tierComps.length > 0) {
      tierZones[tier] = tierComps;
    }
  }

  // Create zone objects
  for (const [tier, comps] of Object.entries(tierZones)) {
    zones.push({
      id: `${tier}-zone`,
      label: tierLabels[tier],
      color: tierColors[tier],
      x: 0, y: 0, w: 0, h: 0 // will be computed in layout
    });
  }

  // ========================================
  // COMPUTE LAYOUT POSITIONS
  // ========================================

  const CANVAS_W = 1200;
  const ROW_HEIGHT = 200;
  const COMP_W = 180;
  const COMP_H = 110;
  const COMP_GAP = 80;
  const ZONE_PADDING = 24;

  const getGridPosition = (comp) => {
    let row = 5;
    let col = 1;

    switch (comp.id) {
      case 'client-web':
        row = 0; col = 1;
        break;
      case 'client-mobile':
        row = 0; col = 1;
        break;
      case 'dns':
        row = 1; col = 0;
        break;
      case 'cdn':
        row = 1; col = 2;
        break;
      case 'load-balancer':
        row = 1; col = 1;
        break;
      case 'api-gateway':
        row = 2; col = 1;
        break;
      case 'auth':
        row = 3; col = 0;
        break;
      case 'compute':
        row = 3; col = 1;
        break;
      case 'worker':
        row = 3; col = 2;
        break;
      case 'database':
        row = 4; col = 1;
        break;
      case 'cache':
        row = 4; col = 2;
        break;
      case 'storage':
        row = 4; col = 0;
        break;
      case 'message-queue':
        row = 4; col = 0;
        break;
      case 'supabase':
        row = 4; col = 1;
        break;
      case 'firebase':
        row = 4; col = 1;
        break;
      case 'monitoring':
        row = 5; col = 0;
        break;
      case 'cicd':
        row = 5; col = 1;
        break;
      case 'testing':
        row = 5; col = 2;
        break;
      default:
        const tierToRow = {
          client: 0,
          network: 1,
          edge: 1,
          gateway: 2,
          service: 3,
          data: 4,
          cache: 4,
          queue: 4,
          cloud: 4,
          observability: 5
        };
        row = tierToRow[comp.tier] ?? 5;
        col = 1;
        break;
    }
    return { row, col };
  };

  // Position each component
  const occupied = new Set();
  components.forEach(comp => {
    let { row, col } = getGridPosition(comp);
    // Resolve collisions
    while (occupied.has(`${row},${col}`)) {
      col = (col + 1) % 3;
    }
    occupied.add(`${row},${col}`);
    
    // Calculate coordinates with center alignment
    comp.x = CANVAS_W / 2 - COMP_W / 2 + (col - 1) * (COMP_W + COMP_GAP);
    comp.y = 60 + row * ROW_HEIGHT;
    comp.w = COMP_W;
    comp.h = COMP_H;
  });

  // Compute zone bounds based on positioned components
  for (const tier of tierOrder) {
    if (!tierZones[tier]) continue;
    const comps = tierZones[tier];
    const zone = zones.find(z => z.id === `${tier}-zone`);
    if (zone && comps.length > 0) {
      const minX = Math.min(...comps.map(c => c.x));
      const maxX = Math.max(...comps.map(c => c.x + c.w));
      const minY = Math.min(...comps.map(c => c.y));
      const maxY = Math.max(...comps.map(c => c.y + c.h));

      zone.x = minX - ZONE_PADDING;
      zone.y = minY - ZONE_PADDING - 18; // space for label
      zone.w = maxX - minX + ZONE_PADDING * 2;
      zone.h = maxY - minY + ZONE_PADDING * 2 + 18;
    }
  }

  // Initialize file arrays for all components
  components.forEach(comp => {
    comp.files = [];
  });

  const getComponentForFile = (file) => {
    const rel = file.relativePath.toLowerCase().replace(/\\/g, '/');
    
    // 1. Auth Service
    if (rel.includes('/auth') || rel.includes('auth.ts') || rel.includes('auth.js')) {
      if (components.some(c => c.id === 'auth')) return 'auth';
    }
    
    // 2. Database / Supabase / Firebase / Data
    if (
      rel.includes('/models/') || rel.includes('/repositories/') || rel.includes('/migrations/') ||
      rel.includes('/db/') || rel.includes('/database/') || rel.includes('/prisma/') || rel.includes('/schemas/') ||
      ['.prisma', '.sql'].includes(file.extension) ||
      file.relativePath.toLowerCase().includes('prisma')
    ) {
      if (components.some(c => c.id === 'supabase')) return 'supabase';
      if (components.some(c => c.id === 'firebase')) return 'firebase';
      if (components.some(c => c.id === 'database')) return 'database';
    }

    // 3. Cache
    if (rel.includes('/cache/') || rel.includes('redis')) {
      if (components.some(c => c.id === 'cache')) return 'cache';
    }

    // 4. Object Storage
    if (rel.includes('/storage/') || rel.includes('/s3/') || rel.includes('/uploads/')) {
      if (components.some(c => c.id === 'storage')) return 'storage';
    }

    // 5. Message Queue
    if (rel.includes('/queue/') || rel.includes('/sqs/') || rel.includes('/sns/')) {
      if (components.some(c => c.id === 'message-queue')) return 'message-queue';
    }

    // 6. Worker Service / Lambda
    if (rel.includes('/worker/') || rel.includes('/lambda/') || rel.includes('/jobs/')) {
      if (components.some(c => c.id === 'worker')) return 'worker';
    }

    // 7. Monitoring / Observability / Testing
    if (
      rel.includes('.test.') || rel.includes('.spec.') || rel.includes('__tests__') ||
      rel.includes('/test/') || rel.includes('/tests/') || rel.includes('/monitoring/') ||
      rel.includes('/logs/') || rel.includes('/metrics/')
    ) {
      if (components.some(c => c.id === 'monitoring')) return 'monitoring';
      if (components.some(c => c.id === 'testing')) return 'testing';
    }

    // 8. API Gateway / API Server / Server root
    if (
      file.apiRoute === true || rel.includes('/api/') || rel.includes('/controllers/') || 
      rel.includes('/handlers/') || rel.includes('/routes/') || rel.includes('/resolvers/') || 
      rel.includes('/graphql/') || rel === 'server.js' || rel === 'server.ts' || rel.startsWith('src/server.ts')
    ) {
      if (components.some(c => c.id === 'api-gateway')) return 'api-gateway';
    }

    // 9. Client Web / Frontend
    if (
      file.extension === '.tsx' || file.extension === '.jsx' ||
      rel.includes('/frontend/') || rel.includes('/pages/') || rel.includes('/app/') || 
      rel.includes('/views/') || rel.includes('/screens/') || rel.includes('/components/') || 
      rel.includes('/ui/')
    ) {
      if (components.some(c => c.id === 'client-web')) return 'client-web';
    }

    // 10. Default Fallback
    if (rel.includes('/frontend/') || rel.includes('/src/app/') || rel.includes('/src/components/')) {
      if (components.some(c => c.id === 'client-web')) return 'client-web';
    }
    
    if (components.some(c => c.id === 'api-gateway')) return 'api-gateway';
    return components[0]?.id || '';
  };

  // Map each file in fileList to its best matching component
  fileList.forEach(file => {
    const compId = getComponentForFile(file);
    const comp = components.find(c => c.id === compId);
    if (comp) {
      comp.files.push(file.relativePath);
    }
  });

  return { components, zones, connections };
}