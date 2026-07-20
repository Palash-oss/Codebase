import React from 'react';

function TechStackView({ data, onSelectFile }) {
  if (!data) return null;

  // Reconstruct all dependencies from package.json files
  const allDeps = {};
  data.files.forEach(f => {
    if (f.name === 'package.json') {
      try {
        const pkg = JSON.parse(f.content || '{}');
        Object.assign(allDeps, pkg.dependencies || {});
        Object.assign(allDeps, pkg.devDependencies || {});
      } catch (e) {}
    }
  });

  const allImports = new Set();
  data.files.forEach(f => {
    f.imports?.forEach(imp => {
      if (imp.specifier) {
        allImports.add(imp.specifier);
        const parts = imp.specifier.split('/');
        if (parts.length > 0) {
          allImports.add(parts[0]);
        }
      }
    });
  });

  const knownTech = [
    { key: 'react', name: 'React', category: 'frontend', brandColor: '#61DAFB' },
    { key: 'express', name: 'Express', category: 'backend', brandColor: '#ffffff' },
    { key: 'vite', name: 'Vite', category: 'frontend', brandColor: '#646CFF' },
    { key: 'vitejs', name: 'Vite', category: 'frontend', brandColor: '#646CFF' },
    { key: '@typescript-eslint/typescript-estree', name: 'ESTree Parser', category: 'tooling', brandColor: '#3178C6' },
    { key: 'adm-zip', name: 'Adm-Zip', category: 'backend', brandColor: '#F18F01' },
    { key: 'multer', name: 'Multer', category: 'backend', brandColor: '#E2C044' },
    { key: 'node-fetch', name: 'Node Fetch', category: 'backend', brandColor: '#C73E1D' },
    { key: 'gsap', name: 'GSAP', category: 'frontend', brandColor: '#88CE02' },
    { key: 'locomotive-scroll', name: 'Locomotive Scroll', category: 'frontend', brandColor: '#000000' },
    { key: 'oxlint', name: 'Oxlint', category: 'tooling', brandColor: '#E10098' },
    { key: 'typescript', name: 'TypeScript', category: 'tooling', brandColor: '#3178C6' },
    { key: 'nextjs', name: 'Next.js', category: 'frontend', brandColor: '#ffffff' },
    { key: 'next', name: 'Next.js', category: 'frontend', brandColor: '#ffffff' },
    { key: 'vue', name: 'Vue.js', category: 'frontend', brandColor: '#42B883' },
    { key: 'vuejs', name: 'Vue.js', category: 'frontend', brandColor: '#42B883' },
    { key: 'svelte', name: 'Svelte', category: 'frontend', brandColor: '#FF3E00' },
    { key: 'angular', name: 'Angular', category: 'frontend', brandColor: '#DD0031' },
    { key: 'tailwind', name: 'Tailwind CSS', category: 'frontend', brandColor: '#38BDF8' },
    { key: 'tailwindcss', name: 'Tailwind CSS', category: 'frontend', brandColor: '#38BDF8' },
    { key: 'mui', name: 'Material UI', category: 'frontend', brandColor: '#007FFF' },
    { key: 'chakra', name: 'Chakra UI', category: 'frontend', brandColor: '#319795' },
    { key: 'framer-motion', name: 'Framer Motion', category: 'frontend', brandColor: '#0055FF' },
    { key: 'zustand', name: 'Zustand', category: 'frontend', brandColor: '#443E38' },
    { key: 'redux', name: 'Redux', category: 'frontend', brandColor: '#764ABC' },
    { key: 'prisma', name: 'Prisma', category: 'backend', brandColor: '#5A67D8' },
    { key: 'drizzle-orm', name: 'Drizzle ORM', category: 'backend', brandColor: '#C5F74F' },
    { key: 'mongoose', name: 'Mongoose', category: 'backend', brandColor: '#47A248' },
    { key: 'postgresql', name: 'PostgreSQL', category: 'backend', brandColor: '#4169E1' },
    { key: 'mysql', name: 'MySQL', category: 'backend', brandColor: '#4479A1' },
    { key: 'redis', name: 'Redis', category: 'backend', brandColor: '#DC382D' },
    { key: 'sqlite', name: 'SQLite', category: 'backend', brandColor: '#003B57' },
    { key: 'nextauth', name: 'NextAuth.js', category: 'backend', brandColor: '#7c3aed' },
    { key: 'clerk', name: 'Clerk', category: 'backend', brandColor: '#6C47FF' },
    { key: 'jsonwebtoken', name: 'JWT', category: 'backend', brandColor: '#d63aff' },
    { key: 'bcrypt', name: 'bcrypt', category: 'backend', brandColor: '#2BB673' },
    { key: 'graphql', name: 'GraphQL', category: 'backend', brandColor: '#E10098' },
    { key: 'apollo', name: 'Apollo', category: 'backend', brandColor: '#5B2A86' },
    { key: 'docker', name: 'Docker', category: 'tooling', brandColor: '#2496ED' },
    { key: 'gha', name: 'GitHub Actions', category: 'tooling', brandColor: '#2088FF' },
    { key: 'jest', name: 'Jest', category: 'tooling', brandColor: '#C21325' },
    { key: 'vitest', name: 'Vitest', category: 'tooling', brandColor: '#6E9F18' },
    { key: 'cypress', name: 'Cypress', category: 'tooling', brandColor: '#2F6BFF' },
    { key: 'playwright', name: 'Playwright', category: 'tooling', brandColor: '#2EAD33' },
    { key: 'supabase', name: 'Supabase', category: 'backend', brandColor: '#3FCF8E' },
    { key: 'firebase', name: 'Firebase', category: 'backend', brandColor: '#FFCA28' },
    { key: 'vercel', name: 'Vercel', category: 'tooling', brandColor: '#ffffff' }
  ];

  const classifyTech = (name) => {
    const n = name.toLowerCase();
    if (
      n.includes('react') || n.includes('vue') || n.includes('svelte') || n.includes('angular') ||
      n.includes('ui') || n.includes('tailwind') || n.includes('styled') || n.includes('framer') ||
      n.includes('gsap') || n.includes('scroll') || n.includes('css') || n.includes('html') ||
      n.includes('dom') || n.includes('component') || n.includes('icons') || n.includes('client') ||
      n.includes('vite') || n.includes('next')
    ) {
      return 'frontend';
    }
    if (
      n.includes('test') || n.includes('spec') || n.includes('eslint') || n.includes('prettier') ||
      n.includes('lint') || n.includes('typescript') || n.includes('estree') || n.includes('docker') ||
      n.includes('github') || n.includes('workflow') || n.includes('deploy') || n.includes('ci') ||
      n.includes('babel') || n.includes('webpack') || n.includes('rollup') || n.includes('ts-node')
    ) {
      return 'tooling';
    }
    return 'backend';
  };

  const getDynamicDescription = (techName, category) => {
    const name = techName.toLowerCase();
    if (name === 'react') return 'Serves as the core library for component-based user interface rendering.';
    if (name === 'express') return 'Handles HTTP server endpoints, REST API routing, and request orchestration.';
    if (name === 'vite' || name === 'vitejs') return 'Serves as the high-speed build tool and development server.';
    if (name === '@typescript-eslint/typescript-estree') return 'Scans and parses source files into Abstract Syntax Trees (AST) to resolve imports and structure.';
    if (name === 'adm-zip') return 'Handles extraction of uploaded repository and project ZIP archives.';
    if (name === 'multer') return 'Handles file uploads and multipart form data storage.';
    if (name === 'node-fetch') return 'Performs asynchronous HTTP fetch requests to remote servers and APIs.';
    if (name === 'gsap') return 'Powers smooth scroll triggers and premium micro-animations.';
    if (name === 'locomotive-scroll') return 'Provides high-quality premium inertial smooth scrolling.';
    if (name === 'oxlint') return 'Performs lightning-fast static analysis and codebase linting.';
    if (name === 'typescript') return 'Provides static typing, compiler checks, and type definition support.';
    if (name === 'cors') return 'Configures Cross-Origin Resource Sharing (CORS) security headers.';
    
    if (category === 'frontend') return `${techName} drives client-side interface elements, styling rules, or application states.`;
    if (category === 'backend') return `${techName} manages database persistence, API protocols, or middleware server utilities.`;
    return `${techName} supports development testing, static analysis pipelines, or deployment setups.`;
  };

  const activeTechList = [];
  Object.keys(allDeps).forEach(depName => {
    const isImported = allImports.has(depName);
    const hasConfig = 
      (depName === 'vite' && data.files.some(f => f.name.includes('vite.config'))) ||
      (depName === 'tailwindcss' && data.files.some(f => f.name.includes('tailwind.config'))) ||
      (depName === 'jest' && data.files.some(f => f.name.includes('jest.config'))) ||
      (depName === 'vitest' && data.files.some(f => f.name.includes('vitest.config'))) ||
      (depName === 'docker' && data.files.some(f => f.name === 'Dockerfile' || f.name.startsWith('docker-compose')));
      
    if (isImported || hasConfig) {
      const known = knownTech.find(t => t.key === depName || (depName.includes(t.key) && t.key.length > 3));
      activeTechList.push({
        key: depName,
        name: known ? known.name : depName,
        version: allDeps[depName],
        category: known ? known.category : classifyTech(depName),
        brandColor: known ? known.brandColor : '#bebebe'
      });
    }
  });

  data.stack.detected.forEach(tech => {
    if (!activeTechList.some(t => t.key === tech.key)) {
      const known = knownTech.find(kt => kt.key === tech.key);
      activeTechList.push({
        key: tech.key,
        name: tech.name,
        version: tech.version,
        category: known ? known.category : (tech.category === 'testing' || tech.category === 'devops' ? 'tooling' : 'backend'),
        brandColor: tech.brandColor
      });
    }
  });

  const getMappedFilesForTech = (techKey) => {
    return data.files.filter(f => 
      f.imports?.some(imp => 
        imp.specifier === techKey || 
        imp.specifier.startsWith(techKey + '/') || 
        imp.specifier.includes(techKey)
      )
    ).slice(0, 3);
  };

  const layers = [
    {
      title: "1. Backend Layer (Server, Database & Core Utilities)",
      desc: "Manages backend routers, REST endpoints, archive unpackers, upload streams, and node server middleware.",
      techs: activeTechList.filter(t => t.category === 'backend'),
    },
    {
      title: "2. Frontend Layer (User Interface, Styling & Tooling)",
      desc: "Controls component trees, UI layout rendering, build tooling, linters, scrolling, and style animations.",
      techs: activeTechList.filter(t => t.category === 'frontend' || t.category === 'tooling'),
    }
  ];

  return (
    <div id="view-stack" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', paddingRight: '8px' }}>
      <h2 style={{ fontSize: '32px', fontWeight: '700', color: 'var(--beige)' }}>Tech Stack Architecture</h2>
      <p style={{ color: 'var(--beige-3)', fontSize: '14px', marginTop: '4px', marginBottom: '24px' }}>
        Dynamic grouping of active dependencies into Backend and Frontend environments based on codebase usage.
      </p>

      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
        {layers.map((layer, idx) => (
          <div 
            key={idx} 
            style={{ 
              flex: '1 1 450px',
              background: 'var(--black-2)', 
              border: '1px solid var(--border)', 
              borderRadius: '16px', 
              padding: '24px',
              boxShadow: '0 4px 30px rgba(0, 0, 0, 0.04)',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <h3 style={{ fontSize: '22px', fontWeight: '700', color: 'var(--orange)', marginBottom: '6px' }}>{layer.title}</h3>
            <p style={{ color: 'var(--beige-2)', fontSize: '13px', marginBottom: '20px', lineHeight: '1.4' }}>{layer.desc}</p>
            
            {layer.techs.length === 0 ? (
              <p style={{ color: 'var(--beige-3)', fontSize: '13px', fontStyle: 'italic' }}>No active integrations detected in this layer.</p>
            ) : (
              <div 
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column',
                  gap: '16px' 
                }}
              >
                {layer.techs.map((tech, tIdx) => {
                  const mappedFiles = getMappedFilesForTech(tech.key);
                  const logoUrl = tech.key.startsWith('@') || tech.key === 'adm-zip' || tech.key === 'multer' || tech.key === 'node-fetch' || tech.key === 'gsap' || tech.key === 'locomotive-scroll'
                    ? '' 
                    : `https://cdn.jsdelivr.net/gh/devicons/devicon/icons/${tech.key.replace('js', '')}/${tech.key.replace('js', '')}-original.svg`;

                  return (
                    <div 
                      key={tIdx}
                      style={{
                        background: 'var(--black-3)',
                        border: '1px solid var(--border-2)',
                        borderRadius: '12px',
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '12px'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                          <div 
                            style={{ 
                              width: '32px', 
                              height: '32px', 
                              borderRadius: '8px', 
                              border: `1.5px solid ${tech.brandColor === '#ffffff' ? 'var(--orange)' : tech.brandColor}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: 'var(--black-2)',
                              fontSize: '11px',
                              fontWeight: '700',
                              color: tech.brandColor === '#ffffff' ? 'var(--orange)' : tech.brandColor,
                              overflow: 'hidden'
                            }}
                          >
                            {logoUrl ? (
                              <img 
                                src={logoUrl} 
                                alt="" 
                                style={{ width: '20px', height: '20px' }}
                                onError={(e) => { e.target.style.display = 'none'; e.target.nextElementSibling.style.display = 'block'; }}
                              />
                            ) : null}
                            <span style={{ display: logoUrl ? 'none' : 'block' }}>
                              {tech.name.slice(0, 2).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <h4 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--beige)', margin: 0 }}>{tech.name}</h4>
                            <span style={{ fontSize: '11px', color: 'var(--beige-3)', fontWeight: '500' }}>v{tech.version}</span>
                          </div>
                        </div>
                        <p style={{ fontSize: '13px', color: 'var(--beige-2)', lineHeight: '1.5', margin: 0 }}>
                          {getDynamicDescription(tech.name, tech.category)}
                        </p>
                      </div>

                      {mappedFiles.length > 0 && (
                        <div style={{ borderTop: '1px solid var(--border-2)', paddingTop: '10px', marginTop: '4px' }}>
                          <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--beige-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                            Active Mapped Files
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {mappedFiles.map((file, fIdx) => (
                              <div 
                                key={fIdx}
                                onClick={() => onSelectFile(file)}
                                style={{ 
                                  fontSize: '12px', 
                                  color: 'var(--orange)', 
                                  fontWeight: '600',
                                  cursor: 'pointer',
                                  textDecoration: 'none',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                                onMouseEnter={(e) => e.target.style.textDecoration = 'underline'}
                                onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
                              >
                                ➔ {file.name}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default TechStackView;
