// systemDesignMapper.js
// Fully data-driven. Reads DATA.files, DATA.stack.detected, DATA.layers
// to build accurate architecture diagrams for ANY codebase.
// Component IDs match buildConnections() in SystemDesignView.jsx exactly.

export function buildSystemDesign(DATA, fileList = []) {
  if (!DATA) return { perspectives: {}, zones: {}, metadata: {}, connections: [], externalSaaS: [], dbTables: [], dbSchema: [] };

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

  // ── Real code data (from deep Python/JS parsing) ─────────────────
  // Collect all API routes detected from file decorators/annotations
  const allRoutes = [];
  allFiles.forEach(f => {
    if (f.routes && f.routes.length > 0) {
      f.routes.forEach(r => allRoutes.push({ ...r, file: f.relativePath }));
    }
  });

  // Collect all functions with their signatures from all files
  const allFunctions = [];
  allFiles.forEach(f => {
    if (f.functions && f.functions.length > 0) {
      f.functions.forEach(fn => allFunctions.push({ ...fn, file: f.relativePath }));
    }
  });

  // Collect all ORM model schemas (table name + fields)
  const allSchemas = [];
  allFiles.forEach(f => {
    if (f.schema && f.schema.length > 0) {
      f.schema.forEach(s => allSchemas.push({ ...s, file: f.relativePath }));
    }
  });

  // Helper: build readable endpoint list (e.g. "POST /chat · GET /status")
  const formatRoutes = (routes, max = 3) =>
    routes.slice(0, max).map(r => `${r.method} ${r.path}`).join(' · ')
      + (routes.length > max ? ` +${routes.length - max} more` : '');

  // Helper: build readable function signature list (e.g. "chat(query) · quiz(topic)")
  const formatFunctions = (fns, max = 3) =>
    fns.filter(f => !f.name.startsWith('_')).slice(0, max)
      .map(f => f.params.length > 0 ? `${f.name}(${f.params.slice(0,2).join(', ')})` : `${f.name}()`)
      .join(' · ')
      + (fns.length > max ? ` +${fns.length - max} more` : '');

  // Helper: build schema string (e.g. "User(id,email,role) · Document(id,content)")
  const formatSchema = (schemas, max = 2) =>
    schemas.slice(0, max)
      .map(s => `${s.model}(${s.fields.slice(0, 4).join(', ')})`)
      .join(' · ')
      + (schemas.length > max ? ` +${schemas.length - max} models` : '');

  let n = 0;
  const num = () => ++n;

  // ── Tech detection ───────────────────────────────────────────────
  const frontendTech = has('nextjs') ? 'nextjs' : has('react') ? 'react' : has('vuejs') ? 'vuejs' : has('angular') ? 'angular' : has('svelte') ? 'svelte' : 'web';
  const frontendName = has('nextjs') ? 'Next.js' : has('react') ? 'React' : has('vuejs') ? 'Vue.js' : has('angular') ? 'Angular' : has('svelte') ? 'Svelte' : 'Web App';
  const apiTech = has('express') ? 'express' : has('nestjs') ? 'nestjs' : has('fastify') ? 'fastify' : has('hono') ? 'hono' : has('fastapi') ? 'fastapi' : has('flask') ? 'flask' : has('django') ? 'django' : has('nextjs') ? 'nextjs' : 'node';
  const apiName = has('express') ? 'Express.js' : has('nestjs') ? 'NestJS' : has('fastify') ? 'Fastify' : has('hono') ? 'Hono' : has('fastapi') ? 'FastAPI' : has('flask') ? 'Flask' : has('django') ? 'Django' : has('nextjs') ? 'Next.js API' : 'API Server';
  const authTech = has('nextauth') ? 'nextauth' : has('auth0') ? 'auth0' : has('clerk') ? 'clerk' : has('supabase') ? 'supabase' : has('firebase') ? 'firebase' : (has('bcrypt') || has('jwt')) ? 'jwt' : null;
  const authName = has('nextauth') ? 'NextAuth.js' : has('auth0') ? 'Auth0' : has('clerk') ? 'Clerk' : has('supabase') ? 'Supabase Auth' : has('firebase') ? 'Firebase Auth' : (has('bcrypt') || has('jwt')) ? 'JWT / bcrypt Auth' : null;
  const dbTech = (has('postgresql') || has('psycopg2') || has('sqlalchemy')) ? 'postgresql' : has('mysql') ? 'mysql' : (has('mongodb') || has('mongoose') || has('pymongo')) ? 'mongodb' : has('sqlite') ? 'sqlite' : has('neon') ? 'postgresql' : has('supabase') ? 'supabase' : has('firebase') ? 'firebase' : has('prisma') ? 'prisma' : null;
  const dbName = has('neon') ? 'Neon Postgres' : (has('postgresql') || has('psycopg2') || has('sqlalchemy')) ? 'PostgreSQL' : has('mysql') ? 'MySQL' : (has('mongodb') || has('mongoose') || has('pymongo')) ? 'MongoDB' : has('sqlite') ? 'SQLite' : has('supabase') ? 'Supabase DB' : has('firebase') ? 'Firestore' : has('prisma') ? 'PostgreSQL' : null;
  // Vector DB — check all options including FAISS
  const vectorTech = has('pinecone') ? 'pinecone' : has('chromadb') ? 'chromadb' : has('weaviate') ? 'weaviate' : has('qdrant') ? 'qdrant' : has('faiss') ? 'faiss' : null;
  const vectorName = has('pinecone') ? 'Pinecone' : has('chromadb') ? 'ChromaDB' : has('weaviate') ? 'Weaviate' : has('qdrant') ? 'Qdrant' : has('faiss') ? 'FAISS' : null;

  const hasFrontend  = presentationFiles.length > 0 || hasAny('nextjs', 'react', 'vuejs', 'angular', 'svelte');
  const hasBackend   = gatewayFiles.length > 0 || hasAny('express', 'nestjs', 'fastapi', 'flask', 'django', 'fastify', 'hono');
  const hasDB        = !!dbTech;
  const hasAuth      = !!authTech;
  const hasLangChain = has('langchain');
  const hasLangGraph = has('langgraph');
  const hasLlamaIndex = has('llamaindex');
  const hasAI        = hasAny('openai', 'anthropic', 'groq', 'gemini', 'google-genai', 'ollama');
  const hasHF        = has('huggingface') || has('sentence-transformers');
  const hasVectorDB  = !!vectorTech || has('pgvector');
  const hasRedis     = hasAny('redis', 'upstash', 'ioredis');
  const hasBullMQ    = has('bullmq');
  const hasDocker    = has('docker');
  const hasVercel    = has('vercel');
  const hasStripe    = has('stripe');

  // =================================================================
  // SYSTEM HLD — IDs must match SystemDesignView.jsx buildConnections()
  // =================================================================
  n = 0;
  const sysHLD = [];

  if (hasFrontend) {
    const mainPages = presentationFiles.slice(0, 3).map(f => (f.name || '').replace(/\.(tsx?|jsx?)$/, ''));
    sysHLD.push({
      id: 'client', number: num(),
      label: frontendName + ' Web Application',
      sublabel: mainPages.length > 0 ? mainPages.join(' · ') : (has('tailwind') ? 'Tailwind CSS UI' : 'Frontend UI Components'),
      zone: 'client', zoneLabel: 'Client & Frontend', zoneColor: '#3B82F6',
      techKey: frontendTech, isDetected: true,
      files: presentationFiles.slice(0, 3).map(f => f.relativePath)
    });
  }

  if (hasBackend || gatewayFiles.length > 0) {
    const routeSummary = allRoutes.length > 0
      ? formatRoutes(allRoutes, 3)
      : (gatewayFiles.slice(0, 3).map(f => (f.name || '').replace(/\.(py|ts|js)$/, '')).join(' · '));
    sysHLD.push({
      id: 'api', number: num(),
      label: apiName + ' REST Server',
      sublabel: routeSummary || (authName ? authName + ' · REST API' : 'HTTP Endpoints · Request Routing'),
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

  if (domainFiles.length > 0 || hasLangChain || hasAI) {
    const agentCount = domainFiles.filter(f => f.relativePath.toLowerCase().includes('agent')).length;
    const domainFns  = allFunctions.filter(fn => !fn.isMethod && !fn.name.startsWith('_') && !['main', 'create_app'].includes(fn.name));
    const fnSummary  = domainFns.length > 0
      ? formatFunctions(domainFns, 3)
      : domainFiles.slice(0, 3).map(f => (f.name || '').replace(/\.(py|ts|js)$/, '')).join(' · ');
    sysHLD.push({
      id: 'domain', number: num(),
      label: agentCount > 0 ? 'AI Agents & Domain Logic' : 'Core Business Logic Services',
      sublabel: fnSummary || 'Service modules & business rules',
      zone: 'backend', zoneLabel: 'Business Logic & Domain', zoneColor: '#10B981',
      techKey: hasLangChain ? 'langchain' : apiTech, isDetected: true,
      files: domainFiles.slice(0, 3).map(f => f.relativePath)
    });
  }

  if (hasLangChain || hasLangGraph || hasLlamaIndex) {
    const orchName = hasLangGraph ? 'LangGraph Agent Pipeline' : hasLlamaIndex ? 'LlamaIndex RAG Pipeline' : 'LangChain RAG Pipeline';
    const orchKey  = hasLangGraph ? 'langgraph' : hasLlamaIndex ? 'llamaindex' : 'langchain';
    sysHLD.push({
      id: 'langchain', number: num(),
      label: orchName,
      sublabel: hasLangGraph ? 'State graphs · Multi-agent · Tool calling' : hasLlamaIndex ? 'Document index · Query engine · Retrieval' : 'Chains · Agents · Vector retrieval',
      zone: 'backend', zoneLabel: 'Business Logic', zoneColor: '#10B981',
      techKey: orchKey, isDetected: true,
      files: filesFor(3, 'chain', 'rag', 'retriev', 'embed', 'graph', 'agent')
    });
  }

  if (hasHF) {
    sysHLD.push({
      id: 'huggingface', number: num(),
      label: has('sentence-transformers') ? 'Sentence Transformers' : 'HuggingFace Transformers',
      sublabel: 'Local embeddings · Inference · sentence-transformers',
      zone: 'backend', zoneLabel: 'Business Logic', zoneColor: '#10B981',
      techKey: 'huggingface', isDetected: true,
      files: filesFor(3, 'embed', 'transform', 'infer', 'sentence')
    });
  }

  if (hasAI) {
    const aiKey   = has('openai') ? 'openai' : has('anthropic') ? 'anthropic' : has('groq') ? 'groq' : has('google-genai') ? 'google-genai' : 'ollama';
    const aiLabel = has('openai') ? 'OpenAI API' : has('anthropic') ? 'Anthropic Claude API' : has('groq') ? 'Groq LLM API' : has('google-genai') ? 'Google Gemini API' : 'Ollama Local LLM';
    sysHLD.push({
      id: 'ai', number: num(),
      label: aiLabel,
      sublabel: 'LLM API · Completions & Embeddings',
      zone: 'cloud', zoneLabel: 'External AI & Cloud', zoneColor: '#FF9900',
      techKey: aiKey, isDetected: true, files: []
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

  if (hasDB || persistenceFiles.length > 0 || allSchemas.length > 0) {
    const tableSummary = allSchemas.length > 0
      ? allSchemas.slice(0, 4).map(s => s.model).join(' · ')
      : persistenceFiles.slice(0, 4).map(f => (f.name || '').replace(/\.(py|ts|js|prisma)$/, '')).filter(n => n !== '__init__' && n !== 'base').join(' · ');
    sysHLD.push({
      id: 'database', number: num(),
      label: (dbName || 'PostgreSQL') + ' Database',
      sublabel: tableSummary ? 'Tables: ' + tableSummary : (has('sqlalchemy') ? 'SQLAlchemy ORM Models' : 'Primary Relational Datastore'),
      zone: 'data', zoneLabel: 'Data & Persistence', zoneColor: '#22C55E',
      techKey: dbTech || 'postgresql', isDetected: true,
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
  // SYSTEM LLD — Implementation-level detail view
  // Key differences from HLD:
  //   • Shows ACTUAL filenames, endpoint paths, class/table names
  //   • lld-routes always emits for any backend (Python or JS)
  //   • lld-domain always emits when AI/LangChain is present (orchestration bridge)
  //   • lld-hf in backend zone (not cloud) so no arrow crossing
  // =================================================================
  n = 0;
  const sysLLD = [];

  // ── CLIENT: always show semantic name as label, file paths go into sublabel
  if (presentationFiles.length > 0) {
    const pageNames = presentationFiles.slice(0, 3).map(f => f.relativePath.split('/').pop().replace(/\.(tsx?|jsx?)$/, ''));
    const filePathHint = presentationFiles.slice(0, 2).map(f => f.relativePath.split('/').slice(-2).join('/')).join(' · ');
    sysLLD.push({
      id: 'lld-ui', number: num(),
      label: frontendName + ' UI Components',
      sublabel: (pageNames.join(' · ') + (presentationFiles.length > 3 ? ' +' + (presentationFiles.length - 3) + ' more' : '')) || filePathHint,
      zone: 'client', zoneLabel: 'Client & Frontend', zoneColor: '#3B82F6',
      techKey: frontendTech, isDetected: true,
      files: presentationFiles.slice(0, 4).map(f => f.relativePath)
    });
  }

  // Client-side state hooks (only JS/TS apps)
  const hooksFiles = filesFor(4, '/hooks/', '/context/', '/store/');
  if (hooksFiles.length > 0) {
    sysLLD.push({
      id: 'lld-hooks', number: num(),
      label: has('zustand') ? 'Zustand State Stores' : has('redux') ? 'Redux Slices' : 'React Hooks & Context',
      sublabel: hooksFiles.map(f => f.split('/').pop().replace(/\.(ts|js|tsx|jsx)$/, '')).join(' · '),
      zone: 'client', zoneLabel: 'Client & Frontend', zoneColor: '#3B82F6',
      techKey: has('zustand') ? 'zustand' : has('redux') ? 'redux' : 'react',
      isDetected: true, files: hooksFiles
    });
  }

  // ── GATEWAY: always emit for any backend — fallback to any Python/JS files
  const routeFiles = gatewayFiles.length > 0 ? gatewayFiles
    : allFiles.filter(f => {
        const p = f.relativePath.toLowerCase().replace(/\\/g, '/');
        const n = f.name || '';
        // Flat Python/Flask/FastAPI app files
        return (n === 'app.py' || n === 'main.py' || n === 'server.py' || n === 'wsgi.py' ||
          p.includes('route') || p.includes('endpoint') || p.includes('view') ||
          (f.extension === '.py' && (f.functions || []).some(fn => ['get', 'post', 'put', 'delete', 'patch', 'route', 'app'].some(k => fn.toLowerCase().includes(k)))));
      });

  if (hasBackend || routeFiles.length > 0) {
    // Use REAL extracted routes (POST /chat, GET /status etc.) if available
    const realRoutes = allRoutes.length > 0
      ? allRoutes
      : allFiles.filter(f => f.httpMethods && f.httpMethods.length > 0)
          .flatMap(f => f.httpMethods.map(m => ({ method: m, path: '/', functionName: '?' })));
    const routeLabel = realRoutes.length > 0
      ? formatRoutes(realRoutes)
      : routeFiles.slice(0, 3).map(f => (f.name || '').replace(/\.(py|ts|js)$/, '')).join(' · ');
    sysLLD.push({
      id: 'lld-routes', number: num(),
      label: apiName + ' Route Handlers',
      sublabel: routeLabel || 'GET · POST · PUT · DELETE endpoint handlers',
      zone: 'gateway', zoneLabel: 'API Gateway & Auth', zoneColor: '#8B5CF6',
      techKey: apiTech, isDetected: true,
      files: routeFiles.slice(0, 4).map(f => f.relativePath)
    });
  }

  // Auth middleware (only if detected)
  const authMidFiles = filesFor(3, '/auth/', 'middleware', 'guard', 'security', 'session', 'deps');
  if (hasAuth || authMidFiles.length > 0) {
    sysLLD.push({
      id: 'lld-auth', number: num(),
      label: authName || 'Auth Middleware',
      sublabel: authMidFiles.length > 0
        ? authMidFiles.map(f => f.split('/').pop().replace(/\.(py|ts|js)$/, '')).join(' · ')
        : 'JWT validation · CORS · Rate limiting',
      zone: 'gateway', zoneLabel: 'API Gateway & Auth', zoneColor: '#8B5CF6',
      techKey: authTech || 'jwt', isDetected: true, files: authMidFiles
    });
  }

  // ── BACKEND DOMAIN: always emit when AI/LangChain is present (bridges routes → AI)
  const domainOrAgentFiles = domainFiles.length > 0 ? domainFiles
    : allFiles.filter(f => {
        const p = f.relativePath.toLowerCase().replace(/\\/g, '/');
        return (p.includes('service') || p.includes('agent') || p.includes('handler') ||
          p.includes('business') || p.includes('logic') || p.includes('manager') ||
          // Python files that aren't routes/models/config
          (f.extension === '.py' && !p.includes('/api/') && !p.includes('/models/') &&
           !p.includes('/db/') && !p.includes('/schemas/') && !p.includes('config') &&
           !p.includes('requirements') && !p.includes('/scripts/')));
      }).slice(0, 8);

  if (domainOrAgentFiles.length > 0 || hasLangChain || hasLangGraph || hasLlamaIndex || hasAI) {
    const agentFiles = domainOrAgentFiles.filter(f => f.relativePath.toLowerCase().includes('agent'));
    // Use REAL function signatures if available
    const domainFns = allFunctions.filter(fn =>
      !fn.isMethod && !fn.name.startsWith('_') &&
      !['main', 'create_app', 'setup', 'init'].includes(fn.name)
    );
    const sublabelText = domainFns.length > 0
      ? formatFunctions(domainFns)
      : domainOrAgentFiles.slice(0, 3).map(f => f.relativePath.split('/').pop().replace(/\.(py|ts|js)$/, '')).join(' · ');
    sysLLD.push({
      id: 'lld-domain', number: num(),
      label: agentFiles.length > 0 ? 'AI Agents & Service Layer' : 'Domain Service Layer',
      sublabel: sublabelText || 'Business logic orchestration & service modules',
      zone: 'backend', zoneLabel: 'Business Logic & Domain', zoneColor: '#10B981',
      techKey: hasLangChain ? 'langchain' : apiTech, isDetected: true,
      files: domainOrAgentFiles.slice(0, 4).map(f => f.relativePath)
    });
  }

  // LangChain / RAG implementation detail
  if (hasLangChain || hasLangGraph || hasLlamaIndex) {
    const ragFiles = filesFor(4, 'chain', 'rag', 'retriev', 'embed', 'graph', 'agent', 'llm', 'prompt');
    const orchLabel = hasLangGraph ? 'LangGraph Agent Nodes' : hasLlamaIndex ? 'LlamaIndex Query Engine' : 'LangChain Retrieval Chain';
    // Show actual AI-specific functions (get_retriever, embed_query, create_chain etc.)
    const ragFns = allFunctions.filter(fn =>
      !fn.isMethod && ['retriev', 'embed', 'chain', 'llm', 'query', 'rag', 'prompt', 'answer', 'search'].some(k => fn.name.toLowerCase().includes(k))
    );
    sysLLD.push({
      id: 'lld-langchain', number: num(),
      label: orchLabel,
      sublabel: ragFns.length > 0
        ? formatFunctions(ragFns)
        : ragFiles.length > 0
          ? ragFiles.slice(0, 3).map(f => f.split('/').pop().replace(/\.(py|ts|js)$/, '')).join(' · ')
          : 'RetrievalQA.from_chain_type() · Chroma.from_documents()',
      zone: 'backend', zoneLabel: 'Business Logic & Domain', zoneColor: '#10B981',
      techKey: hasLangGraph ? 'langgraph' : hasLlamaIndex ? 'llamaindex' : 'langchain',
      isDetected: true, files: ragFiles
    });
  }

  // HuggingFace / Sentence Transformers — backend zone (LOCAL library)
  if (hasHF) {
    const hfFiles = filesFor(3, 'embed', 'transform', 'infer', 'sentence', 'model');
    sysLLD.push({
      id: 'lld-hf', number: num(),
      label: has('sentence-transformers') ? 'Sentence Transformers Embedder' : 'HuggingFace Inference',
      sublabel: hfFiles.length > 0
        ? hfFiles.map(f => f.split('/').pop().replace(/\.(py|ts|js)$/, '')).join(' · ')
        : 'SentenceTransformer() · encode() · similarity_search()',
      zone: 'backend', zoneLabel: 'Business Logic & Domain', zoneColor: '#10B981',
      techKey: 'huggingface', isDetected: true, files: hfFiles
    });
  }

  // Celery / BullMQ workers
  if (hasBullMQ || has('celery')) {
    const workerFiles = filesFor(3, 'worker', 'job', 'queue', 'cron', 'task', 'celery');
    sysLLD.push({
      id: 'lld-worker', number: num(),
      label: has('celery') ? 'Celery Task Queue' : 'BullMQ Worker Pool',
      sublabel: workerFiles.length > 0
        ? workerFiles.map(f => f.split('/').pop().replace(/\.(py|ts|js)$/, '')).join(' · ')
        : 'Async background job processing',
      zone: 'backend', zoneLabel: 'Business Logic & Domain', zoneColor: '#10B981',
      techKey: has('celery') ? 'celery' : 'bullmq', isDetected: true, files: workerFiles
    });
  }

  // ── DATA: always use semantic name as label, model/table info in sublabel
  if (hasDB || persistenceFiles.length > 0 || allSchemas.length > 0) {
    // Prefer REAL schema fields parsed from Python ORM classes
    const schemaText = allSchemas.length > 0
      ? formatSchema(allSchemas)
      : (() => {
          const modelNames = persistenceFiles.slice(0, 5).map(f =>
            (f.name || f.relativePath.split('/').pop()).replace(/\.(ts|js|prisma|py)$/, '')
          ).filter(n => n !== 'index' && n !== '__init__' && n !== 'base');
          return modelNames.length > 0 ? 'Tables: ' + modelNames.join(', ') : 'Data models & schemas';
        })();
    const modelNames = allSchemas.length > 0
      ? allSchemas.slice(0, 3).map(s => s.model).join(' · ')
      : null;
    sysLLD.push({
      id: 'lld-db', number: num(),
      label: (dbName || 'Database') + ' Data Layer',
      sublabel: modelNames ? 'Models: ' + modelNames + ' · ' + schemaText : schemaText,
      zone: 'data', zoneLabel: 'Data & Persistence', zoneColor: '#22C55E',
      techKey: dbTech || 'postgresql', isDetected: true,
      files: persistenceFiles.slice(0, 4).map(f => f.relativePath)
    });
  }

  // Vector store implementation
  if (hasVectorDB) {
    const vecFiles = filesFor(3, 'vector', 'embed', 'index', 'pinecone', 'chroma', 'faiss', 'qdrant');
    sysLLD.push({
      id: 'lld-vector', number: num(),
      label: vectorName + ' Vector Index',
      sublabel: vecFiles.length > 0
        ? vecFiles.map(f => f.split('/').pop().replace(/\.(py|ts|js)$/, '')).join(' · ')
        : 'Embedding store · similarity_search() · k-NN',
      zone: 'data', zoneLabel: 'Data & Persistence', zoneColor: '#22C55E',
      techKey: vectorTech, isDetected: true, files: vecFiles
    });
  }

  // Redis / cache implementation
  if (hasRedis) {
    sysLLD.push({
      id: 'lld-cache', number: num(),
      label: has('upstash') ? 'Upstash Redis' : 'Redis Cache',
      sublabel: 'session_cache · rate_limiter · pub/sub channels',
      zone: 'data', zoneLabel: 'Data & Persistence', zoneColor: '#22C55E',
      techKey: has('upstash') ? 'upstash' : 'redis', isDetected: true, files: []
    });
  }

  // Runtime env — always last, always connected to routes/domain
  sysLLD.push({
    id: 'lld-runtime', number: num(),
    label: 'Runtime & Config Management',
    sublabel: envVarList.length > 0
      ? envVarList.slice(0, 4).join(' · ') + (envVarList.length > 4 ? ' +' + (envVarList.length - 4) + ' more env vars' : '')
      : 'Environment secrets · Config injection · Runtime settings',
    zone: 'ops', zoneLabel: 'Runtime & Operations', zoneColor: '#6B7280',
    techKey: has('python') ? 'python' : 'node', isDetected: true,
    files: filesFor(4, '.env', 'config', 'constants', 'settings', '/core/config', 'settings.py')
  });

  // =================================================================
  // CLOUD HLD
  // =================================================================
  n = 0;
  const cloudHLD = [];

  if (hasFrontend) {
    cloudHLD.push({ id: 'client', number: num(), label: frontendName + ' Web Application', sublabel: 'Browser client · Static assets · Real-time UI',
      zone: 'client', zoneLabel: 'Client & User Interface', zoneColor: '#3B82F6', techKey: frontendTech, isDetected: true, files: [] });
  }
  if (hasVercel) {
    cloudHLD.push({ id: 'cdn', number: num(), label: 'Vercel Edge CDN', sublabel: 'Global edge network · Serverless hosting · CDN cache',
      zone: 'edge', zoneLabel: 'Edge & CDN Network', zoneColor: '#06B6D4', techKey: 'vercel', isDetected: true, files: [] });
  }
  cloudHLD.push({ id: 'api', number: num(), label: apiName + ' API Server', sublabel: 'REST routes & webhooks' + (authName ? ' · ' + authName : ''),
    zone: 'gateway', zoneLabel: 'Cloud Compute & Routing', zoneColor: '#8B5CF6', techKey: apiTech, isDetected: true,
    files: gatewayFiles.slice(0, 2).map(f => f.relativePath) });
  if (hasAuth) {
    cloudHLD.push({ id: 'auth', number: num(), label: authName + ' Auth Provider', sublabel: 'Identity provider · JWT session validation · SSO',
      zone: 'gateway', zoneLabel: 'Cloud Compute & Routing', zoneColor: '#8B5CF6', techKey: authTech, isDetected: true, files: [] });
  }
  if (domainFiles.length > 0 || hasLangChain) {
    cloudHLD.push({ id: 'domain', number: num(), label: hasLangChain ? 'AI Orchestration & Business Logic' : 'Core Business Logic Services',
      sublabel: hasLangChain ? 'LangChain agents · RAG pipeline · Service modules' : domainFiles.length + ' service modules · Business rules',
      zone: 'backend', zoneLabel: 'Cloud Compute & Routing', zoneColor: '#10B981', techKey: hasLangChain ? 'langchain' : apiTech, isDetected: true, files: [] });
  }
  if (hasDB) {
    cloudHLD.push({ id: 'database', number: num(), label: (dbName || 'Database') + ' Cloud Database', sublabel: 'Managed primary datastore' + (has('neon') ? ' · Serverless Postgres' : ''),
      zone: 'data', zoneLabel: 'Data & Persistence', zoneColor: '#22C55E', techKey: dbTech, isDetected: true, files: [] });
  }
  if (hasRedis) {
    cloudHLD.push({ id: 'cache', number: num(), label: 'Redis Cache Layer', sublabel: 'In-memory cache · Session store · Rate limiting',
      zone: 'data', zoneLabel: 'Data & Persistence', zoneColor: '#22C55E', techKey: 'redis', isDetected: true, files: [] });
  }
  if (hasAI || hasLangChain) {
    cloudHLD.push({ id: 'ai', number: num(), label: has('openai') ? 'OpenAI GPT API' : has('anthropic') ? 'Anthropic Claude API' : 'AI LLM Cloud Service',
      sublabel: 'LLM completions · Text embeddings · Inference API', zone: 'cloud', zoneLabel: 'External AI & Cloud Services', zoneColor: '#FF9900',
      techKey: has('openai') ? 'openai' : 'anthropic', isDetected: true, files: [] });
  }
  if (cloudHLD.length === 0) cloudHLD.push(...sysHLD.map(c => Object.assign({}, c)));

  // =================================================================
  // CLOUD LLD
  // =================================================================
  n = 0;
  const cloudLLD = [];
  if (hasFrontend) cloudLLD.push({ id: 'lld-client', number: num(), label: frontendName + ' Client Application', sublabel: presentationFiles.length + ' UI components · Browser-side rendering',
    zone: 'client', zoneLabel: 'Client Layer', zoneColor: '#3B82F6', techKey: frontendTech, isDetected: true, files: presentationFiles.slice(0, 3).map(f => f.relativePath) });
  cloudLLD.push({ id: 'lld-api-gw', number: num(), label: apiName + ' API Gateway', sublabel: gatewayFiles.length + ' route handlers · Auth middleware · Request validation',
    zone: 'gateway', zoneLabel: 'API & Auth Layer', zoneColor: '#8B5CF6', techKey: apiTech, isDetected: true, files: gatewayFiles.slice(0, 3).map(f => f.relativePath) });
  if (hasAuth) cloudLLD.push({ id: 'lld-auth-cloud', number: num(), label: authName + ' Authentication Guard', sublabel: 'JWT token validation · CORS policy · Rate limiting',
    zone: 'gateway', zoneLabel: 'API & Auth Layer', zoneColor: '#8B5CF6', techKey: authTech, isDetected: true, files: [] });
  if (hasDB) cloudLLD.push({ id: 'lld-db', number: num(), label: (dbName || 'Database') + ' Database Instance', sublabel: persistenceFiles.length > 0 ? persistenceFiles.length + ' ORM model files · Primary datastore' : 'Primary managed database',
    zone: 'data', zoneLabel: 'Data Layer', zoneColor: '#22C55E', techKey: dbTech, isDetected: true, files: persistenceFiles.slice(0, 3).map(f => f.relativePath) });
  if (has('neon')) cloudLLD.push({ id: 'lld-neon', number: num(), label: 'Neon Serverless Postgres', sublabel: 'Serverless SQL · Autoscaling · DB branching',
    zone: 'data', zoneLabel: 'Data Layer', zoneColor: '#22C55E', techKey: 'neon', isDetected: true, files: [] });
  cloudLLD.push({ id: 'lld-secrets', number: num(), label: 'Secrets & Environment Config', sublabel: envVarList.length > 0 ? envVarList.length + ' env vars configured · Runtime injection' : 'Runtime secrets · Environment variables',
    zone: 'ops', zoneLabel: 'Operations & Runtime', zoneColor: '#6B7280', techKey: 'node', isDetected: true, files: filesFor(3, '.env', 'secrets') });
  if (hasStripe) cloudLLD.push({ id: 'lld-stripe', number: num(), label: 'Stripe Payment Gateway', sublabel: 'Checkout sessions · Webhook events · Billing subscriptions',
    zone: 'cloud', zoneLabel: 'External Services', zoneColor: '#FF9900', techKey: 'stripe', isDetected: true, files: [] });
  if (hasAI) cloudLLD.push({ id: 'lld-ai', number: num(), label: has('openai') ? 'OpenAI GPT API' : 'AI Inference Service', sublabel: 'LLM completions · Text embeddings · Streaming responses',
    zone: 'cloud', zoneLabel: 'External Services', zoneColor: '#FF9900', techKey: has('openai') ? 'openai' : 'anthropic', isDetected: true, files: [] });
  if (hasVectorDB) cloudLLD.push({ id: 'lld-pinecone', number: num(), label: (vectorName || 'Vector DB') + ' Vector Store', sublabel: 'Semantic search · Embedding index · k-NN retrieval',
    zone: 'data', zoneLabel: 'Data Layer', zoneColor: '#22C55E', techKey: vectorTech, isDetected: true, files: [] });
  if (hasBullMQ) cloudLLD.push({ id: 'lld-bullmq', number: num(), label: 'BullMQ Async Job Queue', sublabel: 'Background job dispatch · Worker pool · Job retries',
    zone: 'backend', zoneLabel: 'Compute Layer', zoneColor: '#10B981', techKey: 'bullmq', isDetected: true, files: filesFor(3, 'worker', 'job', 'queue') });
  if (hasAny('aws-s3', 's3')) cloudLLD.push({ id: 'lld-s3', number: num(), label: 'AWS S3 Object Storage', sublabel: 'File upload · Presigned URLs · Static asset hosting',
    zone: 'cloud', zoneLabel: 'External Services', zoneColor: '#FF9900', techKey: 'aws-s3', isDetected: true, files: [] });
  if (cloudLLD.length === 0) cloudLLD.push(...sysLLD.map(c => Object.assign({}, c)));

  // =================================================================
  // DEVOPS HLD
  // =================================================================
  n = 0;
  const devopsHLD = [];
  const testFileList = layers.Test || [];

  if (has('github') || has('gha') || has('octokit')) devopsHLD.push({ id: 'git', number: num(), label: 'GitHub Source Repository', sublabel: 'Version control · Pull requests · Code review · Branch strategy',
    zone: 'devops', zoneLabel: 'CI/CD Pipeline', zoneColor: '#3B82F6', techKey: 'github', isDetected: true, files: [] });
  if (has('gha')) devopsHLD.push({ id: 'cicd', number: num(), label: 'GitHub Actions CI/CD', sublabel: 'Automated build · Test pipeline · Deployment workflow',
    zone: 'devops', zoneLabel: 'CI/CD Pipeline', zoneColor: '#3B82F6', techKey: 'gha', isDetected: true, files: filesFor(3, '.github/workflows') });
  else devopsHLD.push({ id: 'cicd', number: num(), label: 'CI/CD Build Pipeline', sublabel: 'Automated build · Test runner · Deployment trigger',
    zone: 'devops', zoneLabel: 'CI/CD Pipeline', zoneColor: '#3B82F6', techKey: 'node', isDetected: false, files: [] });
  if (testFileList.length > 0 || hasAny('jest', 'vitest', 'pytest', 'mocha')) devopsHLD.push({ id: 'tests', number: num(),
    label: (has('pytest') ? 'Pytest' : has('jest') ? 'Jest' : has('vitest') ? 'Vitest' : 'Automated') + ' Test Suite',
    sublabel: (testFileList.length > 0 ? testFileList.length + ' test files · ' : '') + 'Unit · Integration · E2E tests',
    zone: 'devops', zoneLabel: 'CI/CD Pipeline', zoneColor: '#3B82F6', techKey: has('pytest') ? 'python' : 'jest', isDetected: true, files: testFileList.slice(0, 3) });
  if (hasDB) devopsHLD.push({ id: 'db-deploy', number: num(), label: (dbName || 'Database') + ' Schema Migration',
    sublabel: 'Schema versioning · ' + (has('prisma') ? 'Prisma migrate deploy' : has('alembic') ? 'Alembic upgrade head' : 'DB migration scripts'),
    zone: 'devops', zoneLabel: 'CI/CD Pipeline', zoneColor: '#3B82F6', techKey: dbTech || 'postgresql', isDetected: true, files: filesFor(3, 'migration', 'alembic', 'migrate') });
  if (hasDocker) devopsHLD.push({ id: 'docker', number: num(), label: 'Docker Container Build', sublabel: 'Docker image build · docker-compose · Container registry push',
    zone: 'devops', zoneLabel: 'CI/CD Pipeline', zoneColor: '#3B82F6', techKey: 'docker', isDetected: true, files: filesFor(3, 'dockerfile', 'docker-compose') });
  devopsHLD.push({ id: 'deploy', number: num(),
    label: hasVercel ? 'Vercel Production Deploy' : hasDocker ? 'Container Production Deploy' : 'Production Environment Deploy',
    sublabel: hasVercel ? 'Edge functions · Serverless · Global CDN rollout' : hasDocker ? 'Docker container runtime · Orchestration' : 'Zero-downtime production release',
    zone: 'devops', zoneLabel: 'CI/CD Pipeline', zoneColor: '#3B82F6', techKey: hasVercel ? 'vercel' : hasDocker ? 'docker' : 'node', isDetected: true, files: [] });
  devopsHLD.push({ id: 'secrets', number: num(), label: 'Environment Secrets & Config',
    sublabel: envVarList.length > 0 ? envVarList.length + ' environment variables · Runtime secrets vault' : 'Secrets management · Runtime config injection',
    zone: 'ops', zoneLabel: 'Runtime & Operations', zoneColor: '#6B7280', techKey: 'node', isDetected: true, files: filesFor(3, '.env', 'secrets') });
  if (devopsHLD.length <= 2) devopsHLD.unshift({ id: 'dev-env', number: num(), label: 'Local Development Environment',
    sublabel: 'Developer workstation · ' + (has('python') ? 'Python venv · pip install' : 'Node.js · npm install') + ' · Hot reload',
    zone: 'devops', zoneLabel: 'Development', zoneColor: '#3B82F6', techKey: has('python') ? 'python' : 'node', isDetected: false, files: [] });

  // =================================================================
  // DEVOPS LLD — Detailed implementation-level DevOps view
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

  // Use rich dbSchema from analyzer if available, fallback to inferred tables
  let schemaToUse = DATA?.dbSchema || [];
  if (!schemaToUse || schemaToUse.length === 0) {
    const tableCandidates = (persistenceFiles.length > 0 ? persistenceFiles : domainFiles.length > 0 ? domainFiles : gatewayFiles).slice(0, 5);
    if (tableCandidates.length > 0) {
      const cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Entity';
      schemaToUse = tableCandidates.map((f, idx) => {
        const rawName = f.relativePath.split('/').pop().replace(/\.(ts|js|prisma|py|sql|json)$/, '');
        const cleanName = cap(rawName.replace(/(?:models?|schemas?|entities|repository|service|controller|routes?)s?$/i, '') || rawName);
        const refName = idx > 0 ? cap(tableCandidates[0].relativePath.split('/').pop().replace(/\.(ts|js|prisma|py|sql|json)$/, '').replace(/(?:models?|schemas?|entities|repository|service|controller|routes?)s?$/i, '')) : null;
        return {
          tableName: cleanName,
          file: f.relativePath,
          dbType: dbTech || 'sql',
          columns: [
            { name: 'id', type: 'UUID', isPK: true, isFK: false, isUnique: true, isNullable: false },
            { name: `${cleanName.toLowerCase()}_name`, type: 'VARCHAR', isPK: false, isFK: false, isUnique: false, isNullable: false },
            ...(refName ? [{ name: `${refName.toLowerCase()}_id`, type: 'UUID', isPK: false, isFK: true, isUnique: false, isNullable: false, referencesTable: refName, referencesColumn: 'id' }] : []),
            { name: 'status', type: 'VARCHAR', isPK: false, isFK: false, isUnique: false, isNullable: true },
            { name: 'created_at', type: 'TIMESTAMP', isPK: false, isFK: false, isUnique: false, isNullable: false }
          ],
          relations: refName ? [{ toTable: refName, type: '1:N' }] : []
        };
      });
    }
  }

  const dbTables = schemaToUse.map(t => t.tableName);

  // =================================================================
  // RETURN
  // =================================================================
  return {
    perspectives: {
      system: { hld: sysHLD,    lld: sysLLD    },
      cloud:  { hld: cloudHLD,  lld: cloudLLD  },
      devops: { hld: devopsHLD, lld: devopsLLD },
      schema: { hld: [],        lld: []        }  // ERD is rendered separately by SystemDesignView
    },
    zones: {},
    connections: [],   // SystemDesignView.jsx builds all connections itself via buildConnections()
    externalSaaS,
    dbTables,
    dbSchema: schemaToUse,
    metadata: {
      totalFiles: allFiles.length,
      detectedStack: detected.map(d => d.name),
      primaryDb: dbName,
      primaryFramework: frontendName
    }
  };
}
