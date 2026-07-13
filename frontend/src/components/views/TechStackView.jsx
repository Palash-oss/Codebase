import React from 'react';

function TechStackView({ data, onSelectFile }) {
  const getTechLogoUrl = (logoKey) => {
    if (logoKey.startsWith('inline-') || logoKey === 'inline') {
      return '';
    }
    return `https://cdn.jsdelivr.net/gh/devicons/devicon/icons/${logoKey}/${logoKey}-original.svg`;
  };

  const getTechDesc = (tech) => {
    if (tech.category === 'framework') {
      return `${tech.name} serves as the primary system framework orchestrating route handling and layout compilation.`;
    }
    if (tech.category === 'database') {
      return `${tech.name} stores structural relational model entities and manages transactional reads/writes.`;
    }
    if (tech.category === 'auth') {
      return `${tech.name} manages identity authentication, secure session verification, and token operations.`;
    }
    if (tech.category === 'ui') {
      return `${tech.name} builds styling components, layout rules, and premium interface rendering.`;
    }
    return `${tech.name} provides system core capabilities for the ${tech.category} zone.`;
  };

  return (
    <div id="view-stack">
      <h2 style={{ fontSize: '32px', fontWeight: '700' }}>Tech Stack</h2>
      <p style={{ color: 'var(--beige-3)', fontSize: '14px', marginTop: '4px' }}>
        Detected frameworks, databases, libraries, and devops layers with detailed workspace contexts.
      </p>

      <div className="stack-grid" id="stack-grid-container">
        {data.stack.detected.map((tech, idx) => {
          const logoUrl = getTechLogoUrl(tech.logoKey);
          
          // Find project files referencing this stack's core library
          const mappedFiles = data.files.filter(f => {
            if (tech.category === 'framework' && (f.layer === 'Presentation' || f.layer === 'Gateway')) return true;
            if (tech.category === 'database' && f.layer === 'Persistence') return true;
            if (tech.category === 'auth' && f.layer === 'Interaction') return true;
            if (tech.category === 'ui' && f.layer === 'Presentation') return true;
            if (tech.category === 'state' && f.layer === 'Interaction') return true;
            // check direct import keyword matches
            return f.imports?.some(imp => imp.specifier.includes(tech.key) || imp.specifier.includes(tech.name.toLowerCase()));
          }).slice(0, 3);

          return (
            <div className="stack-card" key={idx}>
              <div className="stack-header-row">
                <div className="stack-logo-wrap" style={{ borderColor: tech.brandColor }}>
                  {logoUrl ? (
                    <>
                      <img 
                        src={logoUrl} 
                        alt=""
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextElementSibling.style.display = 'block';
                        }} 
                      />
                      <span className="stack-logo-fallback" style={{ display: 'none' }}>
                        {tech.name.slice(0, 2).toUpperCase()}
                      </span>
                    </>
                  ) : (
                    <span className="stack-logo-fallback">
                      {tech.name.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="stack-info">
                  <h3 className="stack-name">{tech.name}</h3>
                  <div className="stack-version">Version: {tech.version}</div>
                  <span className="stack-cat-badge">{tech.category}</span>
                </div>
              </div>
              
              <p className="stack-card-desc">{getTechDesc(tech)}</p>
              
              {mappedFiles.length > 0 && (
                <>
                  <div className="stack-card-files-title">Active Mapped Files</div>
                  {mappedFiles.map((f, fIdx) => (
                    <div 
                      className="stack-card-file-link" 
                      key={fIdx}
                      onClick={() => onSelectFile(f)}
                    >
                      ➔ {f.name}
                    </div>
                  ))}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default TechStackView;
