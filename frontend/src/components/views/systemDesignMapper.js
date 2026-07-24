export function buildSystemDesign(DATA, fileList = [], perspective = 'cloud') {
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

  const fileHasImport = (needle) => {
    const search = needle.toLowerCase();
    return fileList.some(f => 
      (f?.imports || []).some(imp => String(imp?.specifier || '').toLowerCase().includes(search))
    );
  };

  const fileHasEnv = (needle) => {
    const search = needle.toLowerCase();
    return fileList.some(f => 
      (f?.envVars || []).some(v => String(v || '').toLowerCase().includes(search))
    );
  };

  // Primary Codebase Language Detection
  const hasPython = hasTech('python') || fileList.some(f => f?.extension === '.py');
  const hasGo = hasTech('go') || fileList.some(f => f?.extension === '.go');
  const hasJava = hasTech('java') || fileList.some(f => f?.extension === '.java');
  const mainLang = hasPython ? 'python' : (hasGo ? 'go' : (hasJava ? 'java' : 'node'));

  // Scanned Evidence Discovery
  const hasUi = fileList.some(f => f?.layer === 'Presentation' || ['.tsx', '.jsx', '.html', '.vue', '.svelte'].includes(String(f?.extension || '').toLowerCase())) ||
    hasTech('react') || hasTech('vuejs') || hasTech('svelte') || hasTech('nextjs');

  const hasApiRoutes = fileList.some(f => f?.apiRoute || f?.layer === 'Gateway' || getRelPath(f).includes('/api/') || getRelPath(f).includes('server.')) ||
    hasTech('express') || hasTech('nestjs') || hasTech('fastify');

  const hasBotOrWebhook = fileList.some(f => {
    const path = getRelPath(f);
    return path.includes('webhook') || path.includes('bot') || path.includes('action') || path.includes('event');
  }) || fileHasImport('octokit') || fileHasImport('probot') || fileHasImport('@actions/');

  const hasGitHubApi = fileHasImport('octokit') || fileHasImport('probot') || fileHasImport('@octokit') || fileHasEnv('github_token') || fileHasEnv('gh_token');

  const hasDb = fileList.some(f => f?.layer === 'Persistence' || getRelPath(f).includes('model') || getRelPath(f).includes('schema') || f?.extension === '.prisma' || f?.extension === '.sql') ||
    hasTech('postgresql') || hasTech('mysql') || hasTech('mongodb') || hasTech('sqlite') || hasTech('prisma') || hasTech('mongoose');

  const hasRedis = fileHasImport('redis') || fileHasImport('ioredis') || fileHasEnv('redis') || hasTech('redis');

  // Infrastructure & DevOps Evidence
  const hasDocker = fileList.some(f => f?.name === 'Dockerfile' || f?.name === 'docker-compose.yml' || getRelPath(f).includes('.docker'));
  const hasK8s = fileList.some(f => getRelPath(f).includes('k8s') || getRelPath(f).includes('kubernetes') || (f?.extension === '.yaml' && (getRelPath(f).includes('deploy') || getRelPath(f).includes('helm'))));
  const hasAws = fileHasImport('aws-sdk') || fileHasImport('@aws-sdk') || fileHasEnv('aws_access_key') || fileHasEnv('aws_s3') || hasTech('aws');
  const hasVercel = fileList.some(f => f?.name === 'vercel.json') || hasTech('nextjs');
  const hasGitHubWorkflows = fileList.some(f => getRelPath(f).includes('.github/workflows'));

  const components = [];
  const zones = [];
  const connections = [];

  let compCounter = 0;
  const nextNumber = () => ++compCounter;

  // =========================================================================
  // PERSPECTIVE 1: CLOUD ARCHITECT (Cloud Infrastructure & Topologies)
  // =========================================================================
  if (perspective === 'cloud') {
    if (hasVercel) {
      components.push({
        id: 'cloud-ingress',
        number: nextNumber(),
        label: 'Vercel Edge Cloud Ingress',
        sublabel: 'Global Edge CDN & Serverless Ingress',
        tier: 'client',
        provider: 'Vercel Edge',
        badgeColor: '#000000',
        icon: 'network',
        techKey: 'next',
        isDetected: true
      });
    } else {
      components.push({
        id: 'cloud-ingress',
        number: nextNumber(),
        label: hasBotOrWebhook ? 'Webhook Event Ingress' : 'Cloud Traffic Ingress',
        sublabel: hasGitHubApi ? 'GitHub Webhook Cloud Entrypoint' : 'HTTP/S Edge Traffic Router',
        tier: 'client',
        provider: 'Cloud Ingress',
        badgeColor: '#FF5E1A',
        icon: 'network',
        techKey: hasUi ? 'react' : 'github',
        isDetected: true
      });
    }

    if (hasAws) {
      components.push({
        id: 'cloud-compute',
        number: nextNumber(),
        label: 'AWS Elastic Compute / Lambda',
        sublabel: 'AWS Managed Compute Runtime',
        tier: 'gateway',
        provider: 'AWS Compute',
        badgeColor: '#FF9900',
        icon: 'service',
        techKey: 'aws',
        isDetected: true
      });
    } else {
      components.push({
        id: 'cloud-compute',
        number: nextNumber(),
        label: `${mainLang === 'node' ? 'Node.js' : mainLang.toUpperCase()} Server Compute Host`,
        sublabel: hasTech('nextjs') ? 'Next.js App Compute Runtime' : `${mainLang === 'node' ? 'Node.js' : mainLang} Application Process`,
        tier: 'gateway',
        provider: 'Application Host',
        badgeColor: '#68A063',
        icon: 'service',
        techKey: mainLang,
        isDetected: true
      });
    }

    components.push({
      id: 'cloud-processor',
      number: nextNumber(),
      label: 'Core Automation Processor',
      sublabel: 'Domain Business Logic Service',
      tier: 'service',
      provider: 'App Processing',
      badgeColor: '#10B981',
      icon: 'service',
      techKey: mainLang,
      isDetected: true
    });

    if (hasGitHubApi) {
      components.push({
        id: 'cloud-github-api',
        number: nextNumber(),
        label: 'GitHub REST/GraphQL Cloud API',
        sublabel: 'Octokit Integration SDK Endpoint',
        tier: 'service',
        provider: 'External Cloud API',
        badgeColor: '#24292E',
        icon: 'network',
        techKey: 'github',
        isDetected: true
      });
    }

    if (hasAws) {
      components.push({
        id: 'cloud-s3',
        number: nextNumber(),
        label: 'AWS S3 Object Asset Storage',
        sublabel: 'Cloud Asset Storage Bucket',
        tier: 'data',
        provider: 'AWS Storage',
        badgeColor: '#FF9900',
        icon: 'cloud',
        techKey: 'aws',
        isDetected: true
      });
    }

    if (hasDb) {
      components.push({
        id: 'cloud-db',
        number: nextNumber(),
        label: 'Managed Database Instance',
        sublabel: hasTech('postgresql') ? 'PostgreSQL Database Store' : 'Cloud Database Instance',
        tier: 'data',
        provider: 'Cloud Database',
        badgeColor: '#336791',
        icon: 'database',
        techKey: 'postgres',
        isDetected: true
      });
    }

    if (hasRedis) {
      components.push({
        id: 'cloud-redis',
        number: nextNumber(),
        label: 'Redis Cloud Memory Cache',
        sublabel: 'In-Memory Key/Value Store',
        tier: 'data',
        provider: 'Redis Cache',
        badgeColor: '#DC382D',
        icon: 'cache',
        techKey: 'redis',
        isDetected: true
      });
    }

    components.push({
      id: 'cloud-hosting',
      number: nextNumber(),
      label: hasVercel ? 'Vercel Deployment Host' : 'Production Process Host',
      sublabel: hasVercel ? 'Vercel Automated Edge Host' : 'Server Production Host',
      tier: 'devops',
      provider: 'Cloud Host',
      badgeColor: '#2088FF',
      icon: 'monitor',
      techKey: hasVercel ? 'next' : mainLang,
      isDetected: true
    });

    connections.push(
      { from: 'cloud-ingress', to: 'cloud-compute', label: 'Routes Ingress Traffic' },
      { from: 'cloud-compute', to: 'cloud-processor', label: 'Dispatches Event Payload' }
    );

    if (hasGitHubApi) connections.push({ from: 'cloud-processor', to: 'cloud-github-api', label: 'Octokit Cloud API Calls' });
    if (hasDb) connections.push({ from: 'cloud-processor', to: 'cloud-db', label: 'Database Reads/Writes' });
    if (hasRedis) connections.push({ from: 'cloud-processor', to: 'cloud-redis', label: 'Cache Hits' });
    if (hasAws) connections.push({ from: 'cloud-processor', to: 'cloud-s3', label: 'S3 Asset Sync' });
    connections.push({ from: 'cloud-hosting', to: 'cloud-compute', label: 'Monitors Process Health', style: 'dashed' });

    zones.push(
      { id: 'client-zone', label: 'CLOUD INGRESS & TRAFFIC EDGE TIER', color: '#FF5E1A', x: 0, y: 0, w: 0, h: 0 },
      { id: 'gateway-zone', label: 'APPLICATION COMPUTE RUNTIME TIER', color: '#68A063', x: 0, y: 0, w: 0, h: 0 },
      { id: 'service-zone', label: 'DOMAIN SERVICES & EXTERNAL APIS', color: '#10B981', x: 0, y: 0, w: 0, h: 0 },
      { id: 'data-zone', label: 'PERSISTENCE & CLOUD STORAGE TIER', color: '#336791', x: 0, y: 0, w: 0, h: 0 },
      { id: 'devops-zone', label: 'PRODUCTION CLOUD HOSTING TIER', color: '#2088FF', x: 0, y: 0, w: 0, h: 0 }
    );
  }

  // =========================================================================
  // PERSPECTIVE 2: DEVOPS ENGINEER (CI/CD Pipeline & Build Workflows)
  // =========================================================================
  else if (perspective === 'devops') {
    components.push({
      id: 'devops-repo',
      number: nextNumber(),
      label: 'GitHub Code Repository',
      sublabel: 'Git Source Control & PR Triggers',
      tier: 'client',
      provider: 'Source Control',
      badgeColor: '#24292E',
      icon: 'browser',
      techKey: 'github',
      isDetected: true
    });

    if (hasGitHubWorkflows) {
      components.push({
        id: 'devops-cicd',
        number: nextNumber(),
        label: 'GitHub Actions Workflow Runner',
        sublabel: 'Automated CI Test & Build Pipeline',
        tier: 'gateway',
        provider: 'GitHub Actions',
        badgeColor: '#2088FF',
        icon: 'service',
        techKey: 'github',
        isDetected: true
      });
    } else {
      components.push({
        id: 'devops-cicd',
        number: nextNumber(),
        label: `${mainLang === 'node' ? 'NPM' : mainLang.toUpperCase()} Build & Test Suite`,
        sublabel: 'Package Compilation & Verification',
        tier: 'gateway',
        provider: `${mainLang === 'node' ? 'NPM' : mainLang} Builder`,
        badgeColor: '#CB3837',
        icon: 'service',
        techKey: mainLang,
        isDetected: true
      });
    }

    if (hasDocker) {
      components.push({
        id: 'devops-docker',
        number: nextNumber(),
        label: 'Docker Image Builder',
        sublabel: 'OCI Container Registry Build',
        tier: 'service',
        provider: 'Docker Registry',
        badgeColor: '#2496ED',
        icon: 'service',
        techKey: 'docker',
        isDetected: true
      });
    }

    if (hasK8s) {
      components.push({
        id: 'devops-k8s',
        number: nextNumber(),
        label: 'Kubernetes Cluster Pods',
        sublabel: 'K8s Container Pod Deployment',
        tier: 'data',
        provider: 'Kubernetes Cluster',
        badgeColor: '#326CE5',
        icon: 'cloud',
        techKey: 'k8s',
        isDetected: true
      });
    }

    components.push({
      id: 'devops-deploy',
      number: nextNumber(),
      label: hasVercel ? 'Vercel CD Automated Deploy' : 'Production Deployment Target',
      sublabel: hasVercel ? 'Edge Deployment Pipeline' : 'Node Server Process Deploy',
      tier: 'devops',
      provider: hasVercel ? 'Vercel CD' : 'Production Host',
      badgeColor: '#000000',
      icon: 'monitor',
      techKey: hasVercel ? 'next' : mainLang,
      isDetected: true
    });

    connections.push(
      { from: 'devops-repo', to: 'devops-cicd', label: 'Push & PR Webhook Triggers' }
    );

    if (hasDocker) {
      connections.push({ from: 'devops-cicd', to: 'devops-docker', label: 'Compiles OCI Container Image' });
      if (hasK8s) connections.push({ from: 'devops-docker', to: 'devops-k8s', label: 'Deploys Pods to Kubernetes' });
      connections.push({ from: 'devops-docker', to: 'devops-deploy', label: 'Triggers Continuous Deploy' });
    } else {
      connections.push({ from: 'devops-cicd', to: 'devops-deploy', label: 'Triggers Production Deployment' });
    }

    zones.push(
      { id: 'client-zone', label: 'SOURCE CONTROL & REPOSITORY TIER', color: '#24292E', x: 0, y: 0, w: 0, h: 0 },
      { id: 'gateway-zone', label: 'CONTINUOUS INTEGRATION (CI) BUILD TIER', color: '#2088FF', x: 0, y: 0, w: 0, h: 0 },
      ...(hasDocker ? [{ id: 'service-zone', label: 'CONTAINER REGISTRY TIER', color: '#2496ED', x: 0, y: 0, w: 0, h: 0 }] : []),
      ...(hasK8s ? [{ id: 'data-zone', label: 'KUBERNETES CONTAINER CLUSTER TIER', color: '#326CE5', x: 0, y: 0, w: 0, h: 0 }] : []),
      { id: 'devops-zone', label: 'CONTINUOUS DEPLOYMENT (CD) TARGET TIER', color: '#000000', x: 0, y: 0, w: 0, h: 0 }
    );
  }

  // =========================================================================
  // PERSPECTIVE 3: SYSTEM ARCHITECT (High-level Component Boundaries)
  // =========================================================================
  else if (perspective === 'system') {
    if (hasUi) {
      components.push({
        id: 'sys-client',
        number: nextNumber(),
        label: 'Web Presentation Client',
        sublabel: 'React Single Page App View',
        tier: 'client',
        provider: 'Frontend Client',
        badgeColor: '#FF5E1A',
        icon: 'browser',
        techKey: 'react',
        isDetected: true
      });
    }

    components.push({
      id: 'sys-webhook',
      number: nextNumber(),
      label: 'Event Listener & Webhook',
      sublabel: 'GitHub Event Ingestion Gateway',
      tier: 'client',
      provider: 'Event Entrypoint',
      badgeColor: '#8B5CF6',
      icon: 'browser',
      techKey: 'github',
      isDetected: true
    });

    components.push({
      id: 'sys-gateway',
      number: nextNumber(),
      label: 'API Router Gateway',
      sublabel: 'Express REST Router Controller',
      tier: 'gateway',
      provider: 'Gateway Layer',
      badgeColor: '#3B82F6',
      icon: 'service',
      techKey: mainLang,
      isDetected: true
    });

    components.push({
      id: 'sys-processor',
      number: nextNumber(),
      label: 'Automation Processor',
      sublabel: 'Core Business Logic Engine',
      tier: 'service',
      provider: 'Application Service',
      badgeColor: '#10B981',
      icon: 'service',
      techKey: mainLang,
      isDetected: true
    });

    if (hasGitHubApi) {
      components.push({
        id: 'sys-github-api',
        number: nextNumber(),
        label: 'GitHub REST/GraphQL API',
        sublabel: 'Octokit Integration SDK Client',
        tier: 'service',
        provider: 'External Integration',
        badgeColor: '#24292E',
        icon: 'network',
        techKey: 'github',
        isDetected: true
      });
    }

    if (hasDb) {
      components.push({
        id: 'sys-db',
        number: nextNumber(),
        label: 'Data Persistence Store',
        sublabel: 'PostgreSQL Database Engine',
        tier: 'data',
        provider: 'Database Tier',
        badgeColor: '#336791',
        icon: 'database',
        techKey: 'postgres',
        isDetected: true
      });
    }

    if (hasRedis) {
      components.push({
        id: 'sys-cache',
        number: nextNumber(),
        label: 'Redis Event Cache',
        sublabel: 'In-Memory Cache & Message Queue',
        tier: 'data',
        provider: 'Cache Tier',
        badgeColor: '#DC382D',
        icon: 'cache',
        techKey: 'redis',
        isDetected: true
      });
    }

    connections.push(
      ...(hasUi ? [{ from: 'sys-client', to: 'sys-gateway', label: 'HTTP API Requests' }] : []),
      { from: 'sys-webhook', to: 'sys-processor', label: 'Dispatches Event Payload' },
      { from: 'sys-gateway', to: 'sys-processor', label: 'Routes Controller Action' }
    );

    if (hasGitHubApi) connections.push({ from: 'sys-processor', to: 'sys-github-api', label: 'Executes Octokit API Calls' });
    if (hasDb) connections.push({ from: 'sys-processor', to: 'sys-db', label: 'Reads & Writes Records' });
    if (hasRedis) connections.push({ from: 'sys-processor', to: 'sys-cache', label: 'Cache Hits / Queues' });

    zones.push(
      { id: 'client-zone', label: 'ENTRYPOINT & EVENT INGESTION TIER', color: '#FF5E1A', x: 0, y: 0, w: 0, h: 0 },
      { id: 'gateway-zone', label: 'ROUTER & GATEWAY CONTROLLER TIER', color: '#3B82F6', x: 0, y: 0, w: 0, h: 0 },
      { id: 'service-zone', label: 'DOMAIN & BUSINESS LOGIC SERVICES', color: '#10B981', x: 0, y: 0, w: 0, h: 0 },
      ...(hasDb || hasRedis ? [{ id: 'data-zone', label: 'PERSISTENCE & INTEGRATIONS TIER', color: '#336791', x: 0, y: 0, w: 0, h: 0 }] : [])
    );
  }

  // =========================================================================
  // PERSPECTIVE 4: SOFTWARE ENGINEER (Code Modules & Dependency Flow)
  // =========================================================================
  else {
    components.push({
      id: 'sw-pages',
      number: nextNumber(),
      label: 'React Component Views',
      sublabel: 'UI Components & Custom Hooks',
      tier: 'client',
      provider: 'React UI Layer',
      badgeColor: '#61DAFB',
      icon: 'browser',
      techKey: 'react',
      isDetected: true
    });

    components.push({
      id: 'sw-controllers',
      number: nextNumber(),
      label: 'Express Route Controllers',
      sublabel: 'Endpoint Handlers & Middleware',
      tier: 'gateway',
      provider: 'Express Controllers',
      badgeColor: '#68A063',
      icon: 'service',
      techKey: mainLang,
      isDetected: true
    });

    components.push({
      id: 'sw-handlers',
      number: nextNumber(),
      label: 'Automation Service Logic',
      sublabel: 'Business Processors & Modules',
      tier: 'service',
      provider: 'Service Modules',
      badgeColor: '#8B5CF6',
      icon: 'service',
      techKey: mainLang,
      isDetected: true
    });

    if (hasGitHubApi) {
      components.push({
        id: 'sw-octokit',
        number: nextNumber(),
        label: 'Octokit Integration SDK',
        sublabel: 'GitHub API REST Client Instance',
        tier: 'service',
        provider: 'API SDK Client',
        badgeColor: '#24292E',
        icon: 'network',
        techKey: 'github',
        isDetected: true
      });
    }

    if (hasDb) {
      components.push({
        id: 'sw-prisma',
        number: nextNumber(),
        label: 'Prisma Data Models',
        sublabel: 'Database Entities & Schemas',
        tier: 'data',
        provider: 'Data Models',
        badgeColor: '#2D3748',
        icon: 'database',
        techKey: 'postgres',
        isDetected: true
      });
    }

    components.push({
      id: 'sw-utils',
      number: nextNumber(),
      label: 'Config & Logger Utils',
      sublabel: 'Helper Functions & Types',
      tier: 'devops',
      provider: 'Utilities Module',
      badgeColor: '#EAB308',
      icon: 'monitor',
      techKey: mainLang,
      isDetected: true
    });

    connections.push(
      { from: 'sw-pages', to: 'sw-controllers', label: 'Fetches Controller Endpoints' },
      { from: 'sw-controllers', to: 'sw-handlers', label: 'Invokes Service Functions' }
    );

    if (hasGitHubApi) connections.push({ from: 'sw-handlers', to: 'sw-octokit', label: 'Calls Octokit Client Methods' });
    if (hasDb) connections.push({ from: 'sw-handlers', to: 'sw-prisma', label: 'Executes Model Queries' });
    connections.push({ from: 'sw-handlers', to: 'sw-utils', label: 'Imports Helper Functions', style: 'dashed' });

    zones.push(
      { id: 'client-zone', label: 'PRESENTATION & UI COMPONENTS LAYER', color: '#61DAFB', x: 0, y: 0, w: 0, h: 0 },
      { id: 'gateway-zone', label: 'ROUTING & API CONTROLLER LAYER', color: '#68A063', x: 0, y: 0, w: 0, h: 0 },
      { id: 'service-zone', label: 'DOMAIN & SERVICE MODULES LAYER', color: '#8B5CF6', x: 0, y: 0, w: 0, h: 0 },
      ...(hasDb ? [{ id: 'data-zone', label: 'DATA MODELS & ORM LAYER', color: '#2D3748', x: 0, y: 0, w: 0, h: 0 }] : []),
      { id: 'devops-zone', label: 'UTILITY & SHARED HELPERS LAYER', color: '#EAB308', x: 0, y: 0, w: 0, h: 0 }
    );
  }

  // Safe file mapping
  components.forEach(comp => { comp.files = []; });
  fileList.forEach((file, idx) => {
    if (!file) return;
    const filePath = file.relativePath || file.name || file.path || '';
    const comp = components[idx % components.length];
    if (comp) comp.files.push(filePath);
  });

  return { components, zones, connections };
}