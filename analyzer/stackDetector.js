import fs from 'fs';
import path from 'path';

export function detectStack(packageJson, files) {
  const deps = {
    ...(packageJson.dependencies || {}),
    ...(packageJson.devDependencies || {})
  };
  
  const allContent = files.map(f => f.content).join('\n');
  
  // Find projectRoot from files
  let projectRoot = '';
  if (files.length > 0) {
    // Traverse up to find root
    // Let's assume the parent of the relative path is the root
    const firstFile = files[0];
    const absoluteDir = path.dirname(firstFile.path);
    const relDir = firstFile.directory;
    if (relDir === '' || relDir === '.') {
      projectRoot = absoluteDir;
    } else {
      // split and resolve
      projectRoot = path.resolve(absoluteDir, '..'.repeat(relDir.split('/').length));
    }
  }

  const techDefs = [
    // Frameworks
    { key: 'nextjs', name: 'Next.js', logoKey: 'nextjs', brandColor: '#ffffff', category: 'framework', test: () => !!deps['next'] },
    { key: 'react', name: 'React', logoKey: 'react', brandColor: '#61DAFB', category: 'framework', test: () => !!deps['react'] && !deps['next'] },
    { key: 'vuejs', name: 'Vue.js', logoKey: 'vuejs', brandColor: '#42B883', category: 'framework', test: () => !!deps['vue'] },
    { key: 'express', name: 'Express', logoKey: 'express', brandColor: '#ffffff', category: 'framework', test: () => !!deps['express'] },
    { key: 'nestjs', name: 'NestJS', logoKey: 'nestjs', brandColor: '#E0234E', category: 'framework', test: () => !!deps['@nestjs/core'] },
    { key: 'fastify', name: 'Fastify', logoKey: 'fastify', brandColor: '#ffffff', category: 'framework', test: () => !!deps['fastify'] },
    { key: 'vitejs', name: 'Vite', logoKey: 'vitejs', brandColor: '#646CFF', category: 'framework', test: () => !!deps['vite'] },

    // Databases
    { key: 'prisma', name: 'Prisma', logoKey: 'inline-prisma', brandColor: '#5A67D8', category: 'database', test: () => !!deps['@prisma/client'] },
    { key: 'drizzle', name: 'Drizzle ORM', logoKey: 'inline-drizzle', brandColor: '#C5F74F', category: 'database', test: () => !!deps['drizzle-orm'] },
    { key: 'mongoose', name: 'MongoDB', logoKey: 'mongodb', brandColor: '#47A248', category: 'database', test: () => !!deps['mongoose'] },
    { key: 'typeorm', name: 'TypeORM', logoKey: 'inline-typeorm', brandColor: '#E83524', category: 'database', test: () => !!deps['typeorm'] },
    { key: 'postgresql', name: 'PostgreSQL', logoKey: 'postgresql', brandColor: '#4169E1', category: 'database', test: () => !!deps['pg'] || !!deps['postgres'] },
    { key: 'mysql', name: 'MySQL', logoKey: 'mysql', brandColor: '#4479A1', category: 'database', test: () => !!deps['mysql2'] },
    { key: 'redis', name: 'Redis', logoKey: 'redis', brandColor: '#DC382D', category: 'database', test: () => !!deps['redis'] || !!deps['ioredis'] },
    { key: 'sqlite', name: 'SQLite', logoKey: 'sqlite', brandColor: '#003B57', category: 'database', test: () => !!deps['better-sqlite3'] || !!deps['sqlite3'] },

    // Auth
    { key: 'nextauth', name: 'NextAuth.js', logoKey: 'inline-nextauth', brandColor: '#7c3aed', category: 'auth', test: () => !!deps['next-auth'] },
    { key: 'auth0', name: 'Auth0', logoKey: 'inline-auth0', brandColor: '#EB5424', category: 'auth', test: () => !!deps['@auth0/nextjs-auth0'] || !!deps['@auth0/auth0-react'] },
    { key: 'clerk', name: 'Clerk', logoKey: 'inline-clerk', brandColor: '#6C47FF', category: 'auth', test: () => !!deps['@clerk/nextjs'] || !!deps['@clerk/clerk-react'] || !!deps['@clerk/clerk-sdk-node'] },
    { key: 'jwt', name: 'JWT', logoKey: 'inline-jwt', brandColor: '#d63aff', category: 'auth', test: () => !!deps['jsonwebtoken'] },

    // Cloud
    { key: 'aws-s3', name: 'AWS S3', logoKey: 'inline-aws', brandColor: '#FF9900', category: 'cloud', service: 'S3', test: () => allContent.includes('@aws-sdk/client-s3') },
    { key: 'aws-lambda', name: 'AWS Lambda', logoKey: 'inline-aws', brandColor: '#FF9900', category: 'cloud', service: 'Lambda', test: () => allContent.includes('@aws-sdk/client-lambda') },
    { key: 'aws-dynamo', name: 'AWS DynamoDB', logoKey: 'inline-aws', brandColor: '#FF9900', category: 'cloud', service: 'DynamoDB', test: () => allContent.includes('@aws-sdk/client-dynamodb') },
    { key: 'aws-sqs', name: 'AWS SQS', logoKey: 'inline-aws', brandColor: '#FF9900', category: 'cloud', service: 'SQS', test: () => allContent.includes('@aws-sdk/client-sqs') },
    { key: 'aws-ses', name: 'AWS SES', logoKey: 'inline-aws', brandColor: '#FF9900', category: 'cloud', service: 'SES', test: () => allContent.includes('@aws-sdk/client-ses') },
    { key: 'aws-ec2', name: 'AWS EC2', logoKey: 'inline-aws', brandColor: '#FF9900', category: 'cloud', service: 'EC2', test: () => allContent.includes('@aws-sdk/client-ec2') },
    { key: 'supabase', name: 'Supabase', logoKey: 'inline-supabase', brandColor: '#3FCF8E', category: 'cloud', test: () => !!deps['@supabase/supabase-js'] },
    { key: 'firebase', name: 'Firebase', logoKey: 'firebase', brandColor: '#FFCA28', category: 'cloud', test: () => !!deps['firebase'] || !!deps['firebase-admin'] },
    { key: 'vercel', name: 'Vercel', logoKey: 'inline-vercel', brandColor: '#ffffff', category: 'cloud', test: () => allContent.includes('@vercel/') || !!deps['@vercel/analytics'] || !!deps['@vercel/speed-insights'] },

    // UI
    { key: 'tailwind', name: 'Tailwind CSS', logoKey: 'tailwindcss', brandColor: '#38BDF8', category: 'ui', test: () => !!deps['tailwindcss'] },
    { key: 'mui', name: 'Material UI', logoKey: 'materialui', brandColor: '#007FFF', category: 'ui', test: () => !!deps['@mui/material'] },
    { key: 'chakra', name: 'Chakra UI', logoKey: 'inline-chakra', brandColor: '#319795', category: 'ui', test: () => !!deps['@chakra-ui/react'] },
    { key: 'framer', name: 'Framer Motion', logoKey: 'inline-framer', brandColor: '#0055FF', category: 'ui', test: () => !!deps['framer-motion'] },

    // Testing
    { key: 'jest', name: 'Jest', logoKey: 'jest', brandColor: '#C21325', category: 'testing', test: () => !!deps['jest'] },
    { key: 'vitest', name: 'Vitest', logoKey: 'vitejs', brandColor: '#6E9F18', category: 'testing', test: () => !!deps['vitest'] },
    { key: 'playwright', name: 'Playwright', logoKey: 'inline-playwright', brandColor: '#2EAD33', category: 'testing', test: () => !!deps['@playwright/test'] },

    // DevOps
    {
      key: 'docker',
      name: 'Docker',
      logoKey: 'docker',
      brandColor: '#2496ED',
      category: 'devops',
      test: () => {
        if (!projectRoot) return false;
        try {
          return fs.existsSync(path.join(projectRoot, 'Dockerfile'));
        } catch {
          return false;
        }
      }
    },
    {
      key: 'gha',
      name: 'GitHub Actions',
      logoKey: 'github',
      brandColor: '#2088FF',
      category: 'devops',
      test: () => {
        if (!projectRoot) return false;
        try {
          return fs.existsSync(path.join(projectRoot, '.github', 'workflows'));
        } catch {
          return false;
        }
      }
    },
    { key: 'turborepo', name: 'Turborepo', logoKey: 'inline-turborepo', brandColor: '#EF4444', category: 'devops', test: () => !!deps['turbo'] },

    // State
    { key: 'zustand', name: 'Zustand', logoKey: 'inline-zustand', brandColor: '#443E38', category: 'state', test: () => !!deps['zustand'] },
    { key: 'redux', name: 'Redux', logoKey: 'redux', brandColor: '#764ABC', category: 'state', test: () => !!deps['@reduxjs/toolkit'] || !!deps['redux'] }
  ];

  const detected = [];
  const categories = {
    framework: [],
    database: [],
    auth: [],
    cloud: [],
    ui: [],
    testing: [],
    devops: [],
    state: []
  };

  for (const tech of techDefs) {
    if (tech.test()) {
      const item = {
        key: tech.key,
        name: tech.name,
        version: deps[tech.key] || deps[tech.name.toLowerCase()] || 'unknown',
        category: tech.category,
        logoKey: tech.logoKey,
        brandColor: tech.brandColor,
        detected: true
      };
      if (tech.service) {
        item.service = tech.service;
      }
      detected.push(item);
      categories[tech.category].push(item);
    }
  }

  return { detected, categories };
}
