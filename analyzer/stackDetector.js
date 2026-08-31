import fs from 'fs';
import path from 'path';

function hasDep(deps, key) {
  return !!deps[key];
}

function matchAny(str, needles) {
  const s = (str || '').toLowerCase();
  return needles.some(n => n && s.includes(n.toLowerCase()));
}

export function detectStack(packageJson, files) {
  const deps = {};
  // ── JavaScript / Node package detection (package.json) ─────────────────
  if (files) {
    for (const f of files) {
      if (f.name === 'package.json' && typeof f.content === 'string') {
        try {
          const pkg = JSON.parse(f.content);
          Object.assign(deps, pkg.dependencies || {});
          Object.assign(deps, pkg.devDependencies || {});
        } catch (e) {
          console.warn('[X-RAY] Failed to parse package.json content:', e.message);
        }
      }
    }
  }

  if (Object.keys(deps).length === 0) {
    Object.assign(deps, packageJson.dependencies || {});
    Object.assign(deps, packageJson.devDependencies || {});
  }

  // ── Python package detection (requirements.txt, Pipfile, pyproject.toml) ──
  // Normalise a Python package name to a lowercase key without version specifiers
  const pyDeps = new Set();
  if (files) {
    for (const f of files) {
      const fName = (f.name || '').toLowerCase();
      const content = f.content || '';

      // requirements.txt  /  requirements-dev.txt  /  requirements/*.txt
      if (fName === 'requirements.txt' || fName.startsWith('requirements') && fName.endsWith('.txt')) {
        content.split('\n').forEach(line => {
          const pkg = line.trim().split(/[>=<!;#\s]/)[0].toLowerCase().replace(/-/g, '_');
          if (pkg) pyDeps.add(pkg);
        });
      }

      // Pipfile — [packages] section
      if (fName === 'pipfile') {
        let inPackages = false;
        content.split('\n').forEach(line => {
          if (/^\[packages\]/i.test(line)) { inPackages = true; return; }
          if (/^\[/.test(line)) { inPackages = false; return; }
          if (inPackages) {
            const m = line.match(/^([a-z0-9_-]+)/i);
            if (m) pyDeps.add(m[1].toLowerCase().replace(/-/g, '_'));
          }
        });
      }

      // pyproject.toml — [tool.poetry.dependencies] or [project] dependencies
      if (fName === 'pyproject.toml') {
        content.split('\n').forEach(line => {
          const m = line.match(/^([a-z0-9_-]+)\s*=/i);
          if (m && m[1].toLowerCase() !== 'python') pyDeps.add(m[1].toLowerCase().replace(/-/g, '_'));
        });
      }

      // Python source files — extract "import X" / "from X import" statements
      if ((f.extension === '.py' || fName.endsWith('.py')) && content) {
        const importRx = /^(?:import|from)\s+([a-z0-9_]+)/gim;
        let m;
        while ((m = importRx.exec(content)) !== null) {
          pyDeps.add(m[1].toLowerCase());
        }
      }
    }
  }

  const allImports = new Set();
  const fileNames = new Set();
  const filePaths = new Set();

  if (files) {
    for (const f of files) {
      if (f.name) fileNames.add(f.name.toLowerCase());
      if (f.relativePath) filePaths.add(f.relativePath.toLowerCase().replace(/\\/g, '/'));
      if (f.imports) {
        for (const imp of f.imports) {
          if (imp.specifier) {
            allImports.add(imp.specifier);
            const parts = imp.specifier.split('/');
            if (parts.length > 0) {
              if (parts[0].startsWith('@')) {
                allImports.add(parts.slice(0, 2).join('/'));
                allImports.add(parts[0]);
              } else {
                allImports.add(parts[0]);
              }
            }
          }
        }
      }
    }
  }

  const techDefs = [
    // ------------ Frameworks / runtime ------------
    { key: 'nextjs', name: 'Next.js', logoKey: 'nextjs', brandColor: '#ffffff', category: 'framework', test: () => hasDep(deps, 'next') || hasDep(deps, 'nextjs') || allImports.has('next') || Array.from(fileNames).some(n => n.includes('next.config')) },
    { key: 'react', name: 'React', logoKey: 'react', brandColor: '#61DAFB', category: 'framework', test: () => hasDep(deps, 'react') || hasDep(deps, 'react-dom') || allImports.has('react') },
    { key: 'vuejs', name: 'Vue.js', logoKey: 'vuejs', brandColor: '#42B883', category: 'framework', test: () => hasDep(deps, 'vue') || allImports.has('vue') },
    { key: 'svelte', name: 'Svelte', logoKey: 'svelte', brandColor: '#FF3E00', category: 'framework', test: () => hasDep(deps, 'svelte') || allImports.has('svelte') },
    { key: 'angular', name: 'Angular', logoKey: 'angular', brandColor: '#DD0031', category: 'framework', test: () => hasDep(deps, '@angular/core') || hasDep(deps, '@angular/cli') || allImports.has('@angular/core') },

    // Backend frameworks / HTTP servers — Node.js
    { key: 'express', name: 'Express', logoKey: 'express', brandColor: '#ffffff', category: 'framework', test: () => hasDep(deps, 'express') || allImports.has('express') },
    { key: 'fastify', name: 'Fastify', logoKey: 'fastify', brandColor: '#ffffff', category: 'framework', test: () => hasDep(deps, 'fastify') || allImports.has('fastify') },
    { key: 'koa', name: 'Koa', logoKey: 'koa', brandColor: '#1e9dff', category: 'framework', test: () => hasDep(deps, 'koa') || allImports.has('koa') },
    { key: 'nestjs', name: 'NestJS', logoKey: 'nestjs', brandColor: '#E0234E', category: 'framework', test: () => hasDep(deps, '@nestjs/core') || allImports.has('@nestjs/core') },
    { key: 'hono', name: 'Hono', logoKey: 'hono', brandColor: '#E36002', category: 'framework', test: () => hasDep(deps, 'hono') || allImports.has('hono') },

    // ── Python backend frameworks ──────────────────────────────────────────
    { key: 'flask', name: 'Flask', logoKey: 'flask', brandColor: '#000000', category: 'framework',
      test: () => pyDeps.has('flask') || pyDeps.has('flask_restful') || pyDeps.has('flask_cors') || pyDeps.has('flask_sqlalchemy') || Array.from(fileNames).some(n => n === 'app.py' || n === 'run.py') && pyDeps.size > 0 },
    { key: 'fastapi', name: 'FastAPI', logoKey: 'fastapi', brandColor: '#009688', category: 'framework',
      test: () => pyDeps.has('fastapi') || pyDeps.has('uvicorn') },
    { key: 'django', name: 'Django', logoKey: 'django', brandColor: '#0C4B33', category: 'framework',
      test: () => pyDeps.has('django') || pyDeps.has('djangorestframework') || Array.from(fileNames).some(n => n === 'manage.py') },
    { key: 'python', name: 'Python', logoKey: 'python', brandColor: '#3776AB', category: 'framework',
      test: () => pyDeps.size > 0 || Array.from(filePaths).some(p => p.endsWith('.py')) },

    // ── Python AI / ML / LLM ──────────────────────────────────────────────
    { key: 'langchain', name: 'LangChain', logoKey: 'langchain', brandColor: '#1C3C3C', category: 'cloud',
      test: () => hasDep(deps, 'langchain') || hasDep(deps, '@langchain/core') || allImports.has('langchain') || allImports.has('@langchain/core') || pyDeps.has('langchain') || pyDeps.has('langchain_core') || pyDeps.has('langchain_community') || pyDeps.has('langchain_openai') || pyDeps.has('langchain_anthropic') },
    { key: 'openai', name: 'OpenAI', logoKey: 'openai', brandColor: '#412991', category: 'cloud',
      test: () => hasDep(deps, 'openai') || allImports.has('openai') || pyDeps.has('openai') },
    { key: 'anthropic', name: 'Anthropic Claude', logoKey: 'anthropic', brandColor: '#D97757', category: 'cloud',
      test: () => hasDep(deps, '@anthropic-ai/sdk') || hasDep(deps, 'anthropic') || allImports.has('@anthropic-ai/sdk') || pyDeps.has('anthropic') },
    { key: 'groq', name: 'Groq', logoKey: 'groq', brandColor: '#F55036', category: 'cloud',
      test: () => hasDep(deps, 'groq-sdk') || hasDep(deps, 'groq') || allImports.has('groq-sdk') || pyDeps.has('groq') },
    { key: 'huggingface', name: 'HuggingFace', logoKey: 'huggingface', brandColor: '#FF9D00', category: 'cloud',
      test: () => pyDeps.has('transformers') || pyDeps.has('sentence_transformers') || pyDeps.has('huggingface_hub') || pyDeps.has('datasets') || pyDeps.has('diffusers') },
    { key: 'pinecone', name: 'Pinecone', logoKey: 'pinecone', brandColor: '#5C4EFF', category: 'database',
      test: () => hasDep(deps, '@pinecone-database/pinecone') || hasDep(deps, 'pinecone') || allImports.has('@pinecone-database/pinecone') || allImports.has('pinecone') || pyDeps.has('pinecone') || pyDeps.has('pinecone_client') },
    { key: 'chromadb', name: 'ChromaDB', logoKey: 'chromadb', brandColor: '#F97316', category: 'database',
      test: () => pyDeps.has('chromadb') || pyDeps.has('chroma') },
    { key: 'weaviate', name: 'Weaviate', logoKey: 'weaviate', brandColor: '#FA5252', category: 'database',
      test: () => pyDeps.has('weaviate_client') || pyDeps.has('weaviate') },
    { key: 'qdrant', name: 'Qdrant', logoKey: 'qdrant', brandColor: '#EF4444', category: 'database',
      test: () => pyDeps.has('qdrant_client') },

    // ── Python data / ORM ────────────────────────────────────────────────
    { key: 'sqlalchemy', name: 'SQLAlchemy', logoKey: 'sqlalchemy', brandColor: '#D71F1F', category: 'database',
      test: () => pyDeps.has('sqlalchemy') || pyDeps.has('flask_sqlalchemy') },
    { key: 'pymongo', name: 'PyMongo / MongoDB', logoKey: 'mongodb', brandColor: '#47A248', category: 'database',
      test: () => pyDeps.has('pymongo') || pyDeps.has('motor') },
    { key: 'psycopg2', name: 'PostgreSQL (psycopg2)', logoKey: 'postgresql', brandColor: '#4169E1', category: 'database',
      test: () => pyDeps.has('psycopg2') || pyDeps.has('psycopg2_binary') || pyDeps.has('asyncpg') },
    { key: 'redis-py', name: 'Redis (Python)', logoKey: 'redis', brandColor: '#DC382D', category: 'database',
      test: () => pyDeps.has('redis') && pyDeps.size > 0 },

    // ── Python async / task queues ────────────────────────────────────────
    { key: 'celery', name: 'Celery', logoKey: 'celery', brandColor: '#37B24D', category: 'queue',
      test: () => pyDeps.has('celery') },

    // Bundler / build tool
    { key: 'vitejs', name: 'Vite', logoKey: 'vitejs', brandColor: '#646CFF', category: 'framework', test: () => hasDep(deps, 'vite') || allImports.has('vite') || Array.from(fileNames).some(n => n.includes('vite.config')) },
    { key: 'webpack', name: 'Webpack', logoKey: 'webpack', brandColor: '#8ED6FF', category: 'framework', test: () => hasDep(deps, 'webpack') || allImports.has('webpack') || Array.from(fileNames).some(n => n.includes('webpack.config')) },

    // ------------ Transport / client ------------
    { key: 'axios', name: 'Axios', logoKey: 'axios', brandColor: '#5A67D8', category: 'framework', test: () => hasDep(deps, 'axios') || allImports.has('axios') },

    // ------------ Databases / ORMs ------------
    { key: 'prisma', name: 'Prisma', logoKey: 'inline-prisma', brandColor: '#5A67D8', category: 'database', test: () => hasDep(deps, '@prisma/client') || hasDep(deps, 'prisma') || allImports.has('@prisma/client') || Array.from(filePaths).some(p => p.endsWith('.prisma')) },
    { key: 'drizzle', name: 'Drizzle ORM', logoKey: 'inline-drizzle', brandColor: '#C5F74F', category: 'database', test: () => hasDep(deps, 'drizzle-orm') || allImports.has('drizzle-orm') },
    { key: 'mongoose', name: 'MongoDB', logoKey: 'mongodb', brandColor: '#47A248', category: 'database', test: () => hasDep(deps, 'mongoose') || hasDep(deps, 'mongodb') || allImports.has('mongoose') || allImports.has('mongodb') },
    { key: 'typeorm', name: 'TypeORM', logoKey: 'inline-typeorm', brandColor: '#E83524', category: 'database', test: () => hasDep(deps, 'typeorm') || allImports.has('typeorm') },
    { key: 'sequelize', name: 'Sequelize', logoKey: 'sequelize', brandColor: '#52B6FF', category: 'database', test: () => hasDep(deps, 'sequelize') || allImports.has('sequelize') },
    { key: 'knex', name: 'Knex', logoKey: 'knex', brandColor: '#E0B14C', category: 'database', test: () => hasDep(deps, 'knex') || allImports.has('knex') },

    { key: 'postgresql', name: 'PostgreSQL', logoKey: 'postgresql', brandColor: '#4169E1', category: 'database', test: () => hasDep(deps, 'pg') || hasDep(deps, 'postgres') || allImports.has('pg') || allImports.has('postgres') },
    { key: 'mysql', name: 'MySQL', logoKey: 'mysql', brandColor: '#4479A1', category: 'database', test: () => hasDep(deps, 'mysql2') || hasDep(deps, 'mysql') || allImports.has('mysql2') || allImports.has('mysql') },
    { key: 'redis', name: 'Redis', logoKey: 'redis', brandColor: '#DC382D', category: 'database', test: () => hasDep(deps, 'redis') || hasDep(deps, 'ioredis') || allImports.has('redis') || allImports.has('ioredis') },
    { key: 'sqlite', name: 'SQLite', logoKey: 'sqlite', brandColor: '#003B57', category: 'database', test: () => hasDep(deps, 'sqlite3') || hasDep(deps, 'better-sqlite3') || allImports.has('sqlite3') || allImports.has('better-sqlite3') },

    // ------------ Auth ------------
    { key: 'nextauth', name: 'NextAuth.js', logoKey: 'inline-nextauth', brandColor: '#7c3aed', category: 'auth', test: () => hasDep(deps, 'next-auth') || allImports.has('next-auth') || allImports.has('@next-auth') },
    { key: 'auth0', name: 'Auth0', logoKey: 'inline-auth0', brandColor: '#EB5424', category: 'auth', test: () => hasDep(deps, '@auth0/nextjs-auth0') || hasDep(deps, '@auth0/auth0-react') || allImports.has('@auth0/nextjs-auth0') },
    { key: 'clerk', name: 'Clerk', logoKey: 'inline-clerk', brandColor: '#6C47FF', category: 'auth', test: () => hasDep(deps, '@clerk/nextjs') || hasDep(deps, '@clerk/clerk-react') || allImports.has('@clerk/nextjs') },
    { key: 'passport', name: 'Passport', logoKey: 'passport', brandColor: '#7B61FF', category: 'auth', test: () => hasDep(deps, 'passport') || allImports.has('passport') },
    { key: 'jsonwebtoken', name: 'JWT', logoKey: 'inline-jwt', brandColor: '#d63aff', category: 'auth', test: () => hasDep(deps, 'jsonwebtoken') || allImports.has('jsonwebtoken') },
    { key: 'bcrypt', name: 'bcrypt', logoKey: 'bcrypt', brandColor: '#2BB673', category: 'auth', test: () => hasDep(deps, 'bcrypt') || hasDep(deps, 'bcryptjs') || allImports.has('bcrypt') },

    // ------------ GraphQL ------------
    { key: 'graphql', name: 'GraphQL', logoKey: 'graphql', brandColor: '#E10098', category: 'framework', test: () => hasDep(deps, 'graphql') || allImports.has('graphql') },
    { key: 'apollo', name: 'Apollo', logoKey: 'apollo', brandColor: '#5B2A86', category: 'framework', test: () => hasDep(deps, '@apollo/client') || hasDep(deps, 'apollo-server') || allImports.has('@apollo/client') },

    // ------------ UI libs ------------
    { key: 'tailwind', name: 'Tailwind CSS', logoKey: 'tailwindcss', brandColor: '#38BDF8', category: 'ui', test: () => hasDep(deps, 'tailwindcss') || allImports.has('tailwindcss') || Array.from(fileNames).some(n => n.includes('tailwind.config')) },
    { key: 'mui', name: 'Material UI', logoKey: 'materialui', brandColor: '#007FFF', category: 'ui', test: () => hasDep(deps, '@mui/material') || allImports.has('@mui/material') },
    { key: 'chakra', name: 'Chakra UI', logoKey: 'inline-chakra', brandColor: '#319795', category: 'ui', test: () => hasDep(deps, '@chakra-ui/react') || allImports.has('@chakra-ui/react') },
    { key: 'framer', name: 'Framer Motion', logoKey: 'inline-framer', brandColor: '#0055FF', category: 'ui', test: () => hasDep(deps, 'framer-motion') || allImports.has('framer-motion') },
    { key: 'antd', name: 'Ant Design', logoKey: 'antd', brandColor: '#1890FF', category: 'ui', test: () => hasDep(deps, 'antd') || allImports.has('antd') },

    // ------------ State ------------
    { key: 'zustand', name: 'Zustand', logoKey: 'inline-zustand', brandColor: '#443E38', category: 'state', test: () => hasDep(deps, 'zustand') || allImports.has('zustand') },
    { key: 'redux', name: 'Redux', logoKey: 'redux', brandColor: '#764ABC', category: 'state', test: () => hasDep(deps, '@reduxjs/toolkit') || hasDep(deps, 'redux') || allImports.has('redux') },
    { key: 'mobx', name: 'MobX', logoKey: 'mobx', brandColor: '#E84E1B', category: 'state', test: () => hasDep(deps, 'mobx') || hasDep(deps, 'mobx-react') || allImports.has('mobx') },
    { key: 'redux-saga', name: 'Redux-Saga', logoKey: 'reduxsaga', brandColor: '#9CA3AF', category: 'state', test: () => hasDep(deps, 'redux-saga') || allImports.has('redux-saga') },

    // ------------ Testing ------------
    { key: 'jest', name: 'Jest', logoKey: 'jest', brandColor: '#C21325', category: 'testing', test: () => hasDep(deps, 'jest') || allImports.has('jest') || Array.from(fileNames).some(n => n.includes('jest.config')) },
    { key: 'vitest', name: 'Vitest', logoKey: 'vitejs', brandColor: '#6E9F18', category: 'testing', test: () => hasDep(deps, 'vitest') || allImports.has('vitest') || Array.from(fileNames).some(n => n.includes('vitest.config')) },
    { key: 'mocha', name: 'Mocha', logoKey: 'mocha', brandColor: '#8D33FF', category: 'testing', test: () => hasDep(deps, 'mocha') || allImports.has('mocha') },
    { key: 'cypress', name: 'Cypress', logoKey: 'cypress', brandColor: '#2F6BFF', category: 'testing', test: () => hasDep(deps, 'cypress') || allImports.has('cypress') },
    { key: 'playwright', name: 'Playwright', logoKey: 'inline-playwright', brandColor: '#2EAD33', category: 'testing', test: () => hasDep(deps, '@playwright/test') || allImports.has('@playwright/test') },

    // ------------ DevOps / infra ------------
    { key: 'docker', name: 'Docker', logoKey: 'docker', brandColor: '#2496ED', category: 'devops', test: () => Array.from(fileNames).some(n => n === 'dockerfile' || n === 'docker-compose.yml' || n === 'docker-compose.yaml') },
    { key: 'gha', name: 'GitHub Actions', logoKey: 'github', brandColor: '#2088FF', category: 'devops', test: () => Array.from(filePaths).some(p => p.includes('.github/workflows')) },

    // ------------ Cloud & Third-Party SaaS / AI / DB ------------
    { key: 'aws-s3', name: 'AWS S3', logoKey: 'inline-aws', brandColor: '#FF9900', category: 'cloud', service: 'S3', test: () => hasDep(deps, '@aws-sdk/client-s3') || allImports.has('@aws-sdk/client-s3') },
    { key: 'aws-lambda', name: 'AWS Lambda', logoKey: 'inline-aws', brandColor: '#FF9900', category: 'cloud', service: 'Lambda', test: () => hasDep(deps, '@aws-sdk/client-lambda') || allImports.has('@aws-sdk/client-lambda') },
    { key: 'aws-dynamo', name: 'AWS DynamoDB', logoKey: 'inline-aws', brandColor: '#FF9900', category: 'cloud', service: 'DynamoDB', test: () => hasDep(deps, '@aws-sdk/client-dynamodb') || allImports.has('@aws-sdk/client-dynamodb') },
    { key: 'aws-sqs', name: 'AWS SQS', logoKey: 'inline-aws', brandColor: '#FF9900', category: 'cloud', service: 'SQS', test: () => hasDep(deps, '@aws-sdk/client-sqs') || allImports.has('@aws-sdk/client-sqs') },
    { key: 'aws-ses', name: 'AWS SES', logoKey: 'inline-aws', brandColor: '#FF9900', category: 'cloud', service: 'SES', test: () => hasDep(deps, '@aws-sdk/client-ses') || allImports.has('@aws-sdk/client-ses') },
    { key: 'aws-ec2', name: 'AWS EC2', logoKey: 'inline-aws', brandColor: '#FF9900', category: 'cloud', service: 'EC2', test: () => hasDep(deps, '@aws-sdk/client-ec2') || allImports.has('@aws-sdk/client-ec2') },
    { key: 'aws-bedrock', name: 'AWS Bedrock', logoKey: 'aws', brandColor: '#FF9900', category: 'cloud', service: 'Bedrock', test: () => hasDep(deps, '@aws-sdk/client-bedrock-runtime') || allImports.has('@aws-sdk/client-bedrock-runtime') },
    { key: 'aws-cloudfront', name: 'AWS CloudFront', logoKey: 'aws', brandColor: '#FF9900', category: 'cloud', service: 'CloudFront', test: () => hasDep(deps, '@aws-sdk/client-cloudfront') || allImports.has('@aws-sdk/client-cloudfront') },
    { key: 'aws-secrets', name: 'AWS Secrets Manager', logoKey: 'aws', brandColor: '#FF9900', category: 'cloud', service: 'SecretsManager', test: () => hasDep(deps, '@aws-sdk/client-ssm') || hasDep(deps, '@aws-sdk/client-secrets-manager') || allImports.has('@aws-sdk/client-ssm') || allImports.has('@aws-sdk/client-secrets-manager') },

    { key: 'supabase', name: 'Supabase', logoKey: 'inline-supabase', brandColor: '#3FCF8E', category: 'cloud', test: () => hasDep(deps, '@supabase/supabase-js') || allImports.has('@supabase/supabase-js') },
    { key: 'firebase', name: 'Firebase', logoKey: 'firebase', brandColor: '#FFCA28', category: 'cloud', test: () => hasDep(deps, 'firebase') || hasDep(deps, 'firebase-admin') || allImports.has('firebase') },
    { key: 'vercel', name: 'Vercel', logoKey: 'inline-vercel', brandColor: '#ffffff', category: 'cloud', test: () => (hasDep(deps, '@vercel/analytics') || hasDep(deps, '@vercel/kv') || hasDep(deps, '@vercel/postgres')) && (allImports.has('@vercel/analytics') || allImports.has('@vercel/kv')) },

    { key: 'pinecone', name: 'Pinecone', logoKey: 'pinecone', brandColor: '#5C4EFF', category: 'database', test: () => hasDep(deps, '@pinecone-database/pinecone') || hasDep(deps, 'pinecone') || allImports.has('@pinecone-database/pinecone') || allImports.has('pinecone') },
    { key: 'neon', name: 'Neon Postgres', logoKey: 'neon', brandColor: '#00E599', category: 'database', test: () => hasDep(deps, '@neondatabase/serverless') || hasDep(deps, '@neon/serverless') || hasDep(deps, 'neon') || allImports.has('@neondatabase/serverless') || allImports.has('@neon/serverless') },
    { key: 'upstash', name: 'Upstash Redis', logoKey: 'upstash', brandColor: '#00E9A3', category: 'database', test: () => hasDep(deps, '@upstash/redis') || allImports.has('@upstash/redis') },

    { key: 'resend', name: 'Resend', logoKey: 'resend', brandColor: '#000000', category: 'cloud', test: () => hasDep(deps, 'resend') || allImports.has('resend') },
    { key: 'anthropic', name: 'Anthropic Claude', logoKey: 'anthropic', brandColor: '#D97757', category: 'cloud', test: () => hasDep(deps, '@anthropic-ai/sdk') || hasDep(deps, 'anthropic') || allImports.has('@anthropic-ai/sdk') || allImports.has('anthropic') },
    { key: 'openai', name: 'OpenAI', logoKey: 'openai', brandColor: '#412991', category: 'cloud', test: () => hasDep(deps, 'openai') || allImports.has('openai') },
    { key: 'groq', name: 'Groq', logoKey: 'groq', brandColor: '#F55036', category: 'cloud', test: () => hasDep(deps, 'groq-sdk') || hasDep(deps, 'groq') || allImports.has('groq-sdk') || allImports.has('groq') },
    { key: 'stripe', name: 'Stripe', logoKey: 'stripe', brandColor: '#635BFF', category: 'cloud', test: () => hasDep(deps, 'stripe') || hasDep(deps, '@stripe/stripe-js') || allImports.has('stripe') || allImports.has('@stripe/stripe-js') },
    { key: 'razorpay', name: 'Razorpay', logoKey: 'razorpay', brandColor: '#3395FF', category: 'cloud', test: () => hasDep(deps, 'razorpay') || allImports.has('razorpay') },
    { key: 'slack', name: 'Slack', logoKey: 'slack', brandColor: '#4A154B', category: 'cloud', test: () => hasDep(deps, '@slack/bolt') || hasDep(deps, '@slack/web-api') || hasDep(deps, 'slack') || allImports.has('@slack/bolt') || allImports.has('@slack/web-api') || allImports.has('slack') },
    { key: 'discord', name: 'Discord', logoKey: 'discord', brandColor: '#5865F2', category: 'cloud', test: () => hasDep(deps, 'discord.js') || hasDep(deps, 'discord-bot-client') || allImports.has('discord.js') },
    { key: 'twilio', name: 'Twilio', logoKey: 'twilio', brandColor: '#F22F46', category: 'cloud', test: () => hasDep(deps, 'twilio') || allImports.has('twilio') },
    { key: 'sendgrid', name: 'SendGrid', logoKey: 'sendgrid', brandColor: '#1A82E2', category: 'cloud', test: () => hasDep(deps, '@sendgrid/mail') || hasDep(deps, 'sendgrid') || allImports.has('@sendgrid/mail') || allImports.has('sendgrid') },
    { key: 'langchain', name: 'LangChain', logoKey: 'langchain', brandColor: '#1C3C3C', category: 'cloud', test: () => hasDep(deps, 'langchain') || hasDep(deps, '@langchain/core') || allImports.has('langchain') || allImports.has('@langchain/core') },
    { key: 'octokit', name: 'Octokit/GitHub API', logoKey: 'github', brandColor: '#24292F', category: 'cloud', test: () => hasDep(deps, '@octokit/rest') || hasDep(deps, 'octokit') || allImports.has('@octokit/rest') || allImports.has('octokit') },
    { key: 'bullmq', name: 'BullMQ', logoKey: 'bullmq', brandColor: '#F5793A', category: 'queue', test: () => hasDep(deps, 'bullmq') || hasDep(deps, 'bull') || allImports.has('bullmq') || allImports.has('bull') },
    { key: 'kafka', name: 'Apache Kafka', logoKey: 'kafka', brandColor: '#231F20', category: 'queue', test: () => hasDep(deps, 'kafkajs') || allImports.has('kafkajs') },

    // ------------ Networking / real-time ------------
    { key: 'socket.io', name: 'Socket.IO', logoKey: 'socketio', brandColor: '#010101', category: 'framework', test: () => (hasDep(deps, 'socket.io') || hasDep(deps, 'socket.io-client')) && (allImports.has('socket.io') || allImports.has('socket.io-client')) },
    { key: 'ws', name: 'ws (WebSocket)', logoKey: 'ws', brandColor: '#10B981', category: 'framework', test: () => hasDep(deps, 'ws') && allImports.has('ws') }
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
    try {
      if (tech.test && tech.test()) {
        const item = {
          key: tech.key,
          name: tech.name,
          version: deps[tech.key] || deps[(tech.name || '').toLowerCase()] || 'unknown',
          category: tech.category,
          logoKey: tech.logoKey,
          brandColor: tech.brandColor,
          detected: true
        };
        if (tech.service) item.service = tech.service;
        detected.push(item);
        if (categories[tech.category]) categories[tech.category].push(item);
      }
    } catch {
      // ignore detection errors
    }
  }

  // Dynamic catch-all: pick up any imported package.json dependency not already detected
  for (const [depName, ver] of Object.entries(deps)) {
    if (!detected.some(d => d.key === depName || depName.includes(d.key))) {
      const isImported = allImports.has(depName) || Array.from(allImports).some(imp => imp.startsWith(depName + '/'));
      if (isImported) {
        let cat = 'framework';
        const lower = depName.toLowerCase();
        if (lower.includes('test') || lower.includes('jest') || lower.includes('mocha') || lower.includes('eslint') || lower.includes('lint') || lower.includes('estree') || lower.includes('typescript')) {
          cat = 'testing';
        } else if (lower.includes('docker') || lower.includes('deploy') || lower.includes('ci')) {
          cat = 'devops';
        } else if (lower.includes('ui') || lower.includes('css') || lower.includes('style') || lower.includes('gsap') || lower.includes('scroll')) {
          cat = 'ui';
        } else if (lower.includes('auth') || lower.includes('jwt') || lower.includes('token')) {
          cat = 'auth';
        } else if (lower.includes('db') || lower.includes('sql') || lower.includes('mongo') || lower.includes('prisma')) {
          cat = 'database';
        }

        const item = {
          key: depName,
          name: depName.startsWith('@') ? depName : depName.charAt(0).toUpperCase() + depName.slice(1),
          version: ver,
          category: cat,
          logoKey: depName,
          brandColor: '#ff5722',
          detected: true
        };
        detected.push(item);
        if (categories[cat]) categories[cat].push(item);
      }
    }
  }

  // Sort by category priority
  const catPriority = {
    framework: 1,
    database: 2,
    auth: 3,
    cloud: 4,
    ui: 5,
    state: 6,
    testing: 7,
    devops: 8
  };

  detected.sort((a, b) => (catPriority[a.category] || 99) - (catPriority[b.category] || 99));

  return { detected, categories };
}

