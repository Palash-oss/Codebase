import React from 'react';

function Navbar({ project, detectedStack, files, onNewAnalysis }) {
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
      // Clean backend state
      // Actually the backend stores latestAnalysisResult in memory, we can clear the frontend routing
      onNewAnalysis();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <header className="dashboard-navbar">
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

      <div className="nav-right" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        {errorCount === 0 && warningCount === 0 ? (
          <div className="findings-badge clean">✓ clean</div>
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
        <button className="btn-action" onClick={handleReset}>New analysis</button>
      </div>
    </header>
  );
}

export default Navbar;
