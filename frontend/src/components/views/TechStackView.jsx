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
    if (techName === '@typescript-eslint/typescript-estree') return 'Scans and parses source files into Abstract Syntax Trees (AST) to resolve imports and structure.';
    if (techName === 'acorn' || techName.includes('babel')) return 'Parses raw source code strings into Abstract Syntax Tree AST representations.';
    if (category === 'Frontend UI') return `Powers interactive client-side rendering and state management for ${techName}.`;
    if (category === 'Backend Framework') return `Handles HTTP API routing, controller request dispatches, and server endpoints for ${techName}.`;
    if (category === 'Database') return `Provides relational / document storage and data persistence layer for ${techName}.`;
    return `${techName} supports development testing, static analysis pipelines, or deployment setups.`;
  };

  const activeTechList = [];
  Object.keys(allDeps).forEach(depName => {
    const isImported = allImports.has(depName);
    const hasConfig = 
      (depName === 'vite' && data.files.some(f => (f.name || f.relativePath || '').includes('vite.config'))) ||
      (depName === 'tailwindcss' && data.files.some(f => (f.name || f.relativePath || '').includes('tailwind.config'))) ||
      (depName === 'jest' && data.files.some(f => (f.name || f.relativePath || '').includes('jest.config'))) ||
      (depName === 'vitest' && data.files.some(f => (f.name || f.relativePath || '').includes('vitest.config'))) ||
      (depName === 'docker' && data.files.some(f => (f.name || f.relativePath || '').includes('Dockerfile') || (f.name || f.relativePath || '').includes('docker-compose')));
      
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

  (data?.stack?.detected || []).forEach(tech => {
    if (!activeTechList.some(t => t.key === tech.key)) {
      const known = knownTech.find(kt => kt.key === tech.key || (tech.key.includes(kt.key) && kt.key.length > 3));
      let cat = known ? known.category : classifyTech(tech.key);
      if (tech.category === 'testing' || tech.category === 'devops') cat = 'tooling';
      if (tech.category === 'framework' && (tech.key === 'express' || tech.key === 'fastify' || tech.key === 'koa' || tech.key === 'nestjs')) cat = 'backend';
      if (tech.category === 'database' || tech.category === 'auth') cat = 'backend';

      activeTechList.push({
        key: tech.key,
        name: known ? known.name : (tech.name || tech.key),
        version: tech.version || 'unknown',
        category: cat,
        brandColor: tech.brandColor || (known ? known.brandColor : '#ff5722')
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

  // Language color palette
  const langColors = {
    TypeScript: '#3178C6', JavaScript: '#F7DF1E', CSS: '#563D7C', HTML: '#E34C26',
    Python: '#3572A5', Shell: '#89E051', Go: '#00ADD8', Ruby: '#CC342D',
    Java: '#B07219', Rust: '#DEA584', 'C++': '#F34B7D', 'C#': '#178600',
    PHP: '#4F5D95', Swift: '#FFAC45', Kotlin: '#A97BFF', Markdown: '#083FA1',
    JSON: '#292929', YAML: '#CB171E', Prisma: '#5A67D8', GraphQL: '#E10098', SQL: '#E38C00'
  };

  const langBreakdown = (data.languageBreakdown || []).filter(l => l.percentage >= 0.5);

  return (
    <div id="view-stack" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', paddingRight: '8px' }}>
      <h2 style={{ fontSize: '32px', fontWeight: '700', color: 'var(--beige)' }}>Tech Stack Architecture</h2>
      <p style={{ color: 'var(--beige-3)', fontSize: '14px', marginTop: '4px', marginBottom: '24px' }}>
        Dynamic grouping of active dependencies into Backend and Frontend environments based on codebase usage.
      </p>

      {/* Language Breakdown Bar */}
      {langBreakdown.length > 0 && (
        <div style={{ background: 'var(--black-2)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px', marginBottom: '24px' }}>
          <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--beige-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>Languages</div>
          <div style={{ display: 'flex', height: '8px', borderRadius: '99px', overflow: 'hidden', gap: '2px', marginBottom: '16px' }}>
            {langBreakdown.map((l, i) => (
              <div key={i} style={{ width: `${l.percentage}%`, background: langColors[l.language] || '#888', minWidth: '3px' }} title={`${l.language} ${l.percentage}%`} />
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 20px' }}>
            {langBreakdown.map((l, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: langColors[l.language] || '#888', flexShrink: 0 }} />
                <span style={{ fontSize: '13px', color: 'var(--beige)', fontWeight: '600' }}>{l.language}</span>
                <span style={{ fontSize: '12px', color: 'var(--beige-3)' }}>{l.percentage}%</span>
              </div>
            ))}
          </div>
        </div>
      )}


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
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                                <span>{file.name}</span>
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

      {/* ── Pillar 2: Living System Specification ── */}
      {data?.systemSpec && (
        <div style={{ marginTop: '28px', borderTop: '1px solid var(--border)', paddingTop: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--beige)', margin: 0, letterSpacing: '0.02em' }}>
                System Specification
              </h3>
              <p style={{ fontSize: '11px', color: 'var(--beige-3)', margin: '4px 0 0 0' }}>
                Auto-generated living architecture spec from codebase analysis.
              </p>
            </div>
            <button
              onClick={() => window.open('/api/system-spec/markdown', '_blank')}
              style={{
                padding: '8px 14px', borderRadius: '8px', border: '1px solid #10B981',
                background: 'rgba(16,185,129,0.1)', color: '#10B981', fontSize: '11px',
                fontWeight: 700, cursor: 'pointer', fontFamily: '"Space Grotesk", sans-serif'
              }}
            >
              Export Markdown
            </button>
          </div>

          {/* API Endpoint Registry */}
          {data.systemSpec.apiEndpoints?.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#3B82F6', marginBottom: '8px' }}>
                API Endpoint Registry ({data.systemSpec.apiEndpoints.length})
              </div>
              <div style={{ background: 'var(--black-2)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--beige-3)', fontWeight: 600, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Methods</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--beige-3)', fontWeight: 600, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Route Path</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--beige-3)', fontWeight: 600, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Handler</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--beige-3)', fontWeight: 600, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Layer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.systemSpec.apiEndpoints.slice(0, 20).map((ep, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '6px 10px' }}>
                          {(ep.methods || ['GET']).map((m, mi) => (
                            <span key={mi} style={{ fontSize: '9px', padding: '1px 4px', borderRadius: '3px', marginRight: '3px', fontWeight: 700, fontFamily: '"Space Mono", monospace', background: m === 'GET' ? 'rgba(16,185,129,0.15)' : m === 'POST' ? 'rgba(59,130,246,0.15)' : m === 'PUT' ? 'rgba(234,179,8,0.15)' : 'rgba(239,68,68,0.15)', color: m === 'GET' ? '#10B981' : m === 'POST' ? '#3B82F6' : m === 'PUT' ? '#EAB308' : '#EF4444' }}>{m}</span>
                          ))}
                        </td>
                        <td style={{ padding: '6px 10px', color: 'var(--beige)', fontFamily: '"Space Mono", monospace' }}>{ep.path}</td>
                        <td style={{ padding: '6px 10px', color: 'var(--beige-3)', fontFamily: '"Space Mono", monospace', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ep.handlerFile || ep.handler || ''}</td>
                        <td style={{ padding: '6px 10px' }}>
                          <span style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '3px', background: 'rgba(139,92,246,0.15)', color: '#8B5CF6' }}>{ep.layer || 'Gateway'}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Env Variables */}
          {data.systemSpec.envVariables?.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#F59E0B', marginBottom: '8px' }}>
                Environment Variables Audit ({data.systemSpec.envVariables.length})
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '8px' }}>
                {data.systemSpec.envVariables.map((ev, i) => (
                  <div key={i} style={{
                    background: 'var(--black-2)', border: '1px solid var(--border)',
                    borderRadius: '8px', padding: '10px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--beige)', fontFamily: '"Space Mono", monospace' }}>{ev?.name || 'VAR'}</span>
                      <span style={{
                        fontSize: '8px', padding: '1px 5px', borderRadius: '3px', fontWeight: 700, textTransform: 'uppercase',
                        background: ev.status === 'missing' ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)',
                        color: ev.status === 'missing' ? '#EF4444' : '#10B981'
                      }}>
                        {ev.status}
                      </span>
                    </div>
                    <div style={{ fontSize: '9px', color: 'var(--beige-3)' }}>Used in {ev.fileCount} file(s)</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* External Dependencies */}
          {data.systemSpec.externalDependencies?.length > 0 && (
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#8B5CF6', marginBottom: '8px' }}>
                External Dependencies ({data.systemSpec.externalDependencies.length})
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {data.systemSpec.externalDependencies.slice(0, 30).map((dep, i) => (
                  <div key={i} style={{
                    background: 'var(--black-2)', border: '1px solid var(--border)', borderRadius: '6px',
                    padding: '5px 10px', display: 'flex', alignItems: 'center', gap: '6px'
                  }}>
                    <span style={{ fontSize: '11px', color: 'var(--beige)', fontWeight: 600 }}>{dep?.name || dep}</span>
                    <span style={{ fontSize: '8px', padding: '1px 4px', borderRadius: '3px', background: 'rgba(139,92,246,0.12)', color: '#8B5CF6', textTransform: 'uppercase', fontWeight: 600 }}>{dep.category}</span>
                    <span style={{ fontSize: '9px', color: 'var(--beige-3)' }}>{dep.usedInFileCount}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default TechStackView;

