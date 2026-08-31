// systemDesignMapper.js
// Fully data-driven. Reads DATA.files, DATA.stack.detected, DATA.layers
// to build accurate architecture diagrams for ANY codebase.
// Component IDs match buildConnections() in SystemDesignView.jsx exactly.

export function buildSystemDesign(DATA, fileList = []) {
  if (!DATA) return { perspectives: {}, zones: {}, metadata: {}, connections: [], externalSaaS: [], dbTables: [] };

  const detected  = DATA?.stack?.detected || [];
  const layers    = DATA?.layers  || {};
  const allFiles  = fileList.length > 0 ? fileList : (DATA?.files || []);

  // ── Detection helpers ────────────────────────────────────────────
  const has    = (key) => detected.some(t => t.key === key);
  const hasAny = (...keys) => keys.some(k => has(k));

  // ── File helpers ─────────────────────────────────────────────────
  const matchPath = (f, frag) =>
    f.relativePath.toLowerCase().replace(/\\/g, '/').includes(frag.toLowerCase());

  const filesFor = (max, ...fragments) =>
    allFiles.filter(f => fragments.some(frag => matchPath(f, frag)))
      .slice(0, max).map(f => f.relativePath);

  // ── Classify files from raw paths ────────────────────────────────
  // Only JS/TS files go into presentation — never Python files
  const presentationFiles = allFiles.filter(f => {
    const p = f.relativePath.toLowerCase().replace(/\\/g, '/');
    const ext = f.extension || '';
    if (ext === '.py') return false; // Python files are never UI
    return ext === '.tsx' || ext === '.jsx' ||
      p.includes('/pages/') || p.includes('/components/') ||
      p.includes('/views/') || p.includes('/screens/') || p.includes('/ui/') ||
      (p.includes('/app/') && (ext === '.tsx' || ext === '.jsx' || p.startsWith('src/')));
  });

  const gatewayFiles = allFiles.filter(f => {
    const p = f.relativePath.toLowerCase().replace(/\\/g, '/');
    return f.apiRoute ||
      p.includes('/api/') || p.includes('/routes/') || p.includes('/controllers/') ||
      p.includes('/handlers/') || p.includes('/resolvers/') || p.includes('/endpoints/') ||
      p.includes('/routers/') || p.includes('/graphql/');
  });

  const domainFiles = allFiles.filter(f => {
    const p = f.relativePath.toLowerCase().replace(/\\/g, '/');
    return p.includes('/services/') || p.includes('/domain/') ||
      p.includes('/usecases/') || p.includes('/business/') ||
      p.includes('/agents/') || p.includes('/tasks/') || p.includes('/workers/');
  });

  const persistenceFiles = allFiles.filter(f => {
    const p = f.relativePath.toLowerCase().replace(/\\/g, '/');
    // Use PATH-based detection only — ORM import check is too broad
    // (FastAPI projects import SQLAlchemy in almost every file)
    return p.includes('/models/') || p.includes('/schemas/') || p.includes('/db/') ||
      p.includes('/repositories/') || p.includes('/migrations/') ||
      p.includes('/entities/') || p.includes('/prisma/') ||
      (f.extension === '.prisma') || (f.extension === '.sql') ||
      // For .py files: name must literally contain model/schema/entity
      ((f.extension === '.py') && (
        f.name === 'models.py' || f.name === 'schema.py' || f.name === 'schemas.py' ||
        f.name === 'entity.py' || f.name === 'entities.py' || f.name === 'base.py' ||
        p.includes('/models/') || p.includes('/schemas/') || p.includes('/entities/')
      )) ||
      // For JS/TS: use ORM import check
      ((f.extension === '.ts' || f.extension === '.js') && f.imports && f.imports.some(imp => {
        const s = (imp?.specifier || '').toLowerCase();
        return s.includes('@prisma') || s.includes('drizzle') || s.includes('typeorm') ||
          s.includes('mongoose') || s.startsWith('mongoose/');
      }));
  });

  const envVarList = [];
  allFiles.forEach(f => {
    if (f.envVars) f.envVars.forEach(v => { if (!envVarList.includes(v)) envVarList.push(v); });
  });

  // ── Tech detection ───────────────────────────────────────────────
  const frontendTech = has('nextjs') ? 'nextjs' : has('react') ? 'react' : has('vuejs') ? 'vuejs' : has('angular') ? 'angular' : has('svelte') ? 'svelte' : 'web';
  const frontendName = has('nextjs') ? 'Next.js' : has('react') ? 'React' : has('vuejs') ? 'Vue.js' : has('angular') ? 'Angular' : has('svelte') ? 'Svelte' : 'Web App';
  const apiTech = has('express') ? 'express' : has('nestjs') ? 'nestjs' : has('fastify') ? 'fastify' : has('hono') ? 'hono' : has('fastapi') ? 'fastapi' : has('flask') ? 'flask' : has('django') ? 'django' : has('nextjs') ? 'nextjs' : 'node';
  const apiName = has('express') ? 'Express.js' : has('nestjs') ? 'NestJS' : has('fastify') ? 'Fastify' : has('hono') ? 'Hono' : has('fastapi') ? 'FastAPI' : has('flask') ? 'Flask' : has('django') ? 'Django' : has('nextjs') ? 'Next.js API' : 'API Server';
  const authTech = has('nextauth') ? 'nextauth' : has('auth0') ? 'auth0' : has('clerk') ? 'clerk' : has('supabase') ? 'supabase' : has('firebase') ? 'firebase' : (has('bcrypt') || has('jwt')) ? 'jwt' : null;
  const authName = has('nextauth') ? 'NextAuth.js' : has('auth0') ? 'Auth0' : has('clerk') ? 'Clerk' : has('supabase') ? 'Supabase Auth' : has('firebase') ? 'Firebase Auth' : (has('bcrypt') || has('jwt')) ? 'JWT / bcrypt Auth' : null;
  const dbTech = (has('postgresql') || has('psycopg2') || has('sqlalchemy')) ? 'postgresql' : has('mysql') ? 'mysql' : (has('mongodb') || has('mongoose') || has('pymongo')) ? 'mongodb' : has('sqlite') ? 'sqlite' : has('neon') ? 'postgresql' : has('supabase') ? 'supabase' : has('firebase') ? 'firebase' : has('prisma') ? 'prisma' : null;
  const dbName = has('neon') ? 'Neon Postgres' : (has('postgresql') || has('psycopg2') || has('sqlalchemy')) ? 'PostgreSQL' : has('mysql') ? 'MySQL' : (has('mongodb') || has('mongoose') || has('pymongo')) ? 'MongoDB' : has('sqlite') ? 'SQLite' : has('supabase') ? 'Supabase DB' : has('firebase') ? 'Firestore' : has('prisma') ? 'PostgreSQL' : null;
  const vectorTech = has('pinecone') ? 'pinecone' : has('chromadb') ? 'chromadb' : has('weaviate') ? 'weaviate' : has('qdrant') ? 'qdrant' : null;
  const vectorName = has('pinecone') ? 'Pinecone' : has('chromadb') ? 'ChromaDB' : has('weaviate') ? 'Weaviate' : has('qdrant') ? 'Qdrant' : null;

  const hasFrontend  = presentationFiles.length > 0 || hasAny('nextjs', 'react', 'vuejs', 'angular', 'svelte');
  const hasBackend   = gatewayFiles.length > 0 || hasAny('express', 'nestjs', 'fastapi', 'flask', 'django', 'fastify', 'hono');
  const hasDB        = !!dbTech;
  const hasAuth      = !!authTech;
  const hasLangChain = has('langchain');
  const hasAI        = hasAny('openai', 'anthropic', 'groq', 'gemini');
  const hasHF        = has('huggingface');
  const hasVectorDB  = !!vectorTech;
  const hasRedis     = hasAny('redis', 'upstash', 'ioredis');
  const hasBullMQ    = has('bullmq');
  const hasDocker    = has('docker');
  const hasVercel    = has('vercel');
  const hasStripe    = has('stripe');

  let n = 0;
  const num = () => ++n;

  // =================================================================
  // SYSTEM HLD — IDs must match SystemDesignView.jsx buildConnections()
  // =================================================================
  n = 0;
  const sysHLD = [];

  if (hasFrontend) {
    sysHLD.push({
      id: 'client', number: num(),
      label: frontendName,
      sublabel: (presentationFiles.length > 0 ? presentationFiles.length + ' UI files · ' : '') + (has('tailwind') ? 'Tailwind CSS' : 'Styled Components'),
      zone: 'client', zoneLabel: 'Client & Frontend', zoneColor: '#3B82F6',
      techKey: frontendTech, isDetected: true,
      files: presentationFiles.slice(0, 3).map(f => f.relativePath)
    });
  }

  if (hasBackend || gatewayFiles.length > 0) {
    sysHLD.push({
      id: 'api', number: num(),
      label: apiName,
      sublabel: gatewayFiles.length + ' route handlers' + (authName ? ' · ' + authName : ''),
      zone: 'gateway', zoneLabel: 'API Gateway & Auth', zoneColor: '#8B5CF6',
      techKey: apiTech, isDetected: true,
      files: gatewayFiles.slice(0, 3).map(f => f.relativePath)
    });
  }

  if (hasAuth && hasAny('nextauth', 'auth0', 'clerk')) {
    sysHLD.push({
      id: 'auth', number: num(),
      label: authName,
      sublabel: 'Identity & session management',
      zone: 'gateway', zoneLabel: 'API Gateway & Auth', zoneColor: '#8B5CF6',
      techKey: authTech, isDetected: true, files: []
    });
  }

  if (domainFiles.length > 0) {
    const agentCount   = domainFiles.filter(f => f.relativePath.toLowerCase().includes('/agents/')).length;
    const serviceCount = domainFiles.filter(f => f.relativePath.toLowerCase().includes('/services/')).length;
    sysHLD.push({
      id: 'domain', number: num(),
      label: agentCount > 0 ? 'AI Agents & Services' : 'Business Logic Services',
      sublabel: agentCount > 0
        ? agentCount + ' AI agents · ' + serviceCount + ' service modules'
        : domainFiles.length + ' service modules',
      zone: 'backend', zoneLabel: 'Business Logic', zoneColor: '#10B981',
      techKey: hasLangChain ? 'langchain' : apiTech, isDetected: true,
      files: domainFiles.slice(0, 3).map(f => f.relativePath)
    });
  }

  if (hasLangChain) {
    sysHLD.push({
      id: 'langchain', number: num(),
      label: 'LangChain RAG Pipeline',
      sublabel: 'Chains · Agents · Vector retrieval',
      zone: 'backend', zoneLabel: 'Business Logic', zoneColor: '#10B981',
      techKey: 'langchain', isDetected: true,
      files: filesFor(3, 'chain', 'rag', 'retriev', 'embed')
    });
  }

  if (hasAI) {
    const aiKey  = has('openai') ? 'openai' : has('anthropic') ? 'anthropic' : 'groq';
    const aiLabel = has('openai') ? 'OpenAI' : has('anthropic') ? 'Anthropic Claude' : 'Groq';
    sysHLD.push({
      id: 'ai', number: num(),
      label: aiLabel,
      sublabel: 'LLM API · Completions · Embeddings',
      zone: 'cloud', zoneLabel: 'External AI & Cloud', zoneColor: '#FF9900',
      techKey: aiKey, isDetected: true, files: []
    });
  }

  if (hasHF) {
    sysHLD.push({
      id: 'huggingface', number: num(),
      label: 'HuggingFace',
      sublabel: 'Transformers · Embeddings · Inference',
      zone: 'cloud', zoneLabel: 'External AI & Cloud', zoneColor: '#FF9900',
      techKey: 'huggingface', isDetected: true, files: []
    });
  }

  if (hasVectorDB) {
    sysHLD.push({
      id: 'vector-db', number: num(),
      label: vectorName,
      sublabel: 'Vector store · Semantic k-NN search',
      zone: 'data', zoneLabel: 'Data & Persistence', zoneColor: '#22C55E',
      techKey: vectorTech, isDetected: true, files: []
    });
  }

  if (hasDB) {
    sysHLD.push({
      id: 'database', number: num(),
      label: dbName,
      sublabel: persistenceFiles.length > 0
        ? persistenceFiles.length + ' models' + (has('sqlalchemy') ? ' · SQLAlchemy' : has('prisma') ? ' · Prisma ORM' : has('mongoose') ? ' · Mongoose' : '')
        : 'Primary datastore',
      zone: 'data', zoneLabel: 'Data & Persistence', zoneColor: '#22C55E',
      techKey: dbTech, isDetected: true,
      files: persistenceFiles.slice(0, 3).map(f => f.relativePath)
    });
  }

  if (hasRedis) {
    sysHLD.push({
      id: 'cache', number: num(),
      label: has('upstash') ? 'Upstash Redis' : hasBullMQ ? 'Redis + BullMQ' : 'Redis Cache',
      sublabel: hasBullMQ ? 'Job queue · Cache · Pub/Sub' : 'In-memory cache · Sessions',
      zone: 'data', zoneLabel: 'Data & Persistence', zoneColor: '#22C55E',
      techKey: has('upstash') ? 'upstash' : 'redis', isDetected: true, files: []
    });
  }

  if (hasBullMQ && !hasRedis) {
    sysHLD.push({
      id: 'queue', number: num(),
      label: 'BullMQ Job Queue',
      sublabel: 'Async task queue · Worker pool',
      zone: 'backend', zoneLabel: 'Business Logic', zoneColor: '#10B981',
      techKey: 'bullmq', isDetected: true, files: []
    });
  }

  if (hasStripe) {
    sysHLD.push({
      id: 'stripe', number: num(),
      label: 'Stripe',
      sublabel: 'Payment processing · Webhooks · Billing',
      zone: 'cloud', zoneLabel: 'External AI & Cloud', zoneColor: '#FF9900',
      techKey: 'stripe', isDetected: true, files: []
    });
  }

  if (hasAny('resend', 'sendgrid', 'nodemailer')) {
    sysHLD.push({
      id: 'email', number: num(),
      label: has('resend') ? 'Resend' : has('sendgrid') ? 'SendGrid' : 'Email Service',
      sublabel: 'Transactional email delivery',
      zone: 'cloud', zoneLabel: 'External AI & Cloud', zoneColor: '#FF9900',
      techKey: has('resend') ? 'resend' : 'sendgrid', isDetected: true, files: []
    });
  }

  if (hasAny('aws-s3', 's3', 'cloudinary')) {
    sysHLD.push({
      id: 'storage', number: num(),
      label: has('cloudinary') ? 'Cloudinary' : 'AWS S3',
      sublabel: 'Object / media storage',
      zone: 'cloud', zoneLabel: 'External AI & Cloud', zoneColor: '#FF9900',
      techKey: has('cloudinary') ? 'cloudinary' : 'aws-s3', isDetected: true, files: []
    });
  }

  if (sysHLD.length === 0) {
    sysHLD.push({
      id: 'client', number: num(),
      label: 'Application', sublabel: allFiles.length + ' source files',
      zone: 'client', zoneLabel: 'Application', zoneColor: '#3B82F6',
      techKey: 'web', isDetected: false, files: []
    });
  }

  // =================================================================
  // SYSTEM LLD — IDs must match SystemDesignView.jsx buildConnections()
  // =================================================================
  n = 0;
  const sysLLD = [];

  if (presentationFiles.length > 0) {
    sysLLD.push({
      id: 'lld-ui', number: num(),
      label: frontendName + ' UI Components',
      sublabel: presentationFiles.length + ' pages & components',
      zone: 'client', zoneLabel: 'Client & Frontend', zoneColor: '#3B82F6',
      techKey: frontendTech, isDetected: true,
      files: presentationFiles.slice(0, 4).map(f => f.relativePath)
    });
  }

  const hooksFiles = filesFor(4, '/hooks/', '/context/', '/store/');
  if (hooksFiles.length > 0 || hasAny('zustand', 'redux', 'jotai', 'recoil')) {
    sysLLD.push({
      id: 'lld-hooks', number: num(),
      label: has('zustand') ? 'Zustand State Stores' : has('redux') ? 'Redux Store' : 'React Hooks & Context',
      sublabel: (hooksFiles.length > 0 ? hooksFiles.length + ' modules · ' : '') + 'Client-side state management',
      zone: 'client', zoneLabel: 'Client & Frontend', zoneColor: '#3B82F6',
      techKey: has('zustand') ? 'zustand' : has('redux') ? 'redux' : 'react',
      isDetected: true, files: hooksFiles
    });
  }

  if (gatewayFiles.length > 0) {
    sysLLD.push({
      id: 'lld-routes', number: num(),
      label: apiName + ' Route Controllers',
      sublabel: gatewayFiles.length + ' endpoint handlers · GET/POST/PUT/DELETE',
      zone: 'gateway', zoneLabel: 'API Gateway & Auth', zoneColor: '#8B5CF6',
      techKey: apiTech, isDetected: true,
      files: gatewayFiles.slice(0, 4).map(f => f.relativePath)
    });
  }

  const authMidFiles = filesFor(3, '/auth/', 'middleware', 'guard', 'security', 'session');
  if (hasAuth || authMidFiles.length > 0) {
    sysLLD.push({
      id: 'lld-auth', number: num(),
      label: authName || 'Auth Middleware',
      sublabel: (authName ? authName + ' · ' : '') + 'JWT · CORS · Rate limiting',
      zone: 'gateway', zoneLabel: 'API Gateway & Auth', zoneColor: '#8B5CF6',
      techKey: authTech || 'jwt', isDetected: true, files: authMidFiles
    });
  }

  if (domainFiles.length > 0) {
    const agents   = domainFiles.filter(f => f.relativePath.toLowerCase().includes('/agents/'));
    const services = domainFiles.filter(f => !f.relativePath.toLowerCase().includes('/agents/'));
    sysLLD.push({
      id: 'lld-domain', number: num(),
      label: agents.length > 0 ? 'AI Agents & Business Services' : 'Domain Service Functions',
      sublabel: agents.length > 0
        ? agents.length + ' agents · ' + services.length + ' services'
        : domainFiles.length + ' service modules',
      zone: 'backend', zoneLabel: 'Business Logic & Domain', zoneColor: '#10B981',
      techKey: hasLangChain ? 'langchain' : apiTech, isDetected: true,
      files: domainFiles.slice(0, 4).map(f => f.relativePath)
    });
  }

  if (hasLangChain) {
    sysLLD.push({
      id: 'lld-langchain', number: num(),
      label: 'LangChain RAG Pipeline',
      sublabel: 'Retrieval chains · Prompt templates · Memory',
      zone: 'backend', zoneLabel: 'Business Logic & Domain', zoneColor: '#10B981',
      techKey: 'langchain', isDetected: true,
      files: filesFor(4, 'chain', 'rag', 'retriev', 'embed', 'agent')
    });
  }

  if (hasHF) {
    sysLLD.push({
      id: 'lld-hf', number: num(),
      label: 'HuggingFace Transformers',
      sublabel: 'Embeddings · Inference · sentence-transformers',
      zone: 'backend', zoneLabel: 'Business Logic & Domain', zoneColor: '#10B981',
      techKey: 'huggingface', isDetected: true,
      files: filesFor(3, 'embed', 'transform', 'infer')
    });
  }

  if (hasBullMQ) {
    sysLLD.push({
      id: 'lld-worker', number: num(),
      label: 'BullMQ Worker Pool',
      sublabel: 'Async background job queue',
      zone: 'backend', zoneLabel: 'Business Logic & Domain', zoneColor: '#10B981',
      techKey: 'bullmq', isDetected: true,
      files: filesFor(3, 'worker', 'job', 'queue', 'cron')
    });
  }

  if (hasDB || persistenceFiles.length > 0) {
    const schemaNames = persistenceFiles.slice(0, 3).map(f =>
      f.relativePath.split('/').pop().replace(/\.(ts|js|prisma|py)$/, '')
    );
    sysLLD.push({
      id: 'lld-db', number: num(),
      label: (dbName || 'Database') + ' Schema & Models',
      sublabel: schemaNames.length > 0
        ? 'Tables: ' + schemaNames.join(', ') + (persistenceFiles.length > 3 ? '...' : '')
        : 'Data models & schemas',
      zone: 'data', zoneLabel: 'Data & Persistence', zoneColor: '#22C55E',
      techKey: dbTech || 'postgresql', isDetected: true,
      files: persistenceFiles.slice(0, 4).map(f => f.relativePath)
    });
  }

  if (hasVectorDB) {
    sysLLD.push({
      id: 'lld-vector', number: num(),
      label: vectorName + ' Vector Store',
      sublabel: 'Embedding index · k-NN semantic search',
      zone: 'data', zoneLabel: 'Data & Persistence', zoneColor: '#22C55E',
      techKey: vectorTech, isDetected: true,
      files: filesFor(3, 'vector', 'embed', 'index', 'pinecone', 'chroma')
    });
  }

  if (hasRedis) {
    sysLLD.push({
      id: 'lld-cache', number: num(),
      label: has('upstash') ? 'Upstash Redis Cache' : 'Redis Cache',
      sublabel: 'Session store · In-memory cache · Pub/Sub',
      zone: 'data', zoneLabel: 'Data & Persistence', zoneColor: '#22C55E',
      techKey: has('upstash') ? 'upstash' : 'redis', isDetected: true, files: []
    });
  }

  sysLLD.push({
    id: 'lld-runtime', number: num(),
    label: 'Runtime Environment',
    sublabel: envVarList.length > 0
      ? envVarList.length + ' env vars: ' + envVarList.slice(0, 3).join(', ') + (envVarList.length > 3 ? '...' : '')
      : 'Config & secrets',
    zone: 'ops', zoneLabel: 'Runtime & Operations', zoneColor: '#6B7280',
    techKey: has('python') ? 'python' : 'node', isDetected: true,
    files: filesFor(4, '.env', 'config', 'constants', 'settings', '/core/config')
  });

  // =================================================================
  // CLOUD HLD
  // =================================================================
  n = 0;
  const cloudHLD = [];

  if (hasFrontend) {
    cloudHLD.push({ id: 'client', number: num(), label: frontendName, sublabel: 'Browser client · Real-time UI',
      zone: 'client', zoneLabel: 'Client & User Interface', zoneColor: '#3B82F6', techKey: frontendTech, isDetected: true, files: [] });
  }
  if (hasVercel) {
    cloudHLD.push({ id: 'cdn', number: num(), label: 'Vercel Edge CDN', sublabel: 'Edge network · Serverless hosting',
      zone: 'edge', zoneLabel: 'Edge & Network', zoneColor: '#06B6D4', techKey: 'vercel', isDetected: true, files: [] });
  }
  cloudHLD.push({ id: 'api', number: num(), label: apiName, sublabel: 'Routes & webhooks' + (authName ? ' · ' + authName : ''),
    zone: 'gateway', zoneLabel: 'Cloud Compute & Routing', zoneColor: '#8B5CF6', techKey: apiTech, isDetected: true,
    files: gatewayFiles.slice(0, 2).map(f => f.relativePath) });
  if (hasAuth) {
    cloudHLD.push({ id: 'auth', number: num(), label: authName, sublabel: 'Identity provider · Session validation',
      zone: 'gateway', zoneLabel: 'Cloud Compute & Routing', zoneColor: '#8B5CF6', techKey: authTech, isDetected: true, files: [] });
  }
  if (domainFiles.length > 0 || hasLangChain) {
    cloudHLD.push({ id: 'domain', number: num(), label: hasLangChain ? 'AI Agents & Services' : 'Business Logic',
      sublabel: hasLangChain ? 'LangChain · Agents · Services' : domainFiles.length + ' service modules',
      zone: 'backend', zoneLabel: 'Cloud Compute & Routing', zoneColor: '#10B981', techKey: hasLangChain ? 'langchain' : apiTech, isDetected: true, files: [] });
  }
  if (hasDB) {
    cloudHLD.push({ id: 'database', number: num(), label: dbName, sublabel: 'Primary datastore' + (has('neon') ? ' · Serverless' : ''),
      zone: 'data', zoneLabel: 'Data & Persistence', zoneColor: '#22C55E', techKey: dbTech, isDetected: true, files: [] });
  }
  if (hasRedis) {
    cloudHLD.push({ id: 'cache', number: num(), label: 'Redis Cache', sublabel: 'In-memory cache · Sessions',
      zone: 'data', zoneLabel: 'Data & Persistence', zoneColor: '#22C55E', techKey: 'redis', isDetected: true, files: [] });
  }
  if (hasAI || hasLangChain) {
    cloudHLD.push({ id: 'ai', number: num(), label: has('openai') ? 'OpenAI API' : has('anthropic') ? 'Anthropic Claude' : 'AI LLM Service',
      sublabel: 'LLM completions · Embeddings', zone: 'cloud', zoneLabel: 'External Services', zoneColor: '#FF9900',
      techKey: has('openai') ? 'openai' : 'anthropic', isDetected: true, files: [] });
  }
  if (cloudHLD.length === 0) cloudHLD.push(...sysHLD.map(c => Object.assign({}, c)));

  // =================================================================
  // CLOUD LLD
  // =================================================================
  n = 0;
  const cloudLLD = [];
  if (hasFrontend) cloudLLD.push({ id: 'lld-client', number: num(), label: frontendName + ' Client', sublabel: presentationFiles.length + ' UI components',
    zone: 'client', zoneLabel: 'Client Layer', zoneColor: '#3B82F6', techKey: frontendTech, isDetected: true, files: presentationFiles.slice(0, 3).map(f => f.relativePath) });
  cloudLLD.push({ id: 'lld-api-gw', number: num(), label: apiName + ' API Gateway', sublabel: gatewayFiles.length + ' route handlers · Auth middleware',
    zone: 'gateway', zoneLabel: 'API & Auth Layer', zoneColor: '#8B5CF6', techKey: apiTech, isDetected: true, files: gatewayFiles.slice(0, 3).map(f => f.relativePath) });
  if (hasAuth) cloudLLD.push({ id: 'lld-auth-cloud', number: num(), label: authName + ' Auth Guard', sublabel: 'Token validation · CORS · Rate limiting',
    zone: 'gateway', zoneLabel: 'API & Auth Layer', zoneColor: '#8B5CF6', techKey: authTech, isDetected: true, files: [] });
  if (hasDB) cloudLLD.push({ id: 'lld-db', number: num(), label: dbName + ' Instance', sublabel: persistenceFiles.length > 0 ? persistenceFiles.length + ' models' : 'Primary database',
    zone: 'data', zoneLabel: 'Data Layer', zoneColor: '#22C55E', techKey: dbTech, isDetected: true, files: persistenceFiles.slice(0, 3).map(f => f.relativePath) });
  if (has('neon')) cloudLLD.push({ id: 'lld-neon', number: num(), label: 'Neon Serverless Postgres', sublabel: 'Serverless SQL · DB branching',
    zone: 'data', zoneLabel: 'Data Layer', zoneColor: '#22C55E', techKey: 'neon', isDetected: true, files: [] });
  cloudLLD.push({ id: 'lld-secrets', number: num(), label: 'Secrets & Config', sublabel: envVarList.length > 0 ? envVarList.length + ' env vars configured' : 'Runtime secrets',
    zone: 'ops', zoneLabel: 'Operations', zoneColor: '#6B7280', techKey: 'node', isDetected: true, files: filesFor(3, '.env', 'secrets') });
  if (hasStripe) cloudLLD.push({ id: 'lld-stripe', number: num(), label: 'Stripe Checkout', sublabel: 'Payment gateway · Webhooks',
    zone: 'cloud', zoneLabel: 'External Services', zoneColor: '#FF9900', techKey: 'stripe', isDetected: true, files: [] });
  if (hasAI) cloudLLD.push({ id: 'lld-ai', number: num(), label: has('openai') ? 'OpenAI API' : 'AI Service', sublabel: 'LLM · Embeddings · Completions',
    zone: 'cloud', zoneLabel: 'External Services', zoneColor: '#FF9900', techKey: has('openai') ? 'openai' : 'anthropic', isDetected: true, files: [] });
  if (hasVectorDB) cloudLLD.push({ id: 'lld-pinecone', number: num(), label: vectorName, sublabel: 'Vector DB · Semantic search',
    zone: 'data', zoneLabel: 'Data Layer', zoneColor: '#22C55E', techKey: vectorTech, isDetected: true, files: [] });
  if (hasBullMQ) cloudLLD.push({ id: 'lld-bullmq', number: num(), label: 'BullMQ Worker Queue', sublabel: 'Async job dispatch · Worker pool',
    zone: 'backend', zoneLabel: 'Compute Layer', zoneColor: '#10B981', techKey: 'bullmq', isDetected: true, files: filesFor(3, 'worker', 'job', 'queue') });
  if (hasAny('aws-s3', 's3')) cloudLLD.push({ id: 'lld-s3', number: num(), label: 'AWS S3 Storage', sublabel: 'Object storage · Presigned URLs',
    zone: 'cloud', zoneLabel: 'External Services', zoneColor: '#FF9900', techKey: 'aws-s3', isDetected: true, files: [] });
  if (cloudLLD.length === 0) cloudLLD.push(...sysLLD.map(c => Object.assign({}, c)));

  // =================================================================
  // DEVOPS HLD
  // =================================================================
  n = 0;
  const devopsHLD = [];
  const testFileList = layers.Test || [];

  if (has('github') || has('gha') || has('octokit')) devopsHLD.push({ id: 'git', number: num(), label: 'GitHub Repository', sublabel: 'Source control · PRs · Code review',
    zone: 'devops', zoneLabel: 'CI/CD Pipeline', zoneColor: '#3B82F6', techKey: 'github', isDetected: true, files: [] });
  if (has('gha')) devopsHLD.push({ id: 'cicd', number: num(), label: 'GitHub Actions', sublabel: 'CI/CD workflow · Automated testing & deploy',
    zone: 'devops', zoneLabel: 'CI/CD Pipeline', zoneColor: '#3B82F6', techKey: 'gha', isDetected: true, files: filesFor(3, '.github/workflows') });
  if (testFileList.length > 0 || hasAny('jest', 'vitest', 'pytest', 'mocha')) devopsHLD.push({ id: 'tests', number: num(), label: 'Test Suite',
    sublabel: (testFileList.length > 0 ? testFileList.length + ' test files · ' : '') + (has('pytest') ? 'pytest' : has('jest') ? 'Jest' : has('vitest') ? 'Vitest' : 'Unit & Integration'),
    zone: 'devops', zoneLabel: 'CI/CD Pipeline', zoneColor: '#3B82F6', techKey: has('pytest') ? 'python' : 'jest', isDetected: true, files: testFileList.slice(0, 3) });
  if (hasDB) devopsHLD.push({ id: 'db-deploy', number: num(), label: dbName + ' Migration',
    sublabel: 'Schema migrations · ' + (has('prisma') ? 'prisma migrate' : has('alembic') ? 'alembic upgrade head' : 'DB versioning'),
    zone: 'devops', zoneLabel: 'CI/CD Pipeline', zoneColor: '#3B82F6', techKey: dbTech || 'postgresql', isDetected: true, files: filesFor(3, 'migration', 'alembic', 'migrate') });
  if (hasDocker) devopsHLD.push({ id: 'docker', number: num(), label: 'Docker', sublabel: 'Container build · docker-compose · image registry',
    zone: 'devops', zoneLabel: 'CI/CD Pipeline', zoneColor: '#3B82F6', techKey: 'docker', isDetected: true, files: filesFor(3, 'dockerfile', 'docker-compose') });
  devopsHLD.push({ id: 'deploy', number: num(),
    label: hasVercel ? 'Vercel Deployment' : hasDocker ? 'Container Deployment' : 'Production Deploy',
    sublabel: hasVercel ? 'Edge functions · Serverless · Global CDN' : hasDocker ? 'Docker container runtime' : 'Production environment',
    zone: 'devops', zoneLabel: 'CI/CD Pipeline', zoneColor: '#3B82F6', techKey: hasVercel ? 'vercel' : hasDocker ? 'docker' : 'node', isDetected: true, files: [] });
  devopsHLD.push({ id: 'secrets', number: num(), label: 'Environment Secrets',
    sublabel: envVarList.length > 0 ? envVarList.length + ' env vars configured' : 'Runtime config & secrets',
    zone: 'ops', zoneLabel: 'Runtime & Operations', zoneColor: '#6B7280', techKey: 'node', isDetected: true, files: filesFor(3, '.env', 'secrets') });
  if (devopsHLD.length <= 2) devopsHLD.unshift({ id: 'dev-env', number: num(), label: 'Development Environment',
    sublabel: 'Local setup · ' + (has('python') ? 'Python venv / pip' : 'Node.js / npm') + ' runtime',
    zone: 'devops', zoneLabel: 'Development', zoneColor: '#3B82F6', techKey: has('python') ? 'python' : 'node', isDetected: false, files: [] });

  // =================================================================
  // DEVOPS LLD
  // =================================================================
  n = 0;
  const devopsLLD = devopsHLD.map((c, i) => Object.assign({}, c, { number: i + 1, designLevel: 'LLD' }));

  // =================================================================
  // EXTERNAL SAAS CHIPS
  // =================================================================
  const externalSaaS = [];
  if (has('github') || has('octokit')) externalSaaS.push({ label: 'GitHub', sublabel: 'OAuth · Webhooks', techKey: 'github' });
  if (hasStripe)       externalSaaS.push({ label: 'Stripe',     sublabel: 'Payments · Subscriptions', techKey: 'stripe' });
  if (has('openai'))   externalSaaS.push({ label: 'OpenAI',     sublabel: 'GPT · Embeddings',          techKey: 'openai' });
  if (has('anthropic')) externalSaaS.push({ label: 'Anthropic', sublabel: 'Claude AI API',             techKey: 'anthropic' });
  if (has('groq'))     externalSaaS.push({ label: 'Groq',       sublabel: 'Fast LLM inference',        techKey: 'groq' });
  if (has('pinecone')) externalSaaS.push({ label: 'Pinecone',   sublabel: 'Vector DB',                 techKey: 'pinecone' });
  if (has('resend'))   externalSaaS.push({ label: 'Resend',     sublabel: 'Transactional email',       techKey: 'resend' });
  if (has('slack'))    externalSaaS.push({ label: 'Slack',      sublabel: 'Notifications · Webhooks',  techKey: 'slack' });
  if (hasVercel)       externalSaaS.push({ label: 'Vercel',     sublabel: 'Edge CDN · Hosting',        techKey: 'vercel' });
  if (hasDocker)       externalSaaS.push({ label: 'Docker',     sublabel: 'Containerization',          techKey: 'docker' });
  if (hasLangChain)    externalSaaS.push({ label: 'LangChain',  sublabel: 'RAG · Agents',              techKey: 'langchain' });

  const dbTables = persistenceFiles.slice(0, 8).map(f =>
    f.relativePath.split('/').pop().replace(/\.(ts|js|prisma|py)$/, '')
  );

  // =================================================================
  // RETURN
  // =================================================================
  return {
    perspectives: {
      system: { hld: sysHLD,    lld: sysLLD    },
      cloud:  { hld: cloudHLD,  lld: cloudLLD  },
      devops: { hld: devopsHLD, lld: devopsLLD }
    },
    zones: {},
    connections: [],   // SystemDesignView.jsx builds all connections itself via buildConnections()
    externalSaaS,
    dbTables,
    metadata: {
      totalFiles: allFiles.length,
      detectedStack: detected.map(d => d.name),
      primaryDb: dbName,
      primaryFramework: frontendName
    }
  };
}
