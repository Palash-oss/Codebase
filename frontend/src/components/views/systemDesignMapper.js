export function buildSystemDesign(DATA, fileList = [], perspective = 'system') {
  if (!DATA) {
    return { components: [], zones: [], connections: [] };
  }

  const { stack, files } = DATA;
  const detected = stack?.detected || [];
  if (!fileList || fileList.length === 0) {
    fileList = files || [];
  }

  const detectedKeys = new Set(detected.map(t => t.key));
  const hasTech = (key) => detectedKeys.has(key);
  const getRelPath = (f) => String(f?.relativePath || f?.name || f?.path || '').toLowerCase();

  // Helper to extract REAL file basenames from scanned repo (100% dynamic - NO hardcoded strings)
  const getDynamicFileList = (matcher, limit = 3) => {
    const matched = fileList.filter(f => matcher(getRelPath(f), f)).map(f => f.name || String(f.relativePath || '').split('/').pop());
    if (matched.length === 0) return null;
    const topFiles = matched.slice(0, limit).join(', ');
    return matched.length > limit ? `${topFiles} (+${matched.length - limit} files)` : topFiles;
  };

  // Primary Language & Stack Detection
  const hasPython = hasTech('python') || fileList.some(f => f?.extension === '.py');
  const hasGo = hasTech('go') || fileList.some(f => f?.extension === '.go');
  const hasJava = hasTech('java') || fileList.some(f => f?.extension === '.java');
  const mainLang = hasPython ? 'python' : (hasGo ? 'go' : (hasJava ? 'java' : 'node'));

  const components = [];
  const zones = [];
  const connections = [];

  let compCounter = 0;
  const nextNumber = () => ++compCounter;

  // Helper to map files to a subsystem component
  const assignFiles = (compId, matcher) => {
    const comp = components.find(c => c.id === compId);
    if (!comp) return;
    comp.files = fileList.filter(f => matcher(getRelPath(f), f)).map(f => f.relativePath || f.name);
  };

  const reactComps = getDynamicFileList(p => p.startsWith('frontend/') || p.includes('/components/') || p.includes('/views/'), 3);
  const reactHooks = getDynamicFileList(p => p.includes('use') || p.includes('context') || p.includes('state'), 3);
  const expressControllers = getDynamicFileList(p => p.includes('/endpoints/') || p.includes('/controllers/') || p.includes('/routes/') || p.includes('server.'), 3);
  const authMiddleware = getDynamicFileList(p => p.includes('middleware') || p.includes('auth') || p.includes('jwt'), 3);
  const llmAdapters = getDynamicFileList(p => p.includes('/aiprovider') || p.includes('/llm') || p.includes('openai'), 3);
  const vectorAdapters = getDynamicFileList(p => p.includes('/vectordb') || p.includes('lancedb') || p.includes('pinecone'), 3);
  const collectorModules = getDynamicFileList(p => p.includes('/collector') || p.includes('scraper') || p.includes('chunk'), 3);
  const prismaEntities = getDynamicFileList(p => p.includes('prisma') || p.includes('schema') || p.includes('/models/'), 3);

  // =========================================================================
  // PERSPECTIVE 1: CLOUD ARCHITECT (High-Level Cloud Infrastructure Topology)
  // =========================================================================
  if (perspective === 'cloud') {
    components.push(
      { id: 'cloud-edge', number: nextNumber(), label: '[HLD] Vercel / Edge Cloud Ingress', sublabel: 'Global CDN Ingress & TLS SSL Edge Router', tier: 'client', badgeColor: '#000000', icon: 'network', techKey: 'next', files: [], designLevel: 'HLD' },
      { id: 'cloud-cdn', number: nextNumber(), label: '[LLD] Static CDN Asset Assets & Bundle', sublabel: reactComps, tier: 'client', badgeColor: '#10B981', icon: 'network', techKey: 'react', files: [], designLevel: 'LLD' },
      { id: 'cloud-compute', number: nextNumber(), label: '[HLD] Server Compute Runtime Host', sublabel: expressControllers, tier: 'gateway', badgeColor: '#FFFFFF', icon: 'service', techKey: mainLang, files: [], designLevel: 'HLD' },
      { id: 'cloud-auth-svc', number: nextNumber(), label: '[LLD] Managed Cloud Identity & Auth Service', sublabel: authMiddleware, tier: 'gateway', badgeColor: '#3B82F6', icon: 'service', techKey: 'jwt', files: [], designLevel: 'LLD' },
      { id: 'cloud-collector', number: nextNumber(), label: '[HLD] Document Ingestion Microservice Container', sublabel: collectorModules, tier: 'service', badgeColor: '#8B5CF6', icon: 'service', techKey: 'node', files: [], designLevel: 'HLD' },
      { id: 'cloud-llm-gw', number: nextNumber(), label: '[LLD] Multi-Provider Cloud LLM Adapter Classes', sublabel: llmAdapters, tier: 'service', badgeColor: '#EC4899', icon: 'network', techKey: 'openai', files: [], designLevel: 'LLD' },
      { id: 'cloud-vector-mesh', number: nextNumber(), label: '[HLD] Managed Vector Database Mesh', sublabel: vectorAdapters, tier: 'data', badgeColor: '#10B981', icon: 'database', techKey: 'postgres', files: [], designLevel: 'HLD' },
      { id: 'cloud-db-inst', number: nextNumber(), label: '[LLD] Managed Relational DB Models (Prisma)', sublabel: prismaEntities, tier: 'data', badgeColor: '#10B981', icon: 'database', techKey: 'postgres', files: [], designLevel: 'LLD' },
      { id: 'cloud-redis-cache', number: nextNumber(), label: '[HLD] Cloud Redis In-Memory Cache', sublabel: 'Session State & API Rate Limit Cache', tier: 'data', badgeColor: '#FFFFFF', icon: 'cache', techKey: 'redis', files: [], designLevel: 'HLD' },
      { id: 'cloud-hosting', number: nextNumber(), label: '[HLD] Production Cloud Deployment Target', sublabel: 'Multi-Region Host & APM Telemetry', tier: 'devops', badgeColor: '#F59E0B', icon: 'monitor', techKey: mainLang, files: [], designLevel: 'HLD' }
    );

    connections.push(
      // HLD Connections (Active in HLD & Both modes)
      { from: 'cloud-edge', to: 'cloud-compute', label: 'Routes HTTP API Traffic' },
      { from: 'cloud-compute', to: 'cloud-collector', label: 'Ingests Documents' },
      { from: 'cloud-compute', to: 'cloud-vector-mesh', label: 'Vector Similarity Queries' },
      { from: 'cloud-compute', to: 'cloud-redis-cache', label: 'Session & Rate Limit Hits' },
      { from: 'cloud-hosting', to: 'cloud-compute', label: 'Monitors Host Health', style: 'dashed' },
      // LLD Connections (Active in LLD & Both modes)
      { from: 'cloud-cdn', to: 'cloud-auth-svc', label: 'Validates Auth Token' },
      { from: 'cloud-auth-svc', to: 'cloud-llm-gw', label: 'Dispatches Prompt Request' },
      { from: 'cloud-llm-gw', to: 'cloud-db-inst', label: 'Prisma Entity Queries' },
      // Cross HLD <-> LLD Connections (Active in Both mode)
      { from: 'cloud-edge', to: 'cloud-cdn', label: 'Serves Static UI Bundle' },
      { from: 'cloud-compute', to: 'cloud-auth-svc', label: 'Identity Interceptor' },
      { from: 'cloud-compute', to: 'cloud-llm-gw', label: 'Executes LLM Calls' },
      { from: 'cloud-vector-mesh', to: 'cloud-db-inst', label: 'Stores Index Metadata' }
    );
  }

  // =========================================================================
  // PERSPECTIVE 2: DEVOPS ENGINEER (CI/CD Pipeline & Build Infrastructure)
  // =========================================================================
  else if (perspective === 'devops') {
    components.push(
      { id: 'devops-repo', number: nextNumber(), label: '[HLD] GitHub Source Code Repository', sublabel: 'Git Source Control & Branch Management', tier: 'client', badgeColor: '#24292E', icon: 'browser', techKey: 'github', files: [], designLevel: 'HLD' },
      { id: 'devops-triggers', number: nextNumber(), label: '[LLD] Pull Request & Push Webhook Listener', sublabel: 'GitHub Event Ingestion Listener', tier: 'client', badgeColor: '#10B981', icon: 'browser', techKey: 'github', files: [], designLevel: 'LLD' },
      { id: 'devops-cicd', number: nextNumber(), label: '[HLD] GitHub Actions CI Workflow Runner', sublabel: 'Automated Test & Verification Suite', tier: 'gateway', badgeColor: '#FFFFFF', icon: 'service', techKey: 'github', files: [], designLevel: 'HLD' },
      { id: 'devops-compiler', number: nextNumber(), label: '[LLD] Build & Package Compiler Step', sublabel: 'Vite & Node.js Bundle Compilation', tier: 'gateway', badgeColor: '#CB3837', icon: 'service', techKey: mainLang, files: [], designLevel: 'LLD' },
      { id: 'devops-docker-builder', number: nextNumber(), label: '[HLD] Docker OCI Container Builder', sublabel: 'Multi-stage Dockerfile Builder', tier: 'service', badgeColor: '#2496ED', icon: 'service', techKey: 'docker', files: [], designLevel: 'HLD' },
      { id: 'devops-registry', number: nextNumber(), label: '[LLD] Container Image Registry (ECR)', sublabel: 'Versioned OCI Image Storage', tier: 'service', badgeColor: '#2496ED', icon: 'service', techKey: 'docker', files: [], designLevel: 'LLD' },
      { id: 'devops-k8s', number: nextNumber(), label: '[HLD] Kubernetes Cluster & Pod Orchestrator', sublabel: 'K8s Deployment Pods & Auto-scaler', tier: 'data', badgeColor: '#326CE5', icon: 'cloud', techKey: 'k8s', files: [], designLevel: 'HLD' },
      { id: 'devops-secrets', number: nextNumber(), label: '[LLD] Environment Secrets & Config Vault', sublabel: 'K8s Secrets / .env Production Keys', tier: 'data', badgeColor: '#10B981', icon: 'cloud', techKey: mainLang, files: [], designLevel: 'LLD' },
      { id: 'devops-deploy-target', number: nextNumber(), label: '[HLD] Production Continuous Deployment Target', sublabel: 'Vercel CD / Server Host Cluster', tier: 'devops', badgeColor: '#000000', icon: 'monitor', techKey: mainLang, files: [], designLevel: 'HLD' },
      { id: 'devops-apm', number: nextNumber(), label: '[LLD] APM Telemetry & Log Monitor', sublabel: 'Real-time Process Health Monitor', tier: 'devops', badgeColor: '#F59E0B', icon: 'monitor', techKey: mainLang, files: [], designLevel: 'LLD' }
    );

    connections.push(
      // HLD Connections
      { from: 'devops-repo', to: 'devops-cicd', label: 'Triggers CI Workflow' },
      { from: 'devops-cicd', to: 'devops-docker-builder', label: 'Triggers OCI Build' },
      { from: 'devops-docker-builder', to: 'devops-k8s', label: 'Deploys Pod Manifest' },
      { from: 'devops-k8s', to: 'devops-deploy-target', label: 'Executes Rolling Deployment' },
      // LLD Connections
      { from: 'devops-triggers', to: 'devops-compiler', label: 'Compiles Bundles & Runs Tests' },
      { from: 'devops-compiler', to: 'devops-registry', label: 'Pushes Container Artifact' },
      { from: 'devops-secrets', to: 'devops-apm', label: 'Configures Telemetry Tracing' },
      // Cross Connections
      { from: 'devops-repo', to: 'devops-triggers', label: 'Push Webhook Event' },
      { from: 'devops-cicd', to: 'devops-compiler', label: 'Invokes Compiler Step' },
      { from: 'devops-docker-builder', to: 'devops-registry', label: 'Stores Image' },
      { from: 'devops-secrets', to: 'devops-k8s', label: 'Injects Environment Keys' },
      { from: 'devops-apm', to: 'devops-deploy-target', label: 'CPU Telemetry Monitoring', style: 'dashed' }
    );
  }

  // =========================================================================
  // PERSPECTIVE 3: SYSTEM ARCHITECT (Subsystem Topology & Flow)
  // =========================================================================
  else if (perspective === 'system') {
    components.push(
      { id: 'sys-ui-app', number: nextNumber(), label: '[HLD] Client Presentation Subsystem', sublabel: 'React SPA Client Views & Interactive UI', tier: 'client', badgeColor: '#10B981', icon: 'browser', techKey: 'react', files: [], designLevel: 'HLD' },
      { id: 'sw-components', number: nextNumber(), label: '[LLD] React Component Views & Hooks', sublabel: `${reactComps} | ${reactHooks}`, tier: 'client', badgeColor: '#10B981', icon: 'browser', techKey: 'react', files: [], designLevel: 'LLD' },
      { id: 'sys-api-router', number: nextNumber(), label: '[HLD] API Gateway & Router Subsystem', sublabel: 'Express REST Router Endpoints (/api/v1)', tier: 'gateway', badgeColor: '#FFFFFF', icon: 'service', techKey: mainLang, files: [], designLevel: 'HLD' },
      { id: 'sw-express-routes', number: nextNumber(), label: '[LLD] Express Controller Handlers & Auth', sublabel: `${expressControllers} | ${authMiddleware}`, tier: 'gateway', badgeColor: '#3B82F6', icon: 'service', techKey: 'jwt', files: [], designLevel: 'LLD' },
      { id: 'sys-llm-router', number: nextNumber(), label: '[HLD] RAG Chat & LLM Provider Gateway', sublabel: 'Ollama, OpenAI, Anthropic Router', tier: 'service', badgeColor: '#EC4899', icon: 'network', techKey: 'openai', files: [], designLevel: 'HLD' },
      { id: 'sw-llm-adapters', number: nextNumber(), label: '[LLD] AiProviders Adapter Classes', sublabel: llmAdapters, tier: 'service', badgeColor: '#EC4899', icon: 'network', techKey: 'openai', files: [], designLevel: 'LLD' },
      { id: 'sys-doc-collector', number: nextNumber(), label: '[HLD] Document Collector Subsystem', sublabel: collectorModules, tier: 'service', badgeColor: '#8B5CF6', icon: 'service', techKey: 'node', files: [], designLevel: 'HLD' },
      { id: 'sys-vector-db', number: nextNumber(), label: '[HLD] Vector Database Engine Mesh', sublabel: 'LanceDB, Pinecone, Chroma Adapters', tier: 'data', badgeColor: '#10B981', icon: 'database', techKey: 'postgres', files: [], designLevel: 'HLD' },
      { id: 'sw-prisma-models', number: nextNumber(), label: '[LLD] Prisma Model Entities & Schemas', sublabel: prismaEntities, tier: 'data', badgeColor: '#10B981', icon: 'database', techKey: 'postgres', files: [], designLevel: 'LLD' },
      { id: 'sys-utils-engine', number: nextNumber(), label: '[HLD] Utilities & Task Scheduler', sublabel: 'System Config & Audit Telemetry Logger', tier: 'devops', badgeColor: 'rgba(255,255,255,0.6)', icon: 'monitor', techKey: mainLang, files: [], designLevel: 'HLD' }
    );

    connections.push(
      // HLD Connections
      { from: 'sys-ui-app', to: 'sys-api-router', label: 'HTTP REST / WebSockets' },
      { from: 'sys-api-router', to: 'sys-llm-router', label: 'Dispatches RAG Prompt' },
      { from: 'sys-llm-router', to: 'sys-vector-db', label: 'Vector Similarity Search' },
      { from: 'sys-api-router', to: 'sys-doc-collector', label: 'File Ingestion Job' },
      { from: 'sys-utils-engine', to: 'sys-api-router', label: 'System Audit Logger', style: 'dashed' },
      // LLD Connections
      { from: 'sw-components', to: 'sw-express-routes', label: 'Controller Endpoint Request' },
      { from: 'sw-express-routes', to: 'sw-llm-adapters', label: 'Invokes Provider Class' },
      { from: 'sw-express-routes', to: 'sw-prisma-models', label: 'Prisma SQL Operations' },
      // Cross Connections
      { from: 'sys-ui-app', to: 'sw-components', label: 'Renders Component Views' },
      { from: 'sys-api-router', to: 'sw-express-routes', label: 'Routes API Endpoint' },
      { from: 'sys-llm-router', to: 'sw-llm-adapters', label: 'Instantiates Adapter' },
      { from: 'sys-vector-db', to: 'sw-prisma-models', label: 'Persists Vector Index' }
    );
  }

  // =========================================================================
  // PERSPECTIVE 4: SOFTWARE ENGINEER (Code Implementation & Object Class Design)
  // =========================================================================
  else {
    components.push(
      { id: 'se-ui-layer', number: nextNumber(), label: '[HLD] Presentation & View Component Layer', sublabel: 'React Frontend Application Shell', tier: 'client', badgeColor: '#10B981', icon: 'browser', techKey: 'react', files: [], designLevel: 'HLD' },
      { id: 'se-view-classes', number: nextNumber(), label: '[LLD] View Component Classes & State Hooks', sublabel: `${reactComps} | ${reactHooks}`, tier: 'client', badgeColor: '#10B981', icon: 'browser', techKey: 'react', files: [], designLevel: 'LLD' },
      { id: 'se-routing-layer', number: nextNumber(), label: '[HLD] HTTP REST Routing Layer', sublabel: 'Express Endpoint Dispatcher Subsystem', tier: 'gateway', badgeColor: '#FFFFFF', icon: 'service', techKey: mainLang, files: [], designLevel: 'HLD' },
      { id: 'se-controller-handlers', number: nextNumber(), label: '[LLD] Controller Request Handlers & Auth Interceptor', sublabel: `${expressControllers} | ${authMiddleware}`, tier: 'gateway', badgeColor: '#3B82F6', icon: 'service', techKey: 'jwt', files: [], designLevel: 'LLD' },
      { id: 'se-ai-layer', number: nextNumber(), label: '[HLD] AI Inference & Prompt Pipeline Layer', sublabel: 'RAG Pipeline & Model Provider Interface', tier: 'service', badgeColor: '#EC4899', icon: 'network', techKey: 'openai', files: [], designLevel: 'HLD' },
      { id: 'se-llm-classes', number: nextNumber(), label: '[LLD] LLM Provider Adapter Classes', sublabel: llmAdapters, tier: 'service', badgeColor: '#EC4899', icon: 'network', techKey: 'openai', files: [], designLevel: 'LLD' },
      { id: 'se-parser-engine', number: nextNumber(), label: '[LLD] Text Chunker & File Parsing Engine', sublabel: collectorModules, tier: 'service', badgeColor: '#8B5CF6', icon: 'service', techKey: 'node', files: [], designLevel: 'LLD' },
      { id: 'se-db-layer', number: nextNumber(), label: '[HLD] Data Access & Persistence Layer', sublabel: 'Relational & Vector Store Interfaces', tier: 'data', badgeColor: '#10B981', icon: 'database', techKey: 'postgres', files: [], designLevel: 'HLD' },
      { id: 'se-prisma-schemas', number: nextNumber(), label: '[LLD] Prisma Schema Models & Entity Classes', sublabel: prismaEntities, tier: 'data', badgeColor: '#10B981', icon: 'database', techKey: 'postgres', files: [], designLevel: 'LLD' },
      { id: 'se-telemetry-util', number: nextNumber(), label: '[LLD] Logger & Telemetry Helper Classes', sublabel: 'System Audit & Telemetry Utilities', tier: 'devops', badgeColor: 'rgba(255,255,255,0.6)', icon: 'monitor', techKey: mainLang, files: [], designLevel: 'LLD' }
    );

    connections.push(
      // HLD Connections
      { from: 'se-ui-layer', to: 'se-routing-layer', label: 'HTTP REST Stream' },
      { from: 'se-routing-layer', to: 'se-ai-layer', label: 'Invokes RAG Pipeline' },
      { from: 'se-ai-layer', to: 'se-db-layer', label: 'Persistence Interface Query' },
      // LLD Connections
      { from: 'se-view-classes', to: 'se-controller-handlers', label: 'State Action Dispatcher' },
      { from: 'se-controller-handlers', to: 'se-llm-classes', label: 'Calls Provider API' },
      { from: 'se-controller-handlers', to: 'se-parser-engine', label: 'Parses Document File' },
      { from: 'se-controller-handlers', to: 'se-prisma-schemas', label: 'Prisma ORM Query' },
      { from: 'se-telemetry-util', to: 'se-controller-handlers', label: 'Audit Log Trace', style: 'dashed' },
      // Cross Connections
      { from: 'se-ui-layer', to: 'se-view-classes', label: 'Instantiates View' },
      { from: 'se-routing-layer', to: 'se-controller-handlers', label: 'Dispatches Request' },
      { from: 'se-ai-layer', to: 'se-llm-classes', label: 'Executes Class Method' },
      { from: 'se-db-layer', to: 'se-prisma-schemas', label: 'Maps Database Entities' }
    );
  }


  // Populate files array dynamically for EVERY component block across all 4 perspectives
  components.forEach(comp => {
    if (!comp.files || comp.files.length === 0) {
      if (comp.tier === 'client') {
        comp.files = fileList.filter(f => getRelPath(f).startsWith('frontend/') || getRelPath(f).includes('/components/') || getRelPath(f).includes('/views/') || getRelPath(f).includes('/pages/')).map(f => f.relativePath || f.name);
      } else if (comp.tier === 'gateway') {
        comp.files = fileList.filter(f => getRelPath(f).includes('/api/') || getRelPath(f).includes('/routes/') || getRelPath(f).includes('/controllers/') || getRelPath(f).includes('server.') || getRelPath(f).includes('auth') || getRelPath(f).includes('middleware')).map(f => f.relativePath || f.name);
      } else if (comp.tier === 'service') {
        comp.files = fileList.filter(f => getRelPath(f).includes('/aiprovider') || getRelPath(f).includes('/llm') || getRelPath(f).includes('/collector') || getRelPath(f).includes('/services/') || getRelPath(f).includes('chunk') || getRelPath(f).includes('openai')).map(f => f.relativePath || f.name);
      } else if (comp.tier === 'data') {
        comp.files = fileList.filter(f => getRelPath(f).includes('prisma') || getRelPath(f).includes('schema') || getRelPath(f).includes('/models/') || getRelPath(f).includes('/vectordb') || getRelPath(f).includes('/storage')).map(f => f.relativePath || f.name);
      } else {
        comp.files = fileList.filter(f => getRelPath(f).includes('util') || getRelPath(f).includes('config') || getRelPath(f).includes('docker') || getRelPath(f).includes('job') || getRelPath(f).includes('script')).map(f => f.relativePath || f.name);
      }
    }
  });


  zones.push(
    { id: 'client-zone', label: 'TIER 1: FRONTEND & PRESENTATION TIER (HLD + LLD)', color: '#10B981', x: 0, y: 0, w: 0, h: 0 },
    { id: 'gateway-zone', label: 'TIER 2: API GATEWAY & SECURITY TIER (HLD + LLD)', color: '#3B82F6', x: 0, y: 0, w: 0, h: 0 },
    { id: 'service-zone', label: 'TIER 3: DOMAIN LOGIC & AI INFERENCE ENGINES (HLD + LLD)', color: '#8B5CF6', x: 0, y: 0, w: 0, h: 0 },
    { id: 'data-zone', label: 'TIER 4: VECTOR MESH & PERSISTENCE TIER (HLD + LLD)', color: '#EC4899', x: 0, y: 0, w: 0, h: 0 },
    { id: 'devops-zone', label: 'TIER 5: UTILITIES & DEVOPS RUNTIME TIER (HLD + LLD)', color: '#F59E0B', x: 0, y: 0, w: 0, h: 0 }
  );

  return { components, zones, connections };
}