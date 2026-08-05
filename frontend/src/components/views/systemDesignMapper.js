// systemDesignMapper.js
// Builds dynamic system design components based on WHAT IS ACTUALLY IN THE PROJECT

export function buildSystemDesign(DATA, fileList = []) {
  const detected = DATA?.stack?.detected || [];
  const layers = DATA?.layers || {};
  const graph = DATA?.graph || {};

  // ─── Detection helpers ───────────────────────────────────────────────────
  const hasKey = (key) => detected.some(t => t.key === key);
  const getDetected = (key) => detected.find(t => t.key === key);
  const hasCategory = (cat) => detected.some(t => t.category === cat);

  // Specific tech detection
  const hasNextJS = hasKey('nextjs');
  const hasReact = hasKey('react') || hasNextJS;
  const hasVue = hasKey('vuejs');
  const hasExpress = hasKey('express');
  const hasNestJS = hasKey('nestjs');
  const hasFastify = hasKey('fastify');
  const hasHono = hasKey('hono');

  const hasPrisma = hasKey('prisma');
  const hasDrizzle = hasKey('drizzle');
  const hasMongoose = hasKey('mongoose');
  const hasTypeORM = hasKey('typeorm');
  const hasPostgres = hasKey('postgresql');
  const hasMySQL = hasKey('mysql');
  const hasMongoDB = hasKey('mongodb') || hasMongoose;
  const hasSQLite = hasKey('sqlite');
  const hasRedis = hasKey('redis');
  const hasSupabase = hasKey('supabase');
  const hasFirebase = hasKey('firebase');
  const hasPlanetScale = hasKey('planetscale');

  const hasNextAuth = hasKey('nextauth');
  const hasAuth0 = hasKey('auth0');
  const hasClerk = hasKey('clerk');
  const hasJWT = hasKey('jwt');
  const hasPassport = hasKey('passport');

  // AWS services
  const hasAWSS3 = hasKey('aws-s3');
  const hasAWSLambda = hasKey('aws-lambda');
  const hasAWSSQS = hasKey('aws-sqs');
  const hasAWSSES = hasKey('aws-ses');
  const hasAWSDynamoDB = hasKey('aws-dynamo');
  const hasAWSEC2 = hasKey('aws-ec2');
  const hasAWSRDS = hasKey('aws-rds');
  const hasAWSCognito = hasKey('aws-cognito');
  const hasAWSCloudFront = hasKey('aws-cloudfront');
  const hasAWSAPIGateway = hasKey('aws-apigateway');
  const hasAWSECS = hasKey('aws-ecs');
  const hasAWSEKS = hasKey('aws-eks');
  const hasAWSSNS = hasKey('aws-sns');
  const hasAWSElastiCache = hasKey('aws-elasticache');
  const hasAny_AWS = detected.some(t => t.key && t.key.startsWith('aws-'));

  const hasVercel = hasKey('vercel');
  const hasDocker = hasKey('docker');
  const hasGHA = hasKey('gha');
  const hasTurborepo = hasKey('turborepo');
  const hasKubernetes = hasKey('kubernetes') || hasAWSEKS;

  const hasTailwind = hasKey('tailwindcss') || hasKey('tailwind');
  const hasMUI = hasKey('mui');
  const hasChakra = hasKey('chakra');

  const hasJest = hasKey('jest');
  const hasVitest = hasKey('vitest');
  const hasPlaywright = hasKey('playwright');
  const hasCypress = hasKey('cypress');

  const hasZustand = hasKey('zustand');
  const hasRedux = hasKey('redux');

  // Determine primary frontend framework
  const frontendTech = hasNextJS ? 'nextjs' :
    hasReact ? 'react' :
    hasVue ? 'vuejs' : 'web';

  const frontendName = hasNextJS ? 'Next.js App' :
    hasReact ? 'React App' :
    hasVue ? 'Vue.js App' : 'Web Client';

  // Determine primary API framework
  const apiTech = hasNextJS ? 'nextjs' :
    hasNestJS ? 'nestjs' :
    hasExpress ? 'express' :
    hasFastify ? 'fastify' :
    hasHono ? 'hono' : 'node';

  const apiName = hasNestJS ? 'NestJS' :
    hasExpress ? 'Express.js' :
    hasFastify ? 'Fastify' :
    hasHono ? 'Hono' :
    hasNextJS ? 'Next.js API Routes' : 'API Server';

  // Determine primary database
  const dbTech = hasPostgres ? 'postgresql' :
    hasMySQL ? 'mysql' :
    hasMongoDB ? 'mongodb' :
    hasSQLite ? 'sqlite' :
    hasSupabase ? 'supabase' :
    hasFirebase ? 'firebase' :
    hasAWSDynamoDB ? 'aws-dynamo' : null;

  const dbName = hasPostgres ? 'PostgreSQL' :
    hasMySQL ? 'MySQL' :
    hasMongoDB ? 'MongoDB' :
    hasSQLite ? 'SQLite' :
    hasSupabase ? 'Supabase' :
    hasFirebase ? 'Firebase' :
    hasAWSDynamoDB ? 'DynamoDB' : null;

  const dbORM = hasPrisma ? ' · Prisma ORM' :
    hasDrizzle ? ' · Drizzle ORM' :
    hasMongoose ? ' · Mongoose' :
    hasTypeORM ? ' · TypeORM' : '';

  // Auth
  const authTech = hasNextAuth ? 'nextauth' :
    hasAuth0 ? 'auth0' :
    hasClerk ? 'clerk' :
    hasJWT ? 'jwt' :
    hasPassport ? 'passport' : null;

  const authName = hasNextAuth ? 'NextAuth.js' :
    hasAuth0 ? 'Auth0' :
    hasClerk ? 'Clerk' :
    hasJWT ? 'JWT Auth' :
    hasPassport ? 'Passport.js' : null;

  // Get actual files per layer
  const getLayerFiles = (layerName) =>
    (layers[layerName] || []).slice(0, 4);

  const getMultiLayerFiles = (...layerNames) => {
    const all = [];
    layerNames.forEach(l => all.push(...(layers[l] || [])));
    return all.slice(0, 4);
  };

  // Get DB schema tables from file names
  const schemaFiles = fileList.filter(f =>
    f.relativePath && (
      f.relativePath.includes('schema') ||
      f.relativePath.includes('model') ||
      f.relativePath.includes('migration') ||
      f.relativePath.includes('prisma') ||
      f.relativePath.includes('entity')
    )
  ).slice(0, 6);

  // Get actual API route paths
  const apiRouteFiles = (layers.Gateway || []).slice(0, 8);

  // Get env vars across project
  const envVars = [];
  fileList.forEach(f => {
    if (f.envVars) f.envVars.forEach(v => {
      if (!envVars.includes(v)) envVars.push(v);
    });
  });

  // ─── BUILD COMPONENTS FOR EACH PERSPECTIVE ──────────────────────────────

  let number = 1;
  const mkNum = () => number++;

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SYSTEM ARCHITECT — HLD
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const systemHLD = [];
  number = 1;

  // Always: client tier
  systemHLD.push({
    id: 'client', number: mkNum(),
    label: frontendName,
    sublabel: hasTailwind ? 'with Tailwind CSS' : hasMUI ? 'with Material UI' : hasChakra ? 'with Chakra UI' : 'Client Tier',
    tier: 'client', zone: 'frontend',
    techKey: frontendTech,
    files: getLayerFiles('Presentation'),
    isDetected: true,
    extras: hasZustand ? ['Zustand state'] : hasRedux ? ['Redux state'] : []
  });

  // API tier — only if there's actually an API
  if (apiTech || (layers.Gateway || []).length > 0) {
    systemHLD.push({
      id: 'api', number: mkNum(),
      label: apiName,
      sublabel: `${apiRouteFiles.length} route handlers`,
      tier: 'gateway', zone: 'backend',
      techKey: apiTech,
      files: getLayerFiles('Gateway'),
      isDetected: true
    });
  }

  // Auth — only if detected
  if (authTech) {
    systemHLD.push({
      id: 'auth', number: mkNum(),
      label: authName,
      sublabel: 'Authentication & Sessions',
      tier: 'service', zone: 'backend',
      techKey: authTech,
      files: fileList.filter(f => f.relativePath && (
        f.relativePath.includes('auth') || f.relativePath.includes('session')
      )).slice(0, 3).map(f => f.relativePath),
      isDetected: true
    });
  }

  // Redis cache — only if detected
  if (hasRedis) {
    systemHLD.push({
      id: 'cache', number: mkNum(),
      label: hasAWSElastiCache ? 'ElastiCache (Redis)' : 'Redis Cache',
      sublabel: 'In-memory cache & sessions',
      tier: 'cache', zone: 'data',
      techKey: 'redis',
      files: [],
      isDetected: true
    });
  }

  // Database — only if detected, using ACTUAL detected database
  if (dbTech) {
    systemHLD.push({
      id: 'database', number: mkNum(),
      label: dbName,
      sublabel: dbORM.trim() || 'Primary datastore',
      tier: 'data', zone: 'data',
      techKey: dbTech,
      files: schemaFiles.map(f => f.relativePath),
      isDetected: true,
      extras: schemaFiles.length > 0 ? schemaFiles.map(f => f.relativePath.split('/').pop()) : []
    });
  }

  // Supabase (all-in-one) — only if detected and no separate DB
  if (hasSupabase && !hasPostgres && !hasMySQL && !hasMongoDB) {
    systemHLD.push({
      id: 'supabase', number: mkNum(),
      label: 'Supabase',
      sublabel: 'Database + Auth + Storage',
      tier: 'data', zone: 'data',
      techKey: 'supabase',
      files: [],
      isDetected: true
    });
  }

  // Firebase — only if detected
  if (hasFirebase) {
    systemHLD.push({
      id: 'firebase', number: mkNum(),
      label: 'Firebase',
      sublabel: 'Firestore + Auth + Functions',
      tier: 'data', zone: 'data',
      techKey: 'firebase',
      files: [],
      isDetected: true
    });
  }

  // Domain/business logic — only if files exist in Domain layer
  if ((layers.Domain || []).length > 0) {
    systemHLD.push({
      id: 'domain', number: mkNum(),
      label: 'Business Logic',
      sublabel: `${(layers.Domain || []).length} service modules`,
      tier: 'service', zone: 'backend',
      techKey: apiTech,
      files: getLayerFiles('Domain'),
      isDetected: true
    });
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SYSTEM ARCHITECT — LLD
  // Shows actual implementation details from the code
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const systemLLD = [];
  number = 1;

  // Frontend implementation details
  const presentationFiles = layers.Presentation || [];
  if (presentationFiles.length > 0) {
    systemLLD.push({
      id: 'lld-ui', number: mkNum(),
      label: 'UI Components & Views',
      sublabel: `${presentationFiles.length} components · ${hasTailwind ? 'Tailwind' : hasMUI ? 'MUI' : 'CSS'}`,
      tier: 'client', zone: 'frontend',
      techKey: frontendTech,
      files: getLayerFiles('Presentation'),
      isDetected: true
    });
  }

  // Hooks/state implementation
  const interactionFiles = layers.Interaction || [];
  if (interactionFiles.length > 0) {
    systemLLD.push({
      id: 'lld-hooks', number: mkNum(),
      label: `React ${hasZustand ? 'Hooks & Zustand' : hasRedux ? 'Hooks & Redux' : 'Custom Hooks'} & Context API`,
      sublabel: `${interactionFiles.length} state modules · ${hasZustand ? 'Zustand Store' : hasRedux ? 'Redux Toolkit' : 'React Context'}`,
      tier: 'client', zone: 'frontend',
      techKey: hasZustand ? 'zustand' : hasRedux ? 'redux' : frontendTech,
      files: getLayerFiles('Interaction'),
      isDetected: true
    });
  }

  // API routes implementation
  const gatewayFiles = layers.Gateway || [];
  if (gatewayFiles.length > 0) {
    systemLLD.push({
      id: 'lld-routes', number: mkNum(),
      label: 'API Route Controllers & Methods',
      sublabel: `${gatewayFiles.length} endpoints · GET/POST/PUT/DELETE`,
      tier: 'gateway', zone: 'backend',
      techKey: apiTech,
      files: getLayerFiles('Gateway'),
      isDetected: true
    });
  }

  // Middleware/auth implementation
  if (authTech) {
    systemLLD.push({
      id: 'lld-auth', number: mkNum(),
      label: 'Middleware Security & Auth Guard',
      sublabel: `Guarded by ${authName} · CORS Policy`,
      tier: 'service', zone: 'backend',
      techKey: authTech,
      files: fileList.filter(f => f.relativePath && (
        f.relativePath.includes('middleware') ||
        f.relativePath.includes('auth') ||
        f.relativePath.includes('guard')
      )).slice(0, 3).map(f => f.relativePath),
      isDetected: true
    });
  }

  // Domain/service implementation
  const domainFiles = layers.Domain || [];
  if (domainFiles.length > 0) {
    systemLLD.push({
      id: 'lld-domain', number: mkNum(),
      label: 'Domain Service Function Signatures',
      sublabel: `${domainFiles.length} service modules`,
      tier: 'service', zone: 'backend',
      techKey: apiTech,
      files: getLayerFiles('Domain'),
      isDetected: true
    });
  }

  // Database/ORM implementation
  if (dbTech) {
    systemLLD.push({
      id: 'lld-db', number: mkNum(),
      label: `${hasPrisma ? 'Prisma' : hasDrizzle ? 'Drizzle' : hasMongoose ? 'Mongoose' : ''} ORM Table Schemas & Data Entities`,
      sublabel: schemaFiles.length > 0
        ? `Tables: ${schemaFiles.map(f => f.relativePath.split('/').pop().replace('.prisma','').replace('.ts','')).join(', ')}`
        : `${dbName} schema definitions`,
      tier: 'data', zone: 'data',
      techKey: dbTech,
      files: schemaFiles.slice(0, 4).map(f => f.relativePath),
      isDetected: true
    });
  }

  // Redis implementation
  if (hasRedis) {
    systemLLD.push({
      id: 'lld-cache', number: mkNum(),
      label: 'DB Connection Pool & Node Cache',
      sublabel: 'Primary Datastore Pool · In-Memory Cache',
      tier: 'cache', zone: 'data',
      techKey: 'redis',
      files: [],
      isDetected: true
    });
  }

  // Runtime/config implementation
  const infraFiles = layers.Infrastructure || [];
  const foundationFiles = layers.Foundation || [];
  systemLLD.push({
    id: 'lld-runtime', number: mkNum(),
    label: 'Environment Variable Injector',
    sublabel: envVars.length > 0
      ? `${envVars.length} env vars: ${envVars.slice(0, 3).join(', ')}${envVars.length > 3 ? '...' : ''}`
      : 'Runtime config & secrets',
    tier: 'observability', zone: 'ops',
    techKey: 'node',
    files: fileList.filter(f => f.relativePath && (
      f.relativePath.includes('.env') ||
      f.relativePath.includes('config') ||
      f.relativePath.includes('constants')
    )).slice(0, 3).map(f => f.relativePath),
    isDetected: true
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CLOUD ARCHITECT — HLD
  // Only shows AWS/cloud services ACTUALLY DETECTED
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const cloudHLD = [];
  number = 1;

  // CloudFront CDN — only if detected
  if (hasAWSCloudFront || hasVercel) {
    cloudHLD.push({
      id: 'cdn', number: mkNum(),
      label: hasAWSCloudFront ? 'CloudFront CDN' : 'Vercel Edge Network',
      sublabel: 'Content Delivery Network',
      tier: 'edge', zone: 'cloud',
      techKey: hasAWSCloudFront ? 'aws-cloudfront' : 'vercel',
      files: [],
      isDetected: true
    });
  }

  // API Gateway — only if detected OR has Express/NestJS
  if (hasAWSAPIGateway) {
    cloudHLD.push({
      id: 'cloud-gw', number: mkNum(),
      label: 'AWS API Gateway',
      sublabel: 'REST / WebSocket API',
      tier: 'gateway', zone: 'cloud',
      techKey: 'aws-apigateway',
      files: getLayerFiles('Gateway'),
      isDetected: true
    });
  } else if (hasExpress || hasNestJS || hasFastify || hasNextJS) {
    cloudHLD.push({
      id: 'cloud-gw', number: mkNum(),
      label: apiName,
      sublabel: `API Server · ${(layers.Gateway || []).length} routes`,
      tier: 'gateway', zone: 'cloud',
      techKey: apiTech,
      files: getLayerFiles('Gateway'),
      isDetected: true
    });
  }

  // Lambda — only if detected
  if (hasAWSLambda) {
    cloudHLD.push({
      id: 'lambda', number: mkNum(),
      label: 'AWS Lambda',
      sublabel: 'Serverless Functions',
      tier: 'service', zone: 'cloud',
      techKey: 'aws-lambda',
      files: fileList.filter(f => f.relativePath && f.relativePath.includes('lambda')).slice(0, 3).map(f => f.relativePath),
      isDetected: true
    });
  }

  // ECS/EKS — only if detected
  if (hasAWSECS) {
    cloudHLD.push({
      id: 'ecs', number: mkNum(),
      label: 'AWS ECS',
      sublabel: 'Container Orchestration',
      tier: 'service', zone: 'cloud',
      techKey: 'aws-ecs',
      files: [],
      isDetected: true
    });
  }

  if (hasAWSEKS || hasKubernetes) {
    cloudHLD.push({
      id: 'eks', number: mkNum(),
      label: hasAWSEKS ? 'AWS EKS' : 'Kubernetes',
      sublabel: 'Container Orchestration',
      tier: 'service', zone: 'cloud',
      techKey: hasAWSEKS ? 'aws-eks' : 'kubernetes',
      files: [],
      isDetected: true
    });
  }

  // EC2 — only if detected
  if (hasAWSEC2) {
    cloudHLD.push({
      id: 'ec2', number: mkNum(),
      label: 'AWS EC2',
      sublabel: 'Virtual Machines',
      tier: 'service', zone: 'cloud',
      techKey: 'aws-ec2',
      files: [],
      isDetected: true
    });
  }

  // S3 — only if detected
  if (hasAWSS3) {
    cloudHLD.push({
      id: 's3', number: mkNum(),
      label: 'AWS S3',
      sublabel: 'Object Storage',
      tier: 'cloud', zone: 'cloud',
      techKey: 'aws-s3',
      files: fileList.filter(f => f.relativePath && f.relativePath.includes('s3')).slice(0, 2).map(f => f.relativePath),
      isDetected: true
    });
  }

  // SQS — only if detected
  if (hasAWSSQS) {
    cloudHLD.push({
      id: 'sqs', number: mkNum(),
      label: 'AWS SQS',
      sublabel: 'Message Queue',
      tier: 'queue', zone: 'cloud',
      techKey: 'aws-sqs',
      files: fileList.filter(f => f.relativePath && f.relativePath.includes('queue')).slice(0, 2).map(f => f.relativePath),
      isDetected: true
    });
  }

  // SNS — only if detected
  if (hasAWSSNS) {
    cloudHLD.push({
      id: 'sns', number: mkNum(),
      label: 'AWS SNS',
      sublabel: 'Push Notifications',
      tier: 'queue', zone: 'cloud',
      techKey: 'aws-sns',
      files: [],
      isDetected: true
    });
  }

  // SES — only if detected
  if (hasAWSSES) {
    cloudHLD.push({
      id: 'ses', number: mkNum(),
      label: 'AWS SES',
      sublabel: 'Email Service',
      tier: 'cloud', zone: 'cloud',
      techKey: 'aws-ses',
      files: [],
      isDetected: true
    });
  }

  // Cognito — only if detected
  if (hasAWSCognito) {
    cloudHLD.push({
      id: 'cognito', number: mkNum(),
      label: 'AWS Cognito',
      sublabel: 'User Pools & Identity',
      tier: 'service', zone: 'cloud',
      techKey: 'aws-cognito',
      files: [],
      isDetected: true
    });
  }

  // RDS — only if detected
  if (hasAWSRDS) {
    cloudHLD.push({
      id: 'rds', number: mkNum(),
      label: 'AWS RDS',
      sublabel: dbName ? `${dbName} on RDS` : 'Managed Database',
      tier: 'data', zone: 'cloud',
      techKey: 'aws-rds',
      files: [],
      isDetected: true
    });
  } else if (dbTech && hasAny_AWS) {
    // Project has AWS + a DB — show the actual DB
    cloudHLD.push({
      id: 'cloud-db', number: mkNum(),
      label: dbName,
      sublabel: dbORM.trim() || 'Primary Database',
      tier: 'data', zone: 'cloud',
      techKey: dbTech,
      files: schemaFiles.slice(0, 3).map(f => f.relativePath),
      isDetected: true
    });
  }

  // DynamoDB — only if detected
  if (hasAWSDynamoDB) {
    cloudHLD.push({
      id: 'dynamo', number: mkNum(),
      label: 'AWS DynamoDB',
      sublabel: 'NoSQL Key-Value Store',
      tier: 'data', zone: 'cloud',
      techKey: 'aws-dynamo',
      files: [],
      isDetected: true
    });
  }

  // ElastiCache — only if detected
  if (hasAWSElastiCache) {
    cloudHLD.push({
      id: 'elasticache', number: mkNum(),
      label: 'ElastiCache',
      sublabel: 'Redis · Managed Cache',
      tier: 'cache', zone: 'cloud',
      techKey: 'aws-elasticache',
      files: [],
      isDetected: true
    });
  } else if (hasRedis) {
    cloudHLD.push({
      id: 'cloud-cache', number: mkNum(),
      label: 'Redis Cache',
      sublabel: 'In-memory cache',
      tier: 'cache', zone: 'cloud',
      techKey: 'redis',
      files: [],
      isDetected: true
    });
  }

  // If NO cloud services detected at all, show a fallback non-cloud view
  if (cloudHLD.length === 0) {
    cloudHLD.push({
      id: 'no-cloud', number: 1,
      label: 'No Cloud Services Detected',
      sublabel: 'This project uses local/self-hosted infrastructure',
      tier: 'service', zone: 'backend',
      techKey: apiTech || 'node',
      files: [],
      isDetected: false
    });
    if (dbTech) {
      cloudHLD.push({
        id: 'local-db', number: 2,
        label: dbName,
        sublabel: 'Self-hosted database',
        tier: 'data', zone: 'data',
        techKey: dbTech,
        files: [],
        isDetected: true
      });
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CLOUD — LLD
  // Real AWS implementation details
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const cloudLLD = [];
  number = 1;

  if (hasAWSS3) {
    cloudLLD.push({
      id: 'lld-s3', number: mkNum(),
      label: 'S3 Bucket Configuration',
      sublabel: 'Object storage · Versioning · Lifecycle policies',
      tier: 'cloud', zone: 'cloud',
      techKey: 'aws-s3',
      files: fileList.filter(f => f.relativePath && (f.relativePath.includes('s3') || f.relativePath.includes('storage'))).slice(0, 3).map(f => f.relativePath),
      isDetected: true
    });
  }

  if (hasAWSLambda) {
    cloudLLD.push({
      id: 'lld-lambda', number: mkNum(),
      label: 'Lambda Function Handlers',
      sublabel: 'Serverless · Event-driven · Cold start optimized',
      tier: 'service', zone: 'cloud',
      techKey: 'aws-lambda',
      files: fileList.filter(f => f.relativePath && (f.relativePath.includes('lambda') || f.relativePath.includes('handler') || f.relativePath.includes('function'))).slice(0, 3).map(f => f.relativePath),
      isDetected: true
    });
  }

  if (hasAWSSQS) {
    cloudLLD.push({
      id: 'lld-sqs', number: mkNum(),
      label: 'SQS Queue Producer & Consumer',
      sublabel: 'Async message processing · DLQ configured',
      tier: 'queue', zone: 'cloud',
      techKey: 'aws-sqs',
      files: fileList.filter(f => f.relativePath && (f.relativePath.includes('queue') || f.relativePath.includes('sqs') || f.relativePath.includes('worker'))).slice(0, 3).map(f => f.relativePath),
      isDetected: true
    });
  }

  if (hasAWSSES) {
    cloudLLD.push({
      id: 'lld-ses', number: mkNum(),
      label: 'SES Email Templates & Sender',
      sublabel: 'Transactional email · Bounce handling',
      tier: 'cloud', zone: 'cloud',
      techKey: 'aws-ses',
      files: fileList.filter(f => f.relativePath && (f.relativePath.includes('email') || f.relativePath.includes('mail') || f.relativePath.includes('ses'))).slice(0, 3).map(f => f.relativePath),
      isDetected: true
    });
  }

  if (hasAWSDynamoDB) {
    cloudLLD.push({
      id: 'lld-dynamo', number: mkNum(),
      label: 'DynamoDB Table Design',
      sublabel: 'Partition key · Sort key · GSI indexes',
      tier: 'data', zone: 'cloud',
      techKey: 'aws-dynamo',
      files: fileList.filter(f => f.relativePath && (f.relativePath.includes('dynamo') || f.relativePath.includes('table'))).slice(0, 3).map(f => f.relativePath),
      isDetected: true
    });
  }

  if (hasAWSCognito) {
    cloudLLD.push({
      id: 'lld-cognito', number: mkNum(),
      label: 'Cognito User Pool Config',
      sublabel: 'User pools · App clients · Token validation',
      tier: 'service', zone: 'cloud',
      techKey: 'aws-cognito',
      files: [],
      isDetected: true
    });
  }

  if (hasAWSRDS) {
    cloudLLD.push({
      id: 'lld-rds', number: mkNum(),
      label: 'RDS Instance Configuration',
      sublabel: `${dbName || 'PostgreSQL'} · Multi-AZ · Read replicas`,
      tier: 'data', zone: 'cloud',
      techKey: 'aws-rds',
      files: schemaFiles.slice(0, 3).map(f => f.relativePath),
      isDetected: true
    });
  }

  if (hasAWSElastiCache) {
    cloudLLD.push({
      id: 'lld-elasticache', number: mkNum(),
      label: 'ElastiCache Cluster Config',
      sublabel: 'Redis · Replication group · TTL policies',
      tier: 'cache', zone: 'cloud',
      techKey: 'aws-elasticache',
      files: [],
      isDetected: true
    });
  }

  if (hasAWSAPIGateway) {
    cloudLLD.push({
      id: 'lld-apigw', number: mkNum(),
      label: 'API Gateway Routes & Stages',
      sublabel: `${(layers.Gateway || []).length} endpoints · Authorizers · Rate limiting`,
      tier: 'gateway', zone: 'cloud',
      techKey: 'aws-apigateway',
      files: getLayerFiles('Gateway'),
      isDetected: true
    });
  }

  if (hasAWSSNS) {
    cloudLLD.push({
      id: 'lld-sns', number: mkNum(),
      label: 'SNS Topic & Subscriptions',
      sublabel: 'Fan-out messaging · Filter policies',
      tier: 'queue', zone: 'cloud',
      techKey: 'aws-sns',
      files: [],
      isDetected: true
    });
  }

  // Fallback if no AWS services detected
  if (cloudLLD.length === 0 && systemLLD.length > 0) {
    cloudLLD.push(...systemLLD.map(c => ({
      ...c,
      id: 'cloud-' + c.id,
      sublabel: c.sublabel + ' · No AWS services detected'
    })));
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // DEVOPS ENGINEER — HLD
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const devopsHLD = [];
  number = 1;

  // Source control — always
  devopsHLD.push({
    id: 'git', number: mkNum(),
    label: 'Git Repository',
    sublabel: 'Source version control',
    tier: 'client', zone: 'devops',
    techKey: 'github',
    files: [],
    isDetected: true
  });

  // CI/CD
  if (hasGHA) {
    devopsHLD.push({
      id: 'cicd', number: mkNum(),
      label: 'GitHub Actions',
      sublabel: 'CI/CD Pipeline',
      tier: 'service', zone: 'devops',
      techKey: 'gha',
      files: fileList.filter(f => f.relativePath && f.relativePath.includes('.github')).slice(0, 3).map(f => f.relativePath),
      isDetected: true
    });
  }

  // Docker — only if detected
  if (hasDocker) {
    devopsHLD.push({
      id: 'docker', number: mkNum(),
      label: 'Docker',
      sublabel: 'Container Runtime',
      tier: 'service', zone: 'devops',
      techKey: 'docker',
      files: fileList.filter(f => f.relativePath && (
        f.relativePath.includes('Dockerfile') ||
        f.relativePath.includes('docker-compose')
      )).slice(0, 3).map(f => f.relativePath),
      isDetected: true
    });
  }

  // Kubernetes — only if detected
  if (hasKubernetes) {
    devopsHLD.push({
      id: 'k8s', number: mkNum(),
      label: hasAWSEKS ? 'AWS EKS' : 'Kubernetes',
      sublabel: 'Container Orchestration',
      tier: 'service', zone: 'devops',
      techKey: hasAWSEKS ? 'aws-eks' : 'kubernetes',
      files: fileList.filter(f => f.relativePath && (
        f.relativePath.includes('k8s') ||
        f.relativePath.includes('kubernetes') ||
        f.relativePath.endsWith('.yaml') || f.relativePath.endsWith('.yml')
      )).slice(0, 3).map(f => f.relativePath),
      isDetected: true
    });
  }

  // Testing — only if detected
  const testTech = hasJest ? 'jest' : hasVitest ? 'vitest' : hasPlaywright ? 'playwright' : hasCypress ? 'cypress' : null;
  const testName = hasJest ? 'Jest' : hasVitest ? 'Vitest' : hasPlaywright ? 'Playwright' : hasCypress ? 'Cypress' : null;

  if (testTech) {
    devopsHLD.push({
      id: 'testing', number: mkNum(),
      label: `${testName} Test Suite`,
      sublabel: `${(layers.Test || []).length} test files`,
      tier: 'service', zone: 'devops',
      techKey: testTech,
      files: getLayerFiles('Test'),
      isDetected: true
    });
  }

  // Hosting/Deploy target
  if (hasVercel) {
    devopsHLD.push({
      id: 'deploy', number: mkNum(),
      label: 'Vercel',
      sublabel: 'Edge deployment platform',
      tier: 'cloud', zone: 'devops',
      techKey: 'vercel',
      files: fileList.filter(f => f.relativePath && f.relativePath.includes('vercel')).slice(0, 2).map(f => f.relativePath),
      isDetected: true
    });
  } else if (hasAWSEC2 || hasAWSECS) {
    devopsHLD.push({
      id: 'deploy', number: mkNum(),
      label: hasAWSECS ? 'AWS ECS Deploy' : 'AWS EC2 Deploy',
      sublabel: 'Cloud deployment target',
      tier: 'cloud', zone: 'devops',
      techKey: hasAWSECS ? 'aws-ecs' : 'aws-ec2',
      files: [],
      isDetected: true
    });
  } else if (hasDocker) {
    devopsHLD.push({
      id: 'deploy', number: mkNum(),
      label: 'Container Registry',
      sublabel: 'Docker image deployment',
      tier: 'cloud', zone: 'devops',
      techKey: 'docker',
      files: [],
      isDetected: false
    });
  }

  // Turborepo — only if detected
  if (hasTurborepo) {
    devopsHLD.push({
      id: 'turbo', number: mkNum(),
      label: 'Turborepo',
      sublabel: 'Monorepo build system',
      tier: 'service', zone: 'devops',
      techKey: 'turborepo',
      files: [],
      isDetected: true
    });
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // DEVOPS — LLD
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const devopsLLD = [];
  number = 1;

  if (hasGHA) {
    const workflowFiles = fileList.filter(f => f.relativePath && f.relativePath.includes('.github/workflows'));
    devopsLLD.push({
      id: 'lld-workflows', number: mkNum(),
      label: 'CI/CD Workflow Definitions',
      sublabel: workflowFiles.length > 0
        ? workflowFiles.map(f => f.relativePath.split('/').pop()).join(', ')
        : 'GitHub Actions workflows',
      tier: 'service', zone: 'devops',
      techKey: 'gha',
      files: workflowFiles.slice(0, 4).map(f => f.relativePath),
      isDetected: true
    });
  }

  if (hasDocker) {
    const dockerFiles = fileList.filter(f => f.relativePath && (
      f.relativePath.includes('Dockerfile') || f.relativePath.includes('docker-compose')
    ));
    devopsLLD.push({
      id: 'lld-docker', number: mkNum(),
      label: 'Docker Image & Compose Config',
      sublabel: dockerFiles.length > 0
        ? dockerFiles.map(f => f.relativePath.split('/').pop()).join(', ')
        : 'Container configuration',
      tier: 'service', zone: 'devops',
      techKey: 'docker',
      files: dockerFiles.slice(0, 3).map(f => f.relativePath),
      isDetected: true
    });
  }

  if (testTech) {
    const testFiles = layers.Test || [];
    devopsLLD.push({
      id: 'lld-tests', number: mkNum(),
      label: `${testName} Test Specs & Config`,
      sublabel: `${testFiles.length} test files · Unit + Integration`,
      tier: 'service', zone: 'devops',
      techKey: testTech,
      files: getLayerFiles('Test'),
      isDetected: true
    });
  }

  const configFiles = fileList.filter(f => f.relativePath && (
    f.relativePath.includes('next.config') ||
    f.relativePath.includes('vite.config') ||
    f.relativePath.includes('tsconfig') ||
    f.relativePath.includes('eslint') ||
    f.relativePath.includes('.env.example')
  ));
  if (configFiles.length > 0) {
    devopsLLD.push({
      id: 'lld-config', number: mkNum(),
      label: 'Build & Lint Configuration',
      sublabel: configFiles.map(f => f.relativePath.split('/').pop()).slice(0, 3).join(', '),
      tier: 'service', zone: 'devops',
      techKey: frontendTech,
      files: configFiles.slice(0, 4).map(f => f.relativePath),
      isDetected: true
    });
  }

  // Env vars / secrets config
  if (envVars.length > 0) {
    devopsLLD.push({
      id: 'lld-env', number: mkNum(),
      label: 'Environment Variable Registry',
      sublabel: `${envVars.length} variables: ${envVars.slice(0, 4).join(', ')}${envVars.length > 4 ? '...' : ''}`,
      tier: 'observability', zone: 'ops',
      techKey: 'node',
      files: [],
      isDetected: true
    });
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // BUILD ZONES
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const zones = {
    frontend: { id: 'frontend', label: 'TIER 1 — FRONTEND & PRESENTATION', color: '#3b82f6' },
    backend: { id: 'backend', label: 'TIER 2 — API GATEWAY & AUTH', color: '#a855f7' },
    service: { id: 'service', label: 'TIER 3 — BUSINESS LOGIC & DOMAIN', color: '#22c55e' },
    data: { id: 'data', label: 'TIER 4 — DATA & PERSISTENCE', color: '#ef4444' },
    ops: { id: 'ops', label: 'TIER 5 — RUNTIME & OPERATIONS', color: '#f97316' },
    cloud: { id: 'cloud', label: 'CLOUD INFRASTRUCTURE', color: '#FF9900' },
    devops: { id: 'devops', label: 'DEVOPS PIPELINE', color: '#2088FF' },
  };

  // EXTERNAL SAAS INTEGRATIONS panel
  const externalSaaS = [];
  if (authTech && (hasAuth0 || hasClerk)) {
    externalSaaS.push({
      label: hasAuth0 ? 'Auth0' : 'Clerk',
      sublabel: `OAuth 2.0 · JWT`,
      techKey: authTech
    });
  }
  if (hasFirebase) externalSaaS.push({ label: 'Firebase', sublabel: 'Google BaaS', techKey: 'firebase' });
  if (hasSupabase) externalSaaS.push({ label: 'Supabase', sublabel: 'Open source BaaS', techKey: 'supabase' });

  // DB SCHEMA TABLES panel
  const dbTables = schemaFiles.map(f => f.relativePath.split('/').pop().replace('.prisma', '').replace('.ts', '').replace('.js', ''));

  return {
    perspectives: {
      system: { hld: systemHLD, lld: systemLLD },
      cloud: { hld: cloudHLD, lld: cloudLLD },
      devops: { hld: devopsHLD, lld: devopsLLD }
    },
    zones,
    externalSaaS,
    dbTables,
    metadata: {
      projectName: DATA?.project?.name || 'Project',
      hasAWS: hasAny_AWS,
      dbName,
      dbTech,
      authTech,
      authName,
      frontendTech,
      apiTech
    }
  };
}