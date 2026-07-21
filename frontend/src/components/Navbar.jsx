import React from 'react';
import Toast from './Toast';

function Navbar({ project, detectedStack, files, data, onNewAnalysis }) {
  // Count error/warning findings
  let errorCount = 0;
  let warningCount = 0;

  files.forEach(f => {
    if (f.findings) {
      f.findings.forEach(fin => {
        if (fin.type === 'error') errorCount++;
        if (fin.type === 'warning') warningCount++;
      });
    }
  });

  const getTechLogoUrl = (logoKey) => {
    if (logoKey.startsWith('inline-') || logoKey === 'inline') {
      return '';
    }
    return `https://cdn.jsdelivr.net/gh/devicons/devicon/icons/${logoKey}/${logoKey}-original.svg`;
  };

  const first6 = detectedStack.slice(0, 6);
  const moreCount = detectedStack.length - 6;

  const handleReset = async () => {
    try {
      // Clean backend state on the server
      await fetch('/api/reset', { method: 'POST' });
      onNewAnalysis();
    } catch (e) {
      console.error(e);
    }
  };

  const [showPrGuardModal, setShowPrGuardModal] = React.useState(false);
  const [showExportModal, setShowExportModal] = React.useState(false);
  const [mermaidCode, setMermaidCode] = React.useState('');
  const [ghActionYaml, setGhActionYaml] = React.useState('');
  const [toastMsg, setToastMsg] = React.useState('');

  const handleFetchGhAction = async () => {
    try {
      const res = await fetch('/api/generate-gh-action');
      const resData = await res.json();
      setGhActionYaml(resData.content || '');
      setShowPrGuardModal(true);
    } catch (e) {
      console.error(e);
    }
  };

  const handleExportMermaid = async () => {
    try {
      const res = await fetch('/api/export-mermaid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodes: data?.graph?.nodes || [],
          edges: data?.graph?.edges || [],
          files: files
        })
      });
      const resData = await res.json();
      setMermaidCode(resData.mermaid || '');
      setShowExportModal(true);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <header className="dashboard-navbar">
      <Toast message={toastMsg} onClose={() => setToastMsg('')} />
      <div className="nav-left">
        <div className="wordmark" style={{ fontSize: '11px', letterSpacing: '0.2em' }}>
          <span className="first">CODEBASE</span> <span className="second">X-RAY</span>
        </div>
        <span className="separator">·</span>
        <div className="project-name">{project.name}</div>
        <span className="file-count">{project.totalFiles} files</span>
      </div>

      <div className="nav-middle">
        {first6.map((tech, index) => {
          const logoUrl = getTechLogoUrl(tech.logoKey);
          return (
            <div className="tech-pill" key={index}>
              <img 
                className="tech-pill-logo" 
                src={logoUrl} 
                alt="" 
                onError={(e) => {
                  e.target.src = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6" fill="%23${tech.brandColor.replace('#', '')}"/></svg>`;
                }}
              />
              <span>{tech.name}</span>
            </div>
          );
        })}
        {moreCount > 0 && (
          <div className="tech-pill">
            <span>+{moreCount} more</span>
          </div>
        )}
      </div>

      <div className="nav-right" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        {errorCount === 0 && warningCount === 0 ? (
          <div className="findings-badge clean" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            <span>clean</span>
          </div>
        ) : (
          <>
            {errorCount > 0 && (
              <div className="findings-badge errors">{errorCount} error{errorCount > 1 ? 's' : ''}</div>
            )}
            {warningCount > 0 && (
              <div className="findings-badge warnings">{warningCount} warning{warningCount > 1 ? 's' : ''}</div>
            )}
          </>
        )}

        <button 
          className="btn-liquid"
          style={{ background: 'var(--black-3)', border: '1px solid var(--border-2)', color: 'var(--beige)', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          onClick={handleExportMermaid}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          <span>Export Docs</span>
        </button>

        <button 
          className="btn-liquid"
          style={{ background: 'var(--black-3)', border: '1px solid var(--border-2)', color: 'var(--beige)', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          onClick={handleFetchGhAction}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          <span>PR Guard</span>
        </button>

        <button className="btn-action btn-liquid" onClick={handleReset}>New analysis</button>
      </div>

      {/* GitHub PR Guard Modal */}
      {showPrGuardModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--black-2)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px', maxWidth: '600px', width: '90%', color: 'var(--beige)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--orange)', marginBottom: '8px' }}>GitHub PR Architecture Guard Workflow</h3>
            <p style={{ fontSize: '12px', color: 'var(--beige-2)', marginBottom: '16px' }}>Copy this YAML workflow file to <code>.github/workflows/codebase-xray-guard.yml</code> in your repository to automatically block PRs that introduce circular dependencies or missing environment variables.</p>
            <pre style={{ background: 'var(--black-3)', border: '1px solid var(--border-2)', padding: '16px', borderRadius: '8px', fontSize: '11px', overflowX: 'auto', maxHeight: '250px', fontFamily: '"Space Mono", monospace' }}>
              {ghActionYaml}
            </pre>
            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <button 
                className="btn-liquid"
                onClick={() => { navigator.clipboard.writeText(ghActionYaml); setToastMsg('Copied GitHub Workflow YAML to clipboard!'); }}
                style={{ flex: 1, background: 'var(--orange)', color: '#fff', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                <span>Copy Workflow YAML</span>
              </button>
              <button 
                onClick={() => setShowPrGuardModal(false)}
                style={{ background: 'var(--black-3)', color: 'var(--beige)', border: '1px solid var(--border)', padding: '10px 16px', borderRadius: '6px', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Mermaid / Docs Modal */}
      {showExportModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--black-2)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px', maxWidth: '600px', width: '90%', color: 'var(--beige)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--orange)', marginBottom: '8px' }}>Export Architecture Documentation</h3>
            <p style={{ fontSize: '12px', color: 'var(--beige-2)', marginBottom: '16px' }}>Copy the generated <code>Mermaid.js</code> diagram syntax below to paste directly into GitHub READMEs, Notion, or Confluence pages.</p>
            <pre style={{ background: 'var(--black-3)', border: '1px solid var(--border-2)', padding: '16px', borderRadius: '8px', fontSize: '11px', overflowX: 'auto', maxHeight: '250px', fontFamily: '"Space Mono", monospace' }}>
              {mermaidCode}
            </pre>
            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <button 
                className="btn-liquid"
                onClick={() => { navigator.clipboard.writeText(mermaidCode); setToastMsg('Copied Mermaid syntax to clipboard!'); }}
                style={{ flex: 1, background: 'var(--orange)', color: '#fff', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                <span>Copy Mermaid Syntax</span>
              </button>
              <button 
                onClick={() => setShowExportModal(false)}
                style={{ background: 'var(--black-3)', color: 'var(--beige)', border: '1px solid var(--border)', padding: '10px 16px', borderRadius: '6px', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

export default Navbar;
