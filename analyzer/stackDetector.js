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
    { key: 'nextjs', name: 'Next.js', logoKey: 'nextjs', brandColor: '#ffffff', category: 'framework', test: () => (hasDep(deps, 'next') || hasDep(deps, 'nextjs')) && (allImports.has('next') || allImports.has('nextjs')) },
    { key: 'react', name: 'React', logoKey: 'react', brandColor: '#61DAFB', category: 'framework', test: () => hasDep(deps, 'react') && allImports.has('react') },
    { key: 'vuejs', name: 'Vue.js', logoKey: 'vuejs', brandColor: '#42B883', category: 'framework', test: () => hasDep(deps, 'vue') && allImports.has('vue') },
    { key: 'svelte', name: 'Svelte', logoKey: 'svelte', brandColor: '#FF3E00', category: 'framework', test: () => hasDep(deps, 'svelte') && allImports.has('svelte') },
    { key: 'angular', name: 'Angular', logoKey: 'angular', brandColor: '#DD0031', category: 'framework', test: () => (hasDep(deps, '@angular/core') || hasDep(deps, '@angular/cli')) && allImports.has('@angular/core') },

    // Backend frameworks / HTTP servers
    { key: 'express', name: 'Express', logoKey: 'express', brandColor: '#ffffff', category: 'framework', test: () => hasDep(deps, 'express') && allImports.has('express') },
    { key: 'fastify', name: 'Fastify', logoKey: 'fastify', brandColor: '#ffffff', category: 'framework', test: () => hasDep(deps, 'fastify') && allImports.has('fastify') },
    { key: 'koa', name: 'Koa', logoKey: 'koa', brandColor: '#1e9dff', category: 'framework', test: () => hasDep(deps, 'koa') && allImports.has('koa') },
    { key: 'nestjs', name: 'NestJS', logoKey: 'nestjs', brandColor: '#E0234E', category: 'framework', test: () => hasDep(deps, '@nestjs/core') && allImports.has('@nestjs/core') },

    // Bundler / build tool
    { key: 'vitejs', name: 'Vite', logoKey: 'vitejs', brandColor: '#646CFF', category: 'framework', test: () => hasDep(deps, 'vite') && (allImports.has('vite') || Array.from(fileNames).some(n => n.includes('vite.config'))) },
    { key: 'webpack', name: 'Webpack', logoKey: 'webpack', brandColor: '#8ED6FF', category: 'framework', test: () => hasDep(deps, 'webpack') && (allImports.has('webpack') || Array.from(fileNames).some(n => n.includes('webpack.config'))) },

    // ------------ Transport / client ------------
    { key: 'axios', name: 'Axios', logoKey: 'axios', brandColor: '#5A67D8', category: 'framework', test: () => hasDep(deps, 'axios') && allImports.has('axios') },

    // ------------ Databases / ORMs ------------
    { key: 'prisma', name: 'Prisma', logoKey: 'inline-prisma', brandColor: '#5A67D8', category: 'database', test: () => hasDep(deps, '@prisma/client') && (allImports.has('@prisma/client') || allImports.has('@prisma') || Array.from(filePaths).some(p => p.endsWith('.prisma'))) },
    { key: 'drizzle', name: 'Drizzle ORM', logoKey: 'inline-drizzle', brandColor: '#C5F74F', category: 'database', test: () => hasDep(deps, 'drizzle-orm') && allImports.has('drizzle-orm') },
    { key: 'mongoose', name: 'MongoDB', logoKey: 'mongodb', brandColor: '#47A248', category: 'database', test: () => hasDep(deps, 'mongoose') && allImports.has('mongoose') },
    { key: 'typeorm', name: 'TypeORM', logoKey: 'inline-typeorm', brandColor: '#E83524', category: 'database', test: () => hasDep(deps, 'typeorm') && allImports.has('typeorm') },
    { key: 'sequelize', name: 'Sequelize', logoKey: 'sequelize', brandColor: '#52B6FF', category: 'database', test: () => hasDep(deps, 'sequelize') && allImports.has('sequelize') },
    { key: 'knex', name: 'Knex', logoKey: 'knex', brandColor: '#E0B14C', category: 'database', test: () => hasDep(deps, 'knex') && allImports.has('knex') },

    { key: 'postgresql', name: 'PostgreSQL', logoKey: 'postgresql', brandColor: '#4169E1', category: 'database', test: () => (hasDep(deps, 'pg') || hasDep(deps, 'postgres')) && (allImports.has('pg') || allImports.has('postgres')) },
    { key: 'mysql', name: 'MySQL', logoKey: 'mysql', brandColor: '#4479A1', category: 'database', test: () => (hasDep(deps, 'mysql2') || hasDep(deps, 'mysql')) && (allImports.has('mysql2') || allImports.has('mysql')) },
    { key: 'redis', name: 'Redis', logoKey: 'redis', brandColor: '#DC382D', category: 'database', test: () => (hasDep(deps, 'redis') || hasDep(deps, 'ioredis')) && (allImports.has('redis') || allImports.has('ioredis')) },
    { key: 'sqlite', name: 'SQLite', logoKey: 'sqlite', brandColor: '#003B57', category: 'database', test: () => (hasDep(deps, 'sqlite3') || hasDep(deps, 'better-sqlite3')) && (allImports.has('sqlite3') || allImports.has('better-sqlite3')) },

    // ------------ Auth ------------
    { key: 'nextauth', name: 'NextAuth.js', logoKey: 'inline-nextauth', brandColor: '#7c3aed', category: 'auth', test: () => hasDep(deps, 'next-auth') && (allImports.has('next-auth') || allImports.has('@next-auth')) },
    { key: 'auth0', name: 'Auth0', logoKey: 'inline-auth0', brandColor: '#EB5424', category: 'auth', test: () => (hasDep(deps, '@auth0/nextjs-auth0') || hasDep(deps, '@auth0/auth0-react')) && (allImports.has('@auth0/nextjs-auth0') || allImports.has('@auth0/auth0-react')) },
    { key: 'clerk', name: 'Clerk', logoKey: 'inline-clerk', brandColor: '#6C47FF', category: 'auth', test: () => (hasDep(deps, '@clerk/nextjs') || hasDep(deps, '@clerk/clerk-react')) && (allImports.has('@clerk/nextjs') || allImports.has('@clerk/clerk-react') || allImports.has('@clerk')) },
    { key: 'passport', name: 'Passport', logoKey: 'passport', brandColor: '#7B61FF', category: 'auth', test: () => hasDep(deps, 'passport') && allImports.has('passport') },
    { key: 'jsonwebtoken', name: 'JWT', logoKey: 'inline-jwt', brandColor: '#d63aff', category: 'auth', test: () => hasDep(deps, 'jsonwebtoken') && allImports.has('jsonwebtoken') },
    { key: 'bcrypt', name: 'bcrypt', logoKey: 'bcrypt', brandColor: '#2BB673', category: 'auth', test: () => (hasDep(deps, 'bcrypt') || hasDep(deps, 'bcryptjs')) && (allImports.has('bcrypt') || allImports.has('bcryptjs')) },

    // ------------ GraphQL ------------
    { key: 'graphql', name: 'GraphQL', logoKey: 'graphql', brandColor: '#E10098', category: 'framework', test: () => hasDep(deps, 'graphql') && allImports.has('graphql') },
    { key: 'apollo', name: 'Apollo', logoKey: 'apollo', brandColor: '#5B2A86', category: 'framework', test: () => (hasDep(deps, '@apollo/client') || hasDep(deps, 'apollo-server')) && (allImports.has('@apollo/client') || allImports.has('apollo-server')) },

    // ------------ UI libs ------------
    { key: 'tailwind', name: 'Tailwind CSS', logoKey: 'tailwindcss', brandColor: '#38BDF8', category: 'ui', test: () => hasDep(deps, 'tailwindcss') && (allImports.has('tailwindcss') || Array.from(fileNames).some(n => n.includes('tailwind.config'))) },
    { key: 'mui', name: 'Material UI', logoKey: 'materialui', brandColor: '#007FFF', category: 'ui', test: () => hasDep(deps, '@mui/material') && (allImports.has('@mui/material') || allImports.has('@mui')) },
    { key: 'chakra', name: 'Chakra UI', logoKey: 'inline-chakra', brandColor: '#319795', category: 'ui', test: () => hasDep(deps, '@chakra-ui/react') && (allImports.has('@chakra-ui/react') || allImports.has('@chakra-ui')) },
    { key: 'framer', name: 'Framer Motion', logoKey: 'inline-framer', brandColor: '#0055FF', category: 'ui', test: () => hasDep(deps, 'framer-motion') && allImports.has('framer-motion') },
    { key: 'antd', name: 'Ant Design', logoKey: 'antd', brandColor: '#1890FF', category: 'ui', test: () => hasDep(deps, 'antd') && allImports.has('antd') },

    // ------------ State ------------
    { key: 'zustand', name: 'Zustand', logoKey: 'inline-zustand', brandColor: '#443E38', category: 'state', test: () => hasDep(deps, 'zustand') && allImports.has('zustand') },
    { key: 'redux', name: 'Redux', logoKey: 'redux', brandColor: '#764ABC', category: 'state', test: () => (hasDep(deps, '@reduxjs/toolkit') || hasDep(deps, 'redux')) && (allImports.has('@reduxjs/toolkit') || allImports.has('redux') || allImports.has('react-redux')) },
    { key: 'mobx', name: 'MobX', logoKey: 'mobx', brandColor: '#E84E1B', category: 'state', test: () => (hasDep(deps, 'mobx') || hasDep(deps, 'mobx-react')) && (allImports.has('mobx') || allImports.has('mobx-react')) },
    { key: 'redux-saga', name: 'Redux-Saga', logoKey: 'reduxsaga', brandColor: '#9CA3AF', category: 'state', test: () => hasDep(deps, 'redux-saga') && allImports.has('redux-saga') },

    // ------------ Testing ------------
    { key: 'jest', name: 'Jest', logoKey: 'jest', brandColor: '#C21325', category: 'testing', test: () => hasDep(deps, 'jest') && (allImports.has('jest') || Array.from(fileNames).some(n => n.includes('jest.config'))) },
    { key: 'vitest', name: 'Vitest', logoKey: 'vitejs', brandColor: '#6E9F18', category: 'testing', test: () => hasDep(deps, 'vitest') && (allImports.has('vitest') || Array.from(fileNames).some(n => n.includes('vitest.config'))) },
    { key: 'mocha', name: 'Mocha', logoKey: 'mocha', brandColor: '#8D33FF', category: 'testing', test: () => hasDep(deps, 'mocha') && allImports.has('mocha') },
    { key: 'cypress', name: 'Cypress', logoKey: 'cypress', brandColor: '#2F6BFF', category: 'testing', test: () => hasDep(deps, 'cypress') && allImports.has('cypress') },
    { key: 'playwright', name: 'Playwright', logoKey: 'inline-playwright', brandColor: '#2EAD33', category: 'testing', test: () => hasDep(deps, '@playwright/test') && allImports.has('@playwright/test') },

    // ------------ DevOps / infra ------------
    { key: 'docker', name: 'Docker', logoKey: 'docker', brandColor: '#2496ED', category: 'devops', test: () => Array.from(fileNames).some(n => n === 'dockerfile' || n === 'docker-compose.yml' || n === 'docker-compose.yaml') },
    { key: 'gha', name: 'GitHub Actions', logoKey: 'github', brandColor: '#2088FF', category: 'devops', test: () => Array.from(filePaths).some(p => p.includes('.github/workflows')) },

    // ------------ Cloud ------------
    { key: 'aws-s3', name: 'AWS S3', logoKey: 'inline-aws', brandColor: '#FF9900', category: 'cloud', service: 'S3', test: () => hasDep(deps, '@aws-sdk/client-s3') && allImports.has('@aws-sdk/client-s3') },
    { key: 'aws-lambda', name: 'AWS Lambda', logoKey: 'inline-aws', brandColor: '#FF9900', category: 'cloud', service: 'Lambda', test: () => hasDep(deps, '@aws-sdk/client-lambda') && allImports.has('@aws-sdk/client-lambda') },
    { key: 'aws-dynamo', name: 'AWS DynamoDB', logoKey: 'inline-aws', brandColor: '#FF9900', category: 'cloud', service: 'DynamoDB', test: () => hasDep(deps, '@aws-sdk/client-dynamodb') && allImports.has('@aws-sdk/client-dynamodb') },
    { key: 'aws-sqs', name: 'AWS SQS', logoKey: 'inline-aws', brandColor: '#FF9900', category: 'cloud', service: 'SQS', test: () => hasDep(deps, '@aws-sdk/client-sqs') && allImports.has('@aws-sdk/client-sqs') },
    { key: 'aws-ses', name: 'AWS SES', logoKey: 'inline-aws', brandColor: '#FF9900', category: 'cloud', service: 'SES', test: () => hasDep(deps, '@aws-sdk/client-ses') && allImports.has('@aws-sdk/client-ses') },
    { key: 'aws-ec2', name: 'AWS EC2', logoKey: 'inline-aws', brandColor: '#FF9900', category: 'cloud', service: 'EC2', test: () => hasDep(deps, '@aws-sdk/client-ec2') && allImports.has('@aws-sdk/client-ec2') },

    { key: 'supabase', name: 'Supabase', logoKey: 'inline-supabase', brandColor: '#3FCF8E', category: 'cloud', test: () => hasDep(deps, '@supabase/supabase-js') && (allImports.has('@supabase/supabase-js') || allImports.has('@supabase')) },
    { key: 'firebase', name: 'Firebase', logoKey: 'firebase', brandColor: '#FFCA28', category: 'cloud', test: () => (hasDep(deps, 'firebase') || hasDep(deps, 'firebase-admin')) && (allImports.has('firebase') || allImports.has('firebase-admin')) },
    { key: 'vercel', name: 'Vercel', logoKey: 'inline-vercel', brandColor: '#ffffff', category: 'cloud', test: () => hasDep(deps, '@vercel/analytics') && allImports.has('@vercel/analytics') },

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

  // Ensure stable order: frameworks/ui/auth show first.
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

