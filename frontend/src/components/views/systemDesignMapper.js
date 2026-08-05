// systemDesignMapper.js — Complete rewrite. Dynamic. No hardcoding.

export function buildSystemDesign(DATA, fileList = []) {
  if (!DATA) return { perspectives: {}, zones: {}, metadata: {} };

  const detected = DATA?.stack?.detected || [];
  const layers = DATA?.layers || {};
  const files = fileList.length > 0 ? fileList : (DATA?.files || []);

  // ── Detection helpers ──────────────────────────────────────────
  const has = (key) => detected.some(t => t.key === key);
  const hasAny = (...keys) => keys.some(k => has(k));
  const getTech = (key) => detected.find(t => t.key === key);
  const hasCategory = (cat) => detected.some(t => t.category === cat);
  const hasAWSAny = () => detected.some(t => t.key && t.key.startsWith('aws-'));

  // ── Derived facts about the project ──────────────────────────
  const isNextJS = has('nextjs');
  const isExpress = has('express');
  const isNestJS = has('nestjs');
  const isFastify = has('fastify');
  const isHono = has('hono');
  const hasAnyBackend = hasAny('nextjs','express','nestjs','fastify','hono');

  const dbTech = has('neon') ? 'neon' :
    has('postgresql') ? 'postgresql' :
    has('mysql') ? 'mysql' :
    has('mongodb') || has('mongoose') ? 'mongodb' :
    has('sqlite') ? 'sqlite' :
    has('supabase') ? 'supabase' :
    has('firebase') ? 'firebase' :
    has('aws-dynamo') ? 'aws-dynamo' :
    has('upstash') ? 'upstash' :
    has('prisma') ? 'postgresql' : null;

  const dbName = has('neon') ? 'Neon Serverless Postgres' :
    has('postgresql') ? 'PostgreSQL' :
    has('mysql') ? 'MySQL' :
    has('mongodb') || has('mongoose') ? 'MongoDB' :
    has('sqlite') ? 'SQLite' :
    has('supabase') ? 'Supabase DB' :
    has('firebase') ? 'Firestore' :
    has('aws-dynamo') ? 'DynamoDB' :
    has('upstash') ? 'Upstash Redis' :
    has('prisma') ? 'PostgreSQL' : null;

  const ormSuffix = has('prisma') ? ' · Prisma ORM' :
    has('drizzle') ? ' · Drizzle ORM' :
    has('mongoose') ? ' · Mongoose' :
    has('typeorm') ? ' · TypeORM' : '';

  const authTech = has('nextauth') ? 'nextauth' :
    has('auth0') ? 'auth0' :
    has('clerk') ? 'clerk' :
    has('jwt') ? 'jwt' :
    has('aws-cognito') ? 'aws-cognito' :
    has('passport') ? 'passport' : null;

  const authName = has('nextauth') ? 'Auth.js (NextAuth)' :
    has('auth0') ? 'Auth0' :
    has('clerk') ? 'Clerk' :
    has('jwt') ? 'JWT' :
    has('aws-cognito') ? 'AWS Cognito' :
    has('passport') ? 'Passport.js' : null;

  const frontendTech = isNextJS ? 'nextjs' :
    has('react') ? 'react' :
    has('vuejs') ? 'vuejs' : 'web';

  const frontendName = isNextJS ? 'Next.js App Router' :
    has('react') ? 'React SPA' :
    has('vuejs') ? 'Vue.js App' : 'Web Client';

  const apiName = isNextJS ? 'Next.js API Routes' :
    isNestJS ? 'NestJS Controller' :
    isExpress ? 'Express Router' :
    isFastify ? 'Fastify Server' :
    isHono ? 'Hono API' : 'API Server';

  const apiTech = isNextJS ? 'nextjs' :
    isNestJS ? 'nestjs' :
    isExpress ? 'express' :
    isFastify ? 'fastify' : 'node';

  // File helpers
  const getLayerFiles = (layerName, max = 4) =>
    (layers[layerName] || []).slice(0, max);

  const getFilesMatching = (...keywords) =>
    files.filter(f => f.relativePath && keywords.some(k =>
      f.relativePath.toLowerCase().includes(k.toLowerCase())
    )).slice(0, 4).map(f => f.relativePath);

  const schemaFiles = getFilesMatching('schema', 'model', 'migration', 'prisma', 'entity', 'table');
  const apiRouteFiles = getLayerFiles('Gateway', 6);
  const authFiles = getFilesMatching('auth', 'session', 'middleware', 'guard');

  const envVars = [];
  files.forEach(f => {
    if (f.envVars) f.envVars.forEach(v => {
      if (!envVars.includes(v)) envVars.push(v);
    });
  });

  // ── Component counter ─────────────────────────────────────────
  let n = 0;
  const num = () => ++n;

  // ── Zone builder ──────────────────────────────────────────────
  function buildZones(components) {
    const ZONE_PAD = 20;
    const zones = [];
    const tierGroups = {};
    components.forEach(c => {
      if (!tierGroups[c.zone]) tierGroups[c.zone] = [];
      tierGroups[c.zone].push(c);
    });
    Object.entries(tierGroups).forEach(([zoneId, comps]) => {
      if (comps.length === 0) return;
      const xs = comps.map(c => c.x);
      const ys = comps.map(c => c.y);
      const xe = comps.map(c => c.x + c.w);
      const ye = comps.map(c => c.y + c.h);
      zones.push({
        id: zoneId,
        label: comps[0].zoneLabel || zoneId,
        color: comps[0].zoneColor || '#888',
        x: Math.min(...xs) - ZONE_PAD,
        y: Math.min(...ys) - ZONE_PAD - 18,
        w: Math.max(...xe) - Math.min(...xs) + ZONE_PAD * 2,
        h: Math.max(...ye) - Math.min(...ys) + ZONE_PAD * 2 + 18,
      });
    });
    return zones;
  }

  // ── Layout engine ─────────────────────────────────────────────
  function computeLayout(components, canvasW = 1400) {
    const COMP_W = 160;
    const COMP_H = 110;
    const COMP_GAP = 24;
    const TIER_GAP = 40;
    const ZONE_EXTRA = 50;

    const zoneOrder = ['client','network','edge','gateway','backend',
      'service','data','cache','queue','cloud','observability','devops','ops'];

    const grouped = {};
    components.forEach(c => {
      if (!grouped[c.zone]) grouped[c.zone] = [];
      grouped[c.zone].push(c);
    });

    let currentY = 60;
    zoneOrder.forEach(zone => {
      const comps = grouped[zone];
      if (!comps || comps.length === 0) return;
      const rowW = comps.length * COMP_W + (comps.length - 1) * COMP_GAP;
      const startX = Math.max(20, (canvasW - rowW) / 2);
      comps.forEach((c, i) => {
        c.x = startX + i * (COMP_W + COMP_GAP);
        c.y = currentY;
        c.w = COMP_W;
        c.h = COMP_H;
      });
      currentY += COMP_H + TIER_GAP + ZONE_EXTRA;
    });

    return components;
  }

  // ── Connection builder ────────────────────────────────────────
  function buildConnections(components, extraConnections = []) {
    const ids = new Set(components.map(c => c.id));
    const has_comp = id => ids.has(id);
    const conns = [];
    const add = (from, to, label, style = 'solid') => {
      if (has_comp(from) && has_comp(to)) {
        conns.push({ from, to, label, style });
      }
    };

    // Standard flows
    add('client', 'dns', 'DNS lookup');
    add('github-ext', 'api', 'Webhooks (HMAC-Signed)', 'solid');
    if (has_comp('cdn')) {
      add('dns', 'cdn', 'resolves to');
      add('cdn', 'api', 'cache miss / origin');
    } else {
      add('dns', 'api', 'HTTPS request');
    }
    add('api', 'auth', 'validates token');
    add('api', 'database', ormSuffix.trim() ? ormSuffix.trim().replace(' · ','') + ' query' : 'DB query');
    add('api', 'cache', 'cache lookup', 'dashed');
    add('cache', 'database', 'cache miss → DB', 'dashed');
    add('api', 'queue', 'publish message');
    add('queue', 'worker', 'consume');
    add('worker', 'database', 'write', 'dashed');
    add('api', 'storage', 'upload/fetch', 'dashed');
    add('api', 'email', 'send email', 'dashed');
    add('api', 'ai', 'AI API call', 'dashed');
    add('api', 'vector-db', 'vector search', 'dashed');
    add('api', 'stripe', 'billing API', 'dashed');
    add('api', 'slack-ext', 'notify', 'dashed');
    add('api', 'monitoring', 'logs/traces', 'dashed');
    add('auth', 'database', 'user lookup');
    add('api', 'bedrock', 'invoke model', 'dashed');

    // DevOps flows
    add('git', 'cicd', 'push trigger');
    add('cicd', 'tests', 'run tests');
    add('cicd', 'docker', 'build image');
    add('cicd', 'deploy', 'deploy');
    add('docker', 'k8s', 'orchestrate');
    add('deploy', 'monitoring', 'live metrics', 'dashed');

    extraConnections.forEach(ec => {
      if (has_comp(ec.from) && has_comp(ec.to)) conns.push(ec);
    });

    return conns;
  }

  // ═══════════════════════════════════════════════════════════════
  // SYSTEM ARCHITECT — HLD
  // Shows the high-level architecture of the application
  // ═══════════════════════════════════════════════════════════════
  n = 0;
  const sysHLD = [];

  // Client
  sysHLD.push({ id:'client', number:num(),
    label: frontendName,
    sublabel: has('tailwindcss')||has('tailwind') ? 'with Tailwind CSS' :
              has('mui') ? 'with Material UI' : 'Client Tier',
    zone:'client', zoneLabel:'TIER 1 — FRONTEND & PRESENTATION', zoneColor:'#3B82F6',
    techKey: frontendTech, isDetected:true,
    files: getLayerFiles('Presentation')
  });

  // DNS — only if not Vercel (Vercel handles DNS internally)
  if (!has('vercel')) {
    sysHLD.push({ id:'dns', number:num(),
      label:'DNS', sublabel:'Domain resolution',
      zone:'network', zoneLabel:'NETWORK LAYER', zoneColor:'#6B7280',
      techKey:'', isDetected:true, files:[]
    });
  }

  // CDN/Edge
  if (has('vercel')) {
    sysHLD.push({ id:'cdn', number:num(),
      label:'Vercel Edge CDN', sublabel:'Edge Network · Serverless',
      zone:'edge', zoneLabel:'EDGE LAYER', zoneColor:'#06B6D4',
      techKey:'vercel', isDetected:true, files:[]
    });
  } else if (has('aws-cloudfront')) {
    sysHLD.push({ id:'cdn', number:num(),
      label:'CloudFront CDN', sublabel:'AWS Edge Network',
      zone:'edge', zoneLabel:'EDGE LAYER', zoneColor:'#06B6D4',
      techKey:'aws-cloudfront', isDetected:true, files:[]
    });
  }

  // API Gateway
  sysHLD.push({ id:'api', number:num(),
    label: apiName,
    sublabel: `${apiRouteFiles.length} route handlers`,
    zone:'gateway', zoneLabel:'TIER 2 — API GATEWAY & AUTH', zoneColor:'#8B5CF6',
    techKey: apiTech, isDetected:true,
    files: getLayerFiles('Gateway')
  });

  // Auth — only if detected
  if (authTech) {
    sysHLD.push({ id:'auth', number:num(),
      label: authName,
      sublabel: 'Authentication & Sessions',
      zone:'gateway', zoneLabel:'TIER 2 — API GATEWAY & AUTH', zoneColor:'#8B5CF6',
      techKey: authTech, isDetected:true,
      files: authFiles
    });
  }

  // External: GitHub (if octokit detected)
  if (has('octokit') || has('github')) {
    sysHLD.push({ id:'github-ext', number:num(),
      label:'GitHub', sublabel:'Users & Webhooks',
      zone:'cloud', zoneLabel:'EXTERNAL SERVICES', zoneColor:'#FF9900',
      techKey:'github', isDetected:true, files:[]
    });
  }

  // Slack (if detected)
  if (has('slack')) {
    sysHLD.push({ id:'slack-ext', number:num(),
      label:'Slack Workspace', sublabel:'Block Kit · Interactions',
      zone:'cloud', zoneLabel:'EXTERNAL SERVICES', zoneColor:'#FF9900',
      techKey:'slack', isDetected:true, files:[]
    });
  }

  // Discord
  if (has('discord')) {
    sysHLD.push({ id:'discord-ext', number:num(),
      label:'Discord', sublabel:'Bot · Webhooks',
      zone:'cloud', zoneLabel:'EXTERNAL SERVICES', zoneColor:'#FF9900',
      techKey:'discord', isDetected:true, files:[]
    });
  }

  // Stripe
  if (has('stripe')) {
    sysHLD.push({ id:'stripe', number:num(),
      label:'Stripe', sublabel:'Subscription Billing',
      zone:'cloud', zoneLabel:'EXTERNAL SERVICES', zoneColor:'#FF9900',
      techKey:'stripe', isDetected:true, files:[]
    });
  }

  // AI Services
  if (has('openai')) {
    sysHLD.push({ id:'ai', number:num(),
      label:'OpenAI', sublabel:'GPT · Embeddings',
      zone:'cloud', zoneLabel:'EXTERNAL SERVICES', zoneColor:'#FF9900',
      techKey:'openai', isDetected:true, files:[]
    });
  } else if (has('anthropic')) {
    sysHLD.push({ id:'ai', number:num(),
      label:'Anthropic Claude', sublabel:'AI API',
      zone:'cloud', zoneLabel:'EXTERNAL SERVICES', zoneColor:'#FF9900',
      techKey:'anthropic', isDetected:true, files:[]
    });
  } else if (has('groq')) {
    sysHLD.push({ id:'ai', number:num(),
      label:'Groq', sublabel:'Fast Inference API',
      zone:'cloud', zoneLabel:'EXTERNAL SERVICES', zoneColor:'#FF9900',
      techKey:'groq', isDetected:true, files:[]
    });
  }

  // Vector DB
  if (has('pinecone')) {
    sysHLD.push({ id:'vector-db', number:num(),
      label:'Pinecone', sublabel:'Vector Database',
      zone:'data', zoneLabel:'TIER 4 — DATA & PERSISTENCE', zoneColor:'#22C55E',
      techKey:'pinecone', isDetected:true, files:[]
    });
  }

  // Domain/Business Logic layer — only if files exist
  const domainFiles = getLayerFiles('Domain');
  if (domainFiles.length > 0) {
    sysHLD.push({ id:'domain', number:num(),
      label:'Business Logic Layer',
      sublabel: `${domainFiles.length} service modules`,
      zone:'backend', zoneLabel:'TIER 3 — BUSINESS LOGIC & DOMAIN', zoneColor:'#10B981',
      techKey: apiTech, isDetected:true,
      files: domainFiles
    });
  }

  // BullMQ / Queue
  if (has('bullmq') || has('kafka')) {
    sysHLD.push({ id:'queue', number:num(),
      label: has('kafka') ? 'Apache Kafka' : 'BullMQ Queue',
      sublabel: has('kafka') ? 'Event streaming' : 'Background jobs · Redis-backed',
      zone:'backend', zoneLabel:'TIER 3 — BUSINESS LOGIC & DOMAIN', zoneColor:'#10B981',
      techKey: has('kafka') ? 'kafka' : 'bullmq', isDetected:true, files:[]
    });
  }

  // Database — only the actual detected one
  if (dbTech) {
    sysHLD.push({ id:'database', number:num(),
      label: dbName,
      sublabel: ormSuffix.trim() ? ormSuffix.trim().replace(' · ','') : 'Primary datastore',
      zone:'data', zoneLabel:'TIER 4 — DATA & PERSISTENCE', zoneColor:'#22C55E',
      techKey: dbTech, isDetected:true,
      files: schemaFiles
    });
  }

  // Redis — only if detected
  if (has('redis') || has('upstash')) {
    sysHLD.push({ id:'cache', number:num(),
      label: has('upstash') ? 'Upstash Redis' : 'Redis Cache',
      sublabel: 'In-memory cache & sessions',
      zone:'cache', zoneLabel:'CACHE LAYER', zoneColor:'#F59E0B',
      techKey: has('upstash') ? 'upstash' : 'redis', isDetected:true, files:[]
    });
  }

  // Email
  if (has('resend') || has('sendgrid')) {
    sysHLD.push({ id:'email', number:num(),
      label: has('resend') ? 'Resend' : 'SendGrid',
      sublabel: 'Transactional email',
      zone:'cloud', zoneLabel:'EXTERNAL SERVICES', zoneColor:'#FF9900',
      techKey: has('resend') ? 'resend' : 'sendgrid', isDetected:true, files:[]
    });
  }

  // AWS S3
  if (has('aws-s3')) {
    sysHLD.push({ id:'storage', number:num(),
      label:'AWS S3', sublabel:'Object storage',
      zone:'cloud', zoneLabel:'EXTERNAL SERVICES', zoneColor:'#FF9900',
      techKey:'aws-s3', isDetected:true, files:[]
    });
  }

  // AWS Lambda
  if (has('aws-lambda')) {
    sysHLD.push({ id:'worker', number:num(),
      label:'AWS Lambda', sublabel:'Serverless functions',
      zone:'cloud', zoneLabel:'EXTERNAL SERVICES', zoneColor:'#FF9900',
      techKey:'aws-lambda', isDetected:true, files:[]
    });
  }

  // AWS Bedrock
  if (has('aws-bedrock')) {
    sysHLD.push({ id:'bedrock', number:num(),
      label:'AWS Bedrock', sublabel:'Foundation models',
      zone:'cloud', zoneLabel:'EXTERNAL SERVICES', zoneColor:'#FF9900',
      techKey:'aws-bedrock', isDetected:true, files:[]
    });
  }

  // Monitoring (always inferred)
  sysHLD.push({ id:'monitoring', number:num(),
    label:'Monitoring',
    sublabel: envVars.length > 0
      ? `${envVars.length} env vars tracked`
      : 'Logs · Metrics · Traces',
    zone:'observability', zoneLabel:'TIER 5 — RUNTIME & OPERATIONS', zoneColor:'#6B7280',
    techKey:'', isDetected:false,
    files: getFilesMatching('.env', 'config', 'constants', 'logger')
  });

  const sysHLDWithLayout = computeLayout(sysHLD);
  const sysHLDZones = buildZones(sysHLDWithLayout);
  const sysHLDConns = buildConnections(sysHLDWithLayout);

  // ═══════════════════════════════════════════════════════════════
  // SYSTEM ARCHITECT — LLD
  // Shows actual implementation files in each tier
  // ═══════════════════════════════════════════════════════════════
  n = 0;
  const sysLLD = [];

  const presentationFiles = getLayerFiles('Presentation');
  if (presentationFiles.length > 0) {
    sysLLD.push({ id:'lld-ui', number:num(),
      label: 'UI Components & Views',
      sublabel: `${(layers.Presentation||[]).length} components · ${has('tailwindcss')||has('tailwind') ? 'Tailwind CSS' : has('mui') ? 'Material UI' : 'CSS'}`,
      zone:'frontend', zoneLabel:'TIER 1 — FRONTEND & PRESENTATION', zoneColor:'#3B82F6',
      techKey: frontendTech, isDetected:true,
      files: presentationFiles
    });
  }

  const interactionFiles = getLayerFiles('Interaction');
  if (interactionFiles.length > 0) {
    sysLLD.push({ id:'lld-hooks', number:num(),
      label: has('zustand') ? 'React Hooks & Zustand Store' : has('redux') ? 'React Hooks & Redux Toolkit' : 'React Custom Hooks & Context API',
      sublabel: `${(layers.Interaction||[]).length} state modules`,
      zone:'frontend', zoneLabel:'TIER 1 — FRONTEND & PRESENTATION', zoneColor:'#3B82F6',
      techKey: has('zustand') ? 'zustand' : has('redux') ? 'redux' : frontendTech,
      isDetected:true, files: interactionFiles
    });
  }

  const gatewayFiles = getLayerFiles('Gateway');
  if (gatewayFiles.length > 0) {
    sysLLD.push({ id:'lld-routes', number:num(),
      label:'API Route Controllers & Methods',
      sublabel: `${(layers.Gateway||[]).length} endpoints · GET/POST/PUT/DELETE`,
      zone:'gateway', zoneLabel:'TIER 2 — API GATEWAY & AUTH', zoneColor:'#8B5CF6',
      techKey: apiTech, isDetected:true,
      files: gatewayFiles
    });
  }

  if (authTech) {
    sysLLD.push({ id:'lld-auth', number:num(),
      label:'Middleware Security & Auth Guard',
      sublabel: `Guarded by ${authName} · CORS Policy`,
      zone:'gateway', zoneLabel:'TIER 2 — API GATEWAY & AUTH', zoneColor:'#8B5CF6',
      techKey: authTech, isDetected:true,
      files: authFiles
    });
  }

  const domainFilesLLD = getLayerFiles('Domain');
  if (domainFilesLLD.length > 0) {
    sysLLD.push({ id:'lld-domain', number:num(),
      label:'Domain Service Function Signatures',
      sublabel: `${(layers.Domain||[]).length} service modules`,
      zone:'backend', zoneLabel:'TIER 3 — BUSINESS LOGIC & DOMAIN', zoneColor:'#10B981',
      techKey: apiTech, isDetected:true,
      files: domainFilesLLD
    });
  }

  // Worker / background jobs
  const foundationFiles = getLayerFiles('Foundation', 6);
  const workerFiles = getFilesMatching('worker', 'job', 'cron', 'queue', 'background');
  if (has('bullmq') || workerFiles.length > 0) {
    sysLLD.push({ id:'lld-worker', number:num(),
      label: 'Async Event Queue & Worker Pool',
      sublabel: has('bullmq') ? 'BullMQ · Background Worker Pool' : 'Background Worker Pool',
      zone:'backend', zoneLabel:'TIER 3 — BUSINESS LOGIC & DOMAIN', zoneColor:'#10B981',
      techKey: has('bullmq') ? 'bullmq' : apiTech, isDetected: has('bullmq'),
      files: workerFiles.slice(0,4)
    });
  }

  if (dbTech && schemaFiles.length > 0) {
    const ormName = has('prisma') ? 'Prisma' : has('drizzle') ? 'Drizzle' : has('mongoose') ? 'Mongoose' : has('typeorm') ? 'TypeORM' : '';
    sysLLD.push({ id:'lld-db', number:num(),
      label: `${ormName ? ormName + ' ' : ''}ORM Table Schemas & Data Entities`,
      sublabel: schemaFiles.length > 0
        ? `Tables: ${schemaFiles.slice(0,3).map(f => f.split('/').pop().replace(/\.(ts|js|prisma)$/,'')).join(', ')}`
        : `${dbName} schema definitions`,
      zone:'data', zoneLabel:'TIER 4 — DATA & PERSISTENCE', zoneColor:'#22C55E',
      techKey: dbTech, isDetected:true,
      files: schemaFiles.slice(0,4)
    });
  } else if (dbTech) {
    sysLLD.push({ id:'lld-db', number:num(),
      label: dbName,
      sublabel: ormSuffix.trim() ? ormSuffix.trim().replace(' · ','') : 'Primary datastore',
      zone:'data', zoneLabel:'TIER 4 — DATA & PERSISTENCE', zoneColor:'#22C55E',
      techKey: dbTech, isDetected:true,
      files: []
    });
  }

  if (has('redis') || has('upstash')) {
    sysLLD.push({ id:'lld-cache', number:num(),
      label:'DB Connection Pool & Node Cache',
      sublabel: has('upstash') ? 'Upstash Redis · Primary Cache · In-Memory Cache' : 'Primary Datastore Pool · In-Memory Cache',
      zone:'cache', zoneLabel:'TIER 4 — DATA & PERSISTENCE', zoneColor:'#22C55E',
      techKey: has('upstash') ? 'upstash' : 'redis', isDetected:true, files:[]
    });
  }

  sysLLD.push({ id:'lld-runtime', number:num(),
    label:'Environment Variable Injector',
    sublabel: envVars.length > 0
      ? `${envVars.length} env vars: ${envVars.slice(0,3).join(', ')}${envVars.length > 3 ? '...' : ''}`
      : 'Runtime config & secrets',
    zone:'ops', zoneLabel:'TIER 5 — RUNTIME & OPERATIONS', zoneColor:'#6B7280',
    techKey:'node', isDetected:true,
    files: getFilesMatching('.env', 'config', 'constants')
  });

  const sysLLDWithLayout = computeLayout(sysLLD);
  const sysLLDZones = buildZones(sysLLDWithLayout);
  const sysLLDConns = buildConnections(sysLLDWithLayout);

  // ═══════════════════════════════════════════════════════════════
  // CLOUD ARCHITECT — HLD
  // Shows ONLY detected cloud/SaaS services, NOT generic boxes
  // ═══════════════════════════════════════════════════════════════
  n = 0;
  const cloudHLD = [];

  // Client
  cloudHLD.push({ id:'client', number:num(),
    label: 'Client Dashboard',
    sublabel: frontendName + ' · Real-Time Observability',
    zone:'client', zoneLabel:'CLIENT', zoneColor:'#3B82F6',
    techKey: frontendTech, isDetected:true,
    files: getLayerFiles('Presentation', 2)
  });

  // GitHub integration
  if (has('octokit') || has('github')) {
    cloudHLD.push({ id:'github-ext', number:num(),
      label:'GitHub', sublabel:'Users & Webhooks · OAuth 2.0 Flow',
      zone:'cloud', zoneLabel:'CLOUD BOUNDARY', zoneColor:'#FF9900',
      techKey:'github', isDetected:true, files:[]
    });
  }

  // Vercel/CDN
  if (has('vercel')) {
    cloudHLD.push({ id:'cdn', number:num(),
      label:'Vercel Edge CDN', sublabel:'Edge Network · x-hub-signature-256',
      zone:'cloud', zoneLabel:'CLOUD BOUNDARY', zoneColor:'#FF9900',
      techKey:'vercel', isDetected:true, files:[]
    });
  } else if (has('aws-cloudfront')) {
    cloudHLD.push({ id:'cdn', number:num(),
      label:'AWS CloudFront', sublabel:'Edge CDN · Cache',
      zone:'cloud', zoneLabel:'CLOUD BOUNDARY', zoneColor:'#FF9900',
      techKey:'aws-cloudfront', isDetected:true, files:[]
    });
  }

  // API
  cloudHLD.push({ id:'api', number:num(),
    label: apiName,
    sublabel: 'Routes & Webhooks · ' + (authName || 'API'),
    zone:'cloud', zoneLabel:'CLOUD BOUNDARY', zoneColor:'#FF9900',
    techKey: apiTech, isDetected:true,
    files: getLayerFiles('Gateway', 2)
  });

  // Auth inside cloud boundary
  if (authTech) {
    cloudHLD.push({ id:'auth', number:num(),
      label: authName, sublabel:'GitHub OAuth · Session',
      zone:'cloud', zoneLabel:'CLOUD BOUNDARY', zoneColor:'#FF9900',
      techKey: authTech, isDetected:true, files:[]
    });
  }

  // Business logic modules
  if ((layers.Domain||[]).length > 0) {
    cloudHLD.push({ id:'rules', number:num(),
      label:'Rules & Triage Logic',
      sublabel: `${(layers.Domain||[]).length} service modules`,
      zone:'cloud', zoneLabel:'CLOUD BOUNDARY', zoneColor:'#FF9900',
      techKey: apiTech, isDetected:true,
      files: getLayerFiles('Domain', 2)
    });
  }

  // Feature gating / subscription — if stripe detected
  if (has('stripe')) {
    cloudHLD.push({ id:'feature-gate', number:num(),
      label:'Subscription Feature Gating',
      sublabel:'Plan checks · Usage limits',
      zone:'cloud', zoneLabel:'CLOUD BOUNDARY', zoneColor:'#FF9900',
      techKey:'stripe', isDetected:true, files:[]
    });
  }

  // Background jobs
  if (has('bullmq') || (layers.Domain||[]).length > 2) {
    cloudHLD.push({ id:'bg-jobs', number:num(),
      label:'Background Jobs',
      sublabel: has('bullmq') ? 'BullMQ Workers' : 'Cron · Async tasks',
      zone:'cloud', zoneLabel:'CLOUD BOUNDARY', zoneColor:'#FF9900',
      techKey: has('bullmq') ? 'bullmq' : apiTech, isDetected: has('bullmq'),
      files: getFilesMatching('cron', 'worker', 'job')
    });
  }

  // Neon/Supabase/DB
  if (dbTech) {
    cloudHLD.push({ id:'database', number:num(),
      label: dbName,
      sublabel: schemaFiles.length > 0
        ? `Schema: ${schemaFiles.slice(0,2).map(f=>f.split('/').pop().replace(/\.(ts|js|prisma)$/,'')).join(', ')}`
        : (ormSuffix.trim() ? ormSuffix.trim().replace(' · ','') : 'Primary DB'),
      zone:'data', zoneLabel:'DATABASE LAYER', zoneColor:'#22C55E',
      techKey: dbTech, isDetected:true,
      files: schemaFiles.slice(0,3)
    });
  }

  // Stripe
  if (has('stripe')) {
    cloudHLD.push({ id:'stripe', number:num(),
      label:'Stripe', sublabel:'Subscription Billing · Webhooks',
      zone:'external', zoneLabel:'SAAS SERVICES', zoneColor:'#635BFF',
      techKey:'stripe', isDetected:true, files:[]
    });
  }

  // Slack
  if (has('slack')) {
    cloudHLD.push({ id:'slack-ext', number:num(),
      label:'Slack Workspace', sublabel:'Block Kit · Interactions',
      zone:'external', zoneLabel:'SAAS SERVICES', zoneColor:'#635BFF',
      techKey:'slack', isDetected:true, files:[]
    });
  }

  // Discord
  if (has('discord')) {
    cloudHLD.push({ id:'discord-ext', number:num(),
      label:'Discord', sublabel:'Bot · Guild webhooks',
      zone:'external', zoneLabel:'SAAS SERVICES', zoneColor:'#635BFF',
      techKey:'discord', isDetected:true, files:[]
    });
  }

  // AI
  if (has('openai') || has('anthropic') || has('groq')) {
    cloudHLD.push({ id:'ai', number:num(),
      label: has('openai') ? 'OpenAI' : has('anthropic') ? 'Anthropic Claude' : 'Groq',
      sublabel: has('openai') ? 'GPT · Embeddings · Moderation' : 'Claude AI · API',
      zone:'external', zoneLabel:'SAAS SERVICES', zoneColor:'#635BFF',
      techKey: has('openai') ? 'openai' : has('anthropic') ? 'anthropic' : 'groq',
      isDetected:true, files:[]
    });
  }

  // Pinecone
  if (has('pinecone')) {
    cloudHLD.push({ id:'vector-db', number:num(),
      label:'Pinecone', sublabel:'Vector DB · Semantic search',
      zone:'data', zoneLabel:'DATABASE LAYER', zoneColor:'#22C55E',
      techKey:'pinecone', isDetected:true, files:[]
    });
  }

  // S3
  if (has('aws-s3')) {
    cloudHLD.push({ id:'storage', number:num(),
      label:'AWS S3', sublabel:'Object storage',
      zone:'external', zoneLabel:'SAAS SERVICES', zoneColor:'#635BFF',
      techKey:'aws-s3', isDetected:true, files:[]
    });
  }

  // Lambda
  if (has('aws-lambda')) {
    cloudHLD.push({ id:'worker', number:num(),
      label:'AWS Lambda', sublabel:'Serverless functions',
      zone:'external', zoneLabel:'SAAS SERVICES', zoneColor:'#635BFF',
      techKey:'aws-lambda', isDetected:true, files:[]
    });
  }

  // SQS
  if (has('aws-sqs')) {
    cloudHLD.push({ id:'queue', number:num(),
      label:'AWS SQS', sublabel:'Message queue',
      zone:'external', zoneLabel:'SAAS SERVICES', zoneColor:'#635BFF',
      techKey:'aws-sqs', isDetected:true, files:[]
    });
  }

  // Email
  if (has('resend') || has('sendgrid') || has('aws-ses')) {
    cloudHLD.push({ id:'email', number:num(),
      label: has('resend') ? 'Resend' : has('sendgrid') ? 'SendGrid' : 'AWS SES',
      sublabel:'Transactional email',
      zone:'external', zoneLabel:'SAAS SERVICES', zoneColor:'#635BFF',
      techKey: has('resend') ? 'resend' : has('sendgrid') ? 'sendgrid' : 'aws-ses',
      isDetected:true, files:[]
    });
  }

  // If NO cloud services at all, add a note
  if (cloudHLD.filter(c => c.zone === 'external').length === 0) {
    cloudHLD.push({ id:'no-cloud-note', number:num(),
      label:'Self-Hosted Infrastructure',
      sublabel:'No external SaaS services detected',
      zone:'observability', zoneLabel:'INFRASTRUCTURE', zoneColor:'#6B7280',
      techKey:'', isDetected:false, files:[]
    });
  }

  const cloudHLDLayout = computeLayout(cloudHLD);
  const cloudHLDZones = buildZones(cloudHLDLayout);
  const cloudHLDConns = buildConnections(cloudHLDLayout);

  // ═══════════════════════════════════════════════════════════════
  // CLOUD — LLD
  // Real implementation details for each cloud service
  // ═══════════════════════════════════════════════════════════════
  n = 0;
  const cloudLLD = [];

  // If no AWS detected, fall back to system LLD
  const hasAnyCloud = hasAny('aws-s3','aws-lambda','aws-sqs','aws-ses','aws-dynamo',
    'aws-ec2','aws-rds','aws-cloudfront','aws-apigateway','aws-ecs','aws-eks',
    'aws-cognito','aws-bedrock','pinecone','openai','anthropic','stripe','slack',
    'discord','resend','sendgrid','groq','neon','upstash');

  if (!hasAnyCloud) {
    // Mirror system LLD but with different zone labels
    cloudLLD.push(...sysLLD.map((c,i) => ({
      ...c, id:'cloud-'+c.id, number:i+1,
      sublabel: c.sublabel + ' · No cloud services detected'
    })));
  } else {
    // Show LLD for each detected cloud service
    if (has('aws-s3')) {
      cloudLLD.push({ id:'lld-s3', number:num(),
        label:'S3 Bucket Configuration',
        sublabel:'Versioning · Lifecycle · CORS policies',
        zone:'cloud', zoneLabel:'AWS SERVICES', zoneColor:'#FF9900',
        techKey:'aws-s3', isDetected:true,
        files: getFilesMatching('s3','storage','upload')
      });
    }
    if (has('aws-lambda')) {
      cloudLLD.push({ id:'lld-lambda', number:num(),
        label:'Lambda Function Handlers',
        sublabel:'Serverless · Event-driven · Cold start optimized',
        zone:'cloud', zoneLabel:'AWS SERVICES', zoneColor:'#FF9900',
        techKey:'aws-lambda', isDetected:true,
        files: getFilesMatching('lambda','handler','function')
      });
    }
    if (has('aws-sqs')) {
      cloudLLD.push({ id:'lld-sqs', number:num(),
        label:'SQS Queue Producer & Consumer',
        sublabel:'Async messaging · DLQ · Retry policies',
        zone:'cloud', zoneLabel:'AWS SERVICES', zoneColor:'#FF9900',
        techKey:'aws-sqs', isDetected:true,
        files: getFilesMatching('queue','sqs','worker')
      });
    }
    if (has('aws-ses') || has('resend') || has('sendgrid')) {
      cloudLLD.push({ id:'lld-email', number:num(),
        label: has('aws-ses') ? 'SES Email Templates & Sender' : has('resend') ? 'Resend Email Service' : 'SendGrid Email Service',
        sublabel:'Transactional email · Bounce handling · Templates',
        zone:'cloud', zoneLabel:'AWS SERVICES', zoneColor:'#FF9900',
        techKey: has('aws-ses') ? 'aws-ses' : has('resend') ? 'resend' : 'sendgrid',
        isDetected:true,
        files: getFilesMatching('email','mail','ses','resend')
      });
    }
    if (has('aws-dynamo')) {
      cloudLLD.push({ id:'lld-dynamo', number:num(),
        label:'DynamoDB Table Design',
        sublabel:'Partition key · Sort key · GSI indexes',
        zone:'cloud', zoneLabel:'AWS SERVICES', zoneColor:'#FF9900',
        techKey:'aws-dynamo', isDetected:true,
        files: getFilesMatching('dynamo','table')
      });
    }
    if (has('pinecone')) {
      cloudLLD.push({ id:'lld-pinecone', number:num(),
        label:'Pinecone Vector Index',
        sublabel:'Embeddings · Semantic search · Namespace isolation',
        zone:'cloud', zoneLabel:'AI SERVICES', zoneColor:'#5C4EFF',
        techKey:'pinecone', isDetected:true,
        files: getFilesMatching('pinecone','vector','embed','retriev')
      });
    }
    if (has('openai') || has('anthropic') || has('groq')) {
      cloudLLD.push({ id:'lld-ai', number:num(),
        label: has('openai') ? 'OpenAI Client Config' : has('anthropic') ? 'Anthropic Client Config' : 'Groq Client Config',
        sublabel: has('openai') ? 'GPT-4 · text-embedding-3-small · streaming' : 'claude-3-5-sonnet · streaming',
        zone:'cloud', zoneLabel:'AI SERVICES', zoneColor:'#5C4EFF',
        techKey: has('openai') ? 'openai' : has('anthropic') ? 'anthropic' : 'groq',
        isDetected:true,
        files: getFilesMatching('openai','anthropic','ai','llm','groq','gemini')
      });
    }
    if (has('stripe')) {
      cloudLLD.push({ id:'lld-stripe', number:num(),
        label:'Stripe Webhook & Billing Logic',
        sublabel:'Checkout · Customer Portal · Subscription management',
        zone:'external', zoneLabel:'PAYMENT SERVICES', zoneColor:'#635BFF',
        techKey:'stripe', isDetected:true,
        files: getFilesMatching('stripe','billing','payment','subscription','webhook')
      });
    }
    if (has('slack')) {
      cloudLLD.push({ id:'lld-slack', number:num(),
        label:'Slack Bot & Block Kit',
        sublabel:'Event subscriptions · Slash commands · Interactive components',
        zone:'external', zoneLabel:'NOTIFICATION SERVICES', zoneColor:'#4A154B',
        techKey:'slack', isDetected:true,
        files: getFilesMatching('slack','block','bot','notification')
      });
    }
    if (has('neon')) {
      cloudLLD.push({ id:'lld-neon', number:num(),
        label:'Neon Serverless Postgres',
        sublabel: schemaFiles.length > 0
          ? `Schema (Multi-Tenant): ${schemaFiles.slice(0,3).map(f=>f.split('/').pop().replace(/\.(ts|js|prisma)$/,'')).join(', ')}`
          : 'Serverless Postgres · Connection pooling',
        zone:'data', zoneLabel:'DATABASE SERVICES', zoneColor:'#00E599',
        techKey:'neon', isDetected:true,
        files: schemaFiles.slice(0,4)
      });
    } else if (dbTech && schemaFiles.length > 0) {
      cloudLLD.push({ id:'lld-db', number:num(),
        label: dbName + ' Schema',
        sublabel: schemaFiles.length > 0
          ? `Tables: ${schemaFiles.slice(0,3).map(f=>f.split('/').pop().replace(/\.(ts|js|prisma)$/,'')).join(', ')}`
          : ormSuffix.trim() ? ormSuffix.trim().replace(' · ','') : 'Database schema',
        zone:'data', zoneLabel:'DATABASE SERVICES', zoneColor:'#22C55E',
        techKey: dbTech, isDetected:true,
        files: schemaFiles.slice(0,4)
      });
    }
    if (has('bullmq')) {
      cloudLLD.push({ id:'lld-bullmq', number:num(),
        label:'BullMQ Job Queues & Workers',
        sublabel:'Redis-backed · Retry · Priority queues',
        zone:'backend', zoneLabel:'ASYNC PROCESSING', zoneColor:'#F59E0B',
        techKey:'bullmq', isDetected:true,
        files: getFilesMatching('queue','worker','job','bull')
      });
    }
    if (envVars.length > 0) {
      cloudLLD.push({ id:'lld-secrets', number:num(),
        label:'Secrets & Environment Variables',
        sublabel: `${envVars.length} vars: ${envVars.slice(0,4).join(', ')}${envVars.length > 4 ? '...' : ''}`,
        zone:'ops', zoneLabel:'CONFIGURATION', zoneColor:'#6B7280',
        techKey:'node', isDetected:true,
        files: getFilesMatching('.env','config','secret')
      });
    }
  }

  const cloudLLDLayout = computeLayout(cloudLLD);
  const cloudLLDZones = buildZones(cloudLLDLayout);
  const cloudLLDConns = buildConnections(cloudLLDLayout);

  // ═══════════════════════════════════════════════════════════════
  // DEVOPS ENGINEER — HLD
  // ═══════════════════════════════════════════════════════════════
  n = 0;
  const devopsHLD = [];

  devopsHLD.push({ id:'git', number:num(),
    label:'Git Repository', sublabel:'Source control · Branches',
    zone:'devops', zoneLabel:'CODE SOURCE', zoneColor:'#24292F',
    techKey:'github', isDetected:true,
    files: getFilesMatching('.github','gitignore')
  });

  if (has('gha')) {
    devopsHLD.push({ id:'cicd', number:num(),
      label:'GitHub Actions', sublabel:'CI/CD Pipeline',
      zone:'devops', zoneLabel:'CONTINUOUS INTEGRATION', zoneColor:'#2088FF',
      techKey:'gha', isDetected:true,
      files: getFilesMatching('.github/workflows')
    });
  }

  const testTech = has('jest') ? 'jest' : has('vitest') ? 'vitest' : has('playwright') ? 'playwright' : has('cypress') ? 'cypress' : null;
  if (testTech) {
    devopsHLD.push({ id:'tests', number:num(),
      label: (testTech.charAt(0).toUpperCase() + testTech.slice(1)) + ' Test Suite',
      sublabel: `${(layers.Test||[]).length} test files · Unit + Integration`,
      zone:'devops', zoneLabel:'CONTINUOUS INTEGRATION', zoneColor:'#2088FF',
      techKey: testTech, isDetected:true,
      files: getLayerFiles('Test', 4)
    });
  }

  if (has('docker')) {
    devopsHLD.push({ id:'docker', number:num(),
      label:'Docker', sublabel:'Container runtime',
      zone:'devops', zoneLabel:'CONTINUOUS DEPLOYMENT', zoneColor:'#0db7ed',
      techKey:'docker', isDetected:true,
      files: getFilesMatching('Dockerfile','docker-compose')
    });
  }

  if (has('vercel')) {
    devopsHLD.push({ id:'deploy', number:num(),
      label:'Vercel', sublabel:'Edge deployment · Preview · Production',
      zone:'devops', zoneLabel:'CONTINUOUS DEPLOYMENT', zoneColor:'#0db7ed',
      techKey:'vercel', isDetected:true,
      files: getFilesMatching('vercel','next.config')
    });
  } else if (has('aws-ecs') || has('aws-ec2')) {
    devopsHLD.push({ id:'deploy', number:num(),
      label: has('aws-ecs') ? 'AWS ECS' : 'AWS EC2',
      sublabel:'Cloud deployment',
      zone:'devops', zoneLabel:'CONTINUOUS DEPLOYMENT', zoneColor:'#0db7ed',
      techKey: has('aws-ecs') ? 'aws-ecs' : 'aws-ec2', isDetected:true, files:[]
    });
  }

  if (has('aws-secrets') || envVars.length > 0) {
    devopsHLD.push({ id:'secrets', number:num(),
      label: has('aws-secrets') ? 'AWS Secrets Manager' : 'Environment Secrets',
      sublabel: envVars.length > 0 ? `${envVars.length} environment variables` : 'Encrypted secrets',
      zone:'devops', zoneLabel:'SECRETS & CONFIG', zoneColor:'#F59E0B',
      techKey: has('aws-secrets') ? 'aws-secrets' : 'node', isDetected: has('aws-secrets'),
      files: []
    });
  }

  if (dbTech) {
    devopsHLD.push({ id:'db-deploy', number:num(),
      label: has('prisma') ? 'Prisma Migrate' : has('drizzle') ? 'Drizzle Push' : 'Database Deploy',
      sublabel: `${dbName} · Schema migrations`,
      zone:'devops', zoneLabel:'DATABASE OPERATIONS', zoneColor:'#22C55E',
      techKey: has('prisma') ? 'prisma' : dbTech, isDetected:true,
      files: schemaFiles.slice(0,2)
    });
  }

  devopsHLD.push({ id:'monitoring', number:num(),
    label:'Observability & Feedback',
    sublabel: has('vercel') ? 'Vercel Dashboard · CI/CD Control' : 'Logs · Metrics · Traces',
    zone:'devops', zoneLabel:'OBSERVABILITY', zoneColor:'#6B7280',
    techKey:'', isDetected:false, files:[]
  });

  const devopsHLDLayout = computeLayout(devopsHLD);
  const devopsHLDZones = buildZones(devopsHLDLayout);
  const devopsHLDConns = buildConnections(devopsHLDLayout);

  // ═══════════════════════════════════════════════════════════════
  // DEVOPS — LLD
  // ═══════════════════════════════════════════════════════════════
  n = 0;
  const devopsLLD = [];

  if (has('gha')) {
    const workflowFiles = getFilesMatching('.github/workflows');
    devopsLLD.push({ id:'lld-ci', number:num(),
      label:'Continuous Integration (CI)',
      sublabel: 'Vercel Build Pipeline · Setup & Install (npm)',
      zone:'devops', zoneLabel:'CI PIPELINE', zoneColor:'#2088FF',
      techKey:'gha', isDetected:true,
      files: workflowFiles
    });
  }

  if (testTech) {
    devopsLLD.push({ id:'lld-tests', number:num(),
      label: `${testTech.charAt(0).toUpperCase()+testTech.slice(1)} Test Suite`,
      sublabel: 'Unit Tests · Integration Tests · ' + (has('stripe') ? 'Billing Logic Tests' : 'E2E Tests'),
      zone:'devops', zoneLabel:'CI PIPELINE', zoneColor:'#2088FF',
      techKey: testTech, isDetected:true,
      files: getLayerFiles('Test', 4)
    });
  }

  if (has('vercel') || has('docker')) {
    devopsLLD.push({ id:'lld-iac', number:num(),
      label:'Infrastructure as Code (IaC)',
      sublabel: has('vercel') ? 'Vercel Project Config · Manage vol' : 'Docker Compose · Container config',
      zone:'devops', zoneLabel:'CD & SECRETS', zoneColor:'#0db7ed',
      techKey: has('vercel') ? 'vercel' : 'docker', isDetected:true,
      files: getFilesMatching('vercel.json','next.config','docker-compose','k8s','kubernetes')
    });
  }

  devopsLLD.push({ id:'lld-secrets', number:num(),
    label:'Secrets & Env Vars',
    sublabel: envVars.length > 0
      ? `${envVars.length} variables: ${envVars.slice(0,3).join(', ')}${envVars.length > 3 ? '...' : ''}`
      : 'Encrypted environment variables',
    zone:'devops', zoneLabel:'CD & SECRETS', zoneColor:'#0db7ed',
    techKey:'node', isDetected:true,
    files: getFilesMatching('.env.example','.env.local.example')
  });

  if (dbTech) {
    devopsLLD.push({ id:'lld-db-ops', number:num(),
      label: has('prisma') ? 'Database (Prisma)' : `Database (${dbName})`,
      sublabel: has('prisma') ? 'npx prisma db push · Migrations · Seed' : 'Schema management · Migrations',
      zone:'devops', zoneLabel:'CD & SECRETS', zoneColor:'#0db7ed',
      techKey: has('prisma') ? 'prisma' : dbTech, isDetected:true,
      files: schemaFiles.slice(0,3)
    });
  }

  if (has('vercel')) {
    devopsLLD.push({ id:'lld-deploy', number:num(),
      label:'Vercel Deployment Pipeline',
      sublabel:'Preview Deploy · Conditional merge to main · Production Deploy',
      zone:'devops', zoneLabel:'DEPLOYMENT', zoneColor:'#22C55E',
      techKey:'vercel', isDetected:true,
      files: getFilesMatching('vercel','next.config')
    });
  }

  devopsLLD.push({ id:'lld-monitoring', number:num(),
    label: has('vercel') ? 'Vercel Analytics & Speed Insights' : 'Runtime Observability & Logs',
    sublabel: 'Build metrics · Health checks · Performance traces',
    zone:'devops', zoneLabel:'OBSERVABILITY', zoneColor:'#6B7280',
    techKey: has('vercel') ? 'vercel' : '', isDetected:true,
    files: []
  });

  const devopsLLDLayout = computeLayout(devopsLLD);
  const devopsLLDZones = buildZones(devopsLLDLayout);
  const devopsLLDConns = buildConnections(devopsLLDLayout);

  // ═══════════════════════════════════════════════════════════════
  // FINAL RETURN OBJECT
  // Returns all 3 perspectives (System, Cloud, DevOps), with HLD and LLD
  // ═══════════════════════════════════════════════════════════════
  return {
    perspectives: {
      system: {
        hld: sysHLDWithLayout,
        lld: sysLLDWithLayout
      },
      cloud: {
        hld: cloudHLDWithLayout,
        lld: cloudLLDWithLayout
      },
      devops: {
        hld: devopsHLDLayout,
        lld: devopsLLDLayout
      }
    },
    zones: {
      sysHLD: sysHLDZones,
      sysLLD: sysLLDZones,
      cloudHLD: cloudHLDZones,
      cloudLLD: cloudLLDZones,
      devopsHLD: devopsHLDZones,
      devopsLLD: devopsLLDConns
    },
    externalSaaS: [
      has('octokit')||has('github') ? { label:'GitHub', sublabel:'Users & Webhooks', techKey:'github' } : null,
      has('stripe') ? { label:'Stripe', sublabel:'Subscription Billing', techKey:'stripe' } : null,
      has('slack') ? { label:'Slack', sublabel:'Block Kit · Webhooks', techKey:'slack' } : null,
      has('discord') ? { label:'Discord', sublabel:'Bot · Webhooks', techKey:'discord' } : null,
      has('openai') ? { label:'OpenAI', sublabel:'GPT · Embeddings', techKey:'openai' } : null,
      has('anthropic') ? { label:'Anthropic', sublabel:'Claude AI API', techKey:'anthropic' } : null,
      has('resend') ? { label:'Resend', sublabel:'Transactional Email', techKey:'resend' } : null,
      has('pinecone') ? { label:'Pinecone', sublabel:'Vector Database', techKey:'pinecone' } : null,
      has('neon') ? { label:'Neon Postgres', sublabel:'Serverless DB', techKey:'neon' } : null,
    ].filter(Boolean),
    dbTables: schemaFiles.map(f => f.split('/').pop().replace(/\.(ts|js|prisma)$/,'')),
    metadata: {
      totalFiles: files.length,
      detectedStack: detected.map(d => d.name),
      primaryDb: dbName,
      primaryFramework: frontendName
    }
  };
}