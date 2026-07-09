export function detectLayers(files) {
  const infraNames = new Set([
    'next.config.js', 'next.config.ts', 'vite.config.ts', 'vite.config.js',
    'tailwind.config.js', 'tailwind.config.ts', 'jest.config.js', 'jest.config.ts',
    'webpack.config.js', '.eslintrc.js', '.eslintrc.json', 'docker-compose.yml', 'Dockerfile'
  ]);

  const persistenceImports = new Set([
    '@prisma/client', 'drizzle-orm', 'mongoose', 'typeorm', 'sequelize'
  ]);

  const interactionImports = new Set([
    'zustand', 'redux', 'jotai', 'recoil', '@tanstack/react-query', 'swr', '@reduxjs/toolkit'
  ]);

  return files.map(file => {
    let layer = 'Unknown';
    const rel = file.relativePath.toLowerCase();

    // 1. Test
    if (rel.includes('.test.') || rel.includes('.spec.') || rel.includes('__tests__') ||
        rel.includes('/test/') || rel.includes('/tests/') || rel.includes('/_tests_/')) {
      layer = 'Test';
    }
    // 2. Infrastructure
    else if (infraNames.has(file.name) || file.relativePath.startsWith('.github/')) {
      layer = 'Infrastructure';
    }
    // 3. Persistence
    else if (
      file.imports.some(imp => persistenceImports.has(imp.specifier) || Array.from(persistenceImports).some(p => imp.specifier.startsWith(p))) ||
      rel.includes('/models/') || rel.includes('/repositories/') || rel.includes('/migrations/') ||
      rel.includes('/db/') || rel.includes('/database/') || rel.includes('/prisma/') || rel.includes('/schemas/')
    ) {
      layer = 'Persistence';
    }
    // 4. Gateway
    else if (
      file.apiRoute === true ||
      rel.includes('/api/') || rel.includes('/controllers/') || rel.includes('/handlers/') ||
      rel.includes('/routes/') || rel.includes('/resolvers/') || rel.includes('/graphql/')
    ) {
      layer = 'Gateway';
    }
    // 5. Domain
    else if (
      rel.includes('/services/') || rel.includes('/domain/') || rel.includes('/usecases/') ||
      rel.includes('/use-cases/') || rel.includes('/business/') || rel.includes('/core/')
    ) {
      layer = 'Domain';
    }
    // 6. Interaction
    else if (
      file.exports.some(exp => exp.kind === 'function' && /^use[A-Z]/.test(exp.name)) ||
      file.imports.some(imp => interactionImports.has(imp.specifier) || Array.from(interactionImports).some(i => imp.specifier.startsWith(i)))
    ) {
      layer = 'Interaction';
    }
    // 7. Presentation
    else if (
      file.extension === '.tsx' || file.extension === '.jsx' ||
      rel.includes('/pages/') || rel.includes('/app/') || rel.includes('/views/') ||
      rel.includes('/screens/') || rel.includes('/components/') || rel.includes('/ui/')
    ) {
      layer = 'Presentation';
    }
    // 8. Foundation
    else if (
      rel.includes('/lib/') || rel.includes('/utils/') || rel.includes('/helpers/') ||
      rel.includes('/shared/') || rel.includes('/common/') || rel.includes('/constants/') ||
      rel.includes('/types/') || rel.includes('/config/')
    ) {
      layer = 'Foundation';
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
