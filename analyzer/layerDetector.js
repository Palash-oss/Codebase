export function detectLayers(files) {
  const infraNames = new Set([
    'next.config.js', 'next.config.ts', 'vite.config.ts', 'vite.config.js',
    'tailwind.config.js', 'tailwind.config.ts', 'jest.config.js', 'jest.config.ts',
    'webpack.config.js', '.eslintrc.js', '.eslintrc.json', 'docker-compose.yml', 'Dockerfile'
  ]);

  const persistenceImports = new Set([
    '@prisma/client', 'drizzle-orm', 'mongoose', 'typeorm', 'sequelize',
    'sqlalchemy', 'pymongo', 'psycopg2', 'databases', 'tortoise',
    'peewee', 'django.db', 'prisma'
  ]);

  const interactionImports = new Set([
    'zustand', 'redux', 'jotai', 'recoil', '@tanstack/react-query', 'swr', '@reduxjs/toolkit'
  ]);

  // Detect if this is a Python project (for smarter /app/ handling)
  const hasPythonFiles = files.some(f => f.extension === '.py');

  return files.map(file => {
    let layer = 'Unknown';
    const rel = file.relativePath.toLowerCase().replace(/\\/g, '/');
    const isPyFile = file.extension === '.py';

    // 1. Test
    if (rel.includes('.test.') || rel.includes('.spec.') || rel.includes('__tests__') ||
        rel.includes('/test/') || rel.includes('/tests/') || rel.includes('/_tests_/') ||
        (isPyFile && (file.name.startsWith('test_') || rel.includes('/conftest')))) {
      layer = 'Test';
    }
    // 2. Infrastructure (config files, CI/CD, env, Docker)
    else if (
      infraNames.has(file.name) ||
      file.relativePath.startsWith('.github/') ||
      ['.json', '.yml', '.yaml', '.toml', '.gitignore', '.env', '.example'].includes(file.extension) ||
      file.name.toLowerCase().startsWith('.env') ||
      file.name.toLowerCase().endsWith('config.mjs') ||
      file.name.toLowerCase().endsWith('config.js') ||
      file.name === 'Dockerfile' || file.name === 'docker-compose.yml' ||
      file.name === 'Makefile' || file.name === 'Procfile' ||
      rel.includes('/infrastructure/') || rel.includes('/deploy/') ||
      (isPyFile && (rel.includes('/db/session') || rel.includes('/db/base') || rel.includes('/db/init')))
    ) {
      layer = 'Infrastructure';
    }
    // 3. Gateway (API routes, controllers, handlers)
    else if (
      file.apiRoute === true ||
      rel.includes('/api/') || rel.includes('/controllers/') || rel.includes('/handlers/') ||
      rel.includes('/routes/') || rel.includes('/resolvers/') || rel.includes('/graphql/') ||
      (isPyFile && (rel.includes('/routers/') || rel.includes('/endpoints/') || rel.includes('/views/')))
    ) {
      layer = 'Gateway';
    }
    // 4. Persistence (DB models, schemas, migrations) — BEFORE Presentation
    else if (
      file.imports.some(imp => {
        const spec = (imp?.specifier || '').toLowerCase();
        return Array.from(persistenceImports).some(p => spec.includes(p));
      }) ||
      rel.includes('/models/') || rel.includes('/repositories/') || rel.includes('/migrations/') ||
      rel.includes('/db/') || rel.includes('/database/') || rel.includes('/prisma/') || rel.includes('/schemas/') ||
      rel.includes('/entities/') || rel.includes('/orm/') ||
      ['.prisma', '.sql'].includes(file.extension) ||
      (isPyFile && (file.name.includes('model') || file.name.includes('schema') || file.name.includes('entity')))
    ) {
      layer = 'Persistence';
    }
    // 5. Domain (business logic, services, use cases) — BEFORE Presentation
    else if (
      rel.includes('/services/') || rel.includes('/domain/') || rel.includes('/usecases/') ||
      rel.includes('/use-cases/') || rel.includes('/business/') ||
      (isPyFile && (rel.includes('/core/') || rel.includes('/tasks/') || rel.includes('/workers/') || rel.includes('/agents/')))
    ) {
      layer = 'Domain';
    }
    // 6. Foundation (utils, helpers, shared, config, constants)
    else if (
      rel.includes('/lib/') || rel.includes('/utils/') || rel.includes('/helpers/') ||
      rel.includes('/shared/') || rel.includes('/common/') || rel.includes('/constants/') ||
      rel.includes('/types/') || rel.includes('/config/') ||
      file.extension === '.md'
    ) {
      layer = 'Foundation';
    }
    // 7. Presentation (UI components — only for JS/TS frontend files, not Python backend)
    else if (
      (file.extension === '.tsx' || file.extension === '.jsx') ||
      (!isPyFile && (
        rel.includes('/pages/') || rel.includes('/views/') ||
        rel.includes('/screens/') || rel.includes('/components/') || rel.includes('/ui/')
      )) ||
      // Only match /app/ for non-Python files in non-mixed projects (Next.js app router)
      (!hasPythonFiles && rel.includes('/app/')) ||
      // For mixed projects: only match /app/ if clearly frontend path
      (hasPythonFiles && !isPyFile && rel.includes('/app/') && (rel.startsWith('frontend/') || rel.startsWith('src/') || rel.includes('/src/')))
    ) {
      layer = 'Presentation';
    }
    // 8. Interaction (React hooks, state management)
    else if (
      file.exports.some(exp => exp.kind === 'function' && /^use[A-Z]/.test(exp.name)) ||
      file.imports.some(imp => interactionImports.has(imp.specifier) || Array.from(interactionImports).some(i => imp.specifier.startsWith(i)))
    ) {
      layer = 'Interaction';
    }
    // 9. Unknown
    else {
      layer = 'Unknown';
    }

    return {
      ...file,
      layer
    };
  });
}

