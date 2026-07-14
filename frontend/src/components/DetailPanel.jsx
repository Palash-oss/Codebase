import React from 'react';

function DetailPanel({ file, files, onClose, onSelectFile, layout = 'sidebar' }) {
  if (!file) return null;

  const isComponentZone = file.type === 'component' || file.zone;

  const layerColors = {
    Presentation: '#FF4D00',
    Interaction: '#A855F7',
    Gateway: '#3B82F6',
    Domain: '#06B6D4',
    Persistence: '#22C55E',
    Foundation: '#7A7268',
    Infrastructure: '#4B5563',
    Test: '#EAB308',
    Unknown: '#3A3A3A'
  };

  // If it is a zone component, collect files related to it
  let zoneFiles = [];
  let compData = null;
  if (isComponentZone) {
    compData = file.data || file;
    zoneFiles = files.filter(f => {
      if (compData.zone === 'frontend' && (f.layer === 'Presentation' || f.layer === 'Interaction')) return true;
      if (compData.zone === 'api' && f.layer === 'Gateway') return true;
      if (compData.zone === 'data' && f.layer === 'Persistence') return true;
      return false;
    });
  }

  // File variables
  const findings = file.findings || [];
  const imports = (file.imports || []).filter(i => i.resolvedPath);
  const exports_ = file.exports || [];
  const importedBy = files.filter(f => f.imports?.some(i => i.resolvedPath === file.relativePath));
  const envVars = file.envVars || [];

  const isInline = layout === 'inline';

  return (
    <div className={isInline ? "explorer-detail" : "detail-panel"} style={isInline ? {} : { transform: 'translateX(0)' }}>
      <div className={isInline ? "detail-header" : "panel-header"}>
        <h3 className="panel-title">{isComponentZone ? 'Component Zone' : 'File Detail'}</h3>
        <button className="btn-close" onClick={onClose}>×</button>
      </div>

      <div id="detail-content">
        {isComponentZone ? (
          /* Component Zone Details */
          <div style={{ padding: '0 8px 14px' }}>
            <h2 className="detail-title">{compData.name}</h2>
            <div className="detail-path" style={{ textTransform: 'uppercase', fontSize: '10px' }}>
              Zone: {compData.zone || 'system'}
            </div>
            <p style={{ fontSize: '13px', color: 'var(--beige-2)', lineHeight: '1.5', marginTop: '12px' }}>
              {compData.desc || 'System architecture layer component.'}
            </p>

            <div className="detail-section-title">Associated Files ({zoneFiles.length})</div>
            {zoneFiles.length === 0 ? (
              <div style={{ fontSize: '11px', color: 'var(--beige-3)' }}>No files mapped to this zone.</div>
            ) : (
              zoneFiles.map((zf, idx) => {
                const lc = layerColors[zf.layer] || '#888';
                return (
                  <div className="list-item-row" key={idx}>
                    <div className="list-item-left">
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: lc }}></span>
                      <span 
                        className="list-item-name clickable" 
                        onClick={() => onSelectFile(zf)}
                      >
                        {zf.name}
                      </span>
                    </div>
                    <span style={{ fontFamily: 'Space Mono', fontSize: '10px', color: 'var(--beige-3)' }}>
                      {zf.lines} lines
                    </span>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          /* Standard File Details */
          <div style={{ padding: '0 8px 14px' }}>
            <h2 className="detail-title">{file.name}</h2>
            <div className="detail-path">{file.relativePath}</div>
            
            <div className="detail-badges" style={{ marginBottom: '20px' }}>
              <span 
                className="pill-badge" 
                style={{ backgroundColor: layerColors[file.layer] || '#888', color: 'var(--black)' }}
              >
                {file.layer}
              </span>
              {file.apiRoute && (
                <span 
                  className="pill-badge" 
                  style={{ backgroundColor: 'var(--orange-dim)', border: '1px solid var(--orange-glow)', color: 'var(--orange)' }}
                >
                  API ROUTE
                </span>
              )}
            </div>

            {/* Stats Grid */}
            <div className="detail-grid" style={isInline ? {} : { gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
              <div className={isInline ? "detail-stat-card" : ""} style={isInline ? {} : { background: 'var(--black-3)', border: '1px solid var(--border)', borderRadius: '6px', padding: '10px 14px' }}>
                <div className={isInline ? "detail-stat-label" : ""} style={isInline ? {} : { fontFamily: 'Space Grotesk', fontSize: '10px', color: 'var(--beige-3)', fontWeight: '500', letterSpacing: '0.04em' }}>LINES</div>
                <div className={isInline ? "detail-stat-val" : ""} style={isInline ? {} : { fontFamily: 'Space Mono', fontSize: '20px', fontWeight: '700', color: 'var(--beige)', marginTop: '2px' }}>{file.lines}</div>
              </div>
              <div className={isInline ? "detail-stat-card" : ""} style={isInline ? {} : { background: 'var(--black-3)', border: '1px solid var(--border)', borderRadius: '6px', padding: '10px 14px' }}>
                <div className={isInline ? "detail-stat-label" : ""} style={isInline ? {} : { fontFamily: 'Space Grotesk', fontSize: '10px', color: 'var(--beige-3)', fontWeight: '500', letterSpacing: '0.04em' }}>EXPORTS</div>
                <div className={isInline ? "detail-stat-val" : ""} style={isInline ? {} : { fontFamily: 'Space Mono', fontSize: '20px', fontWeight: '700', color: 'var(--beige)', marginTop: '2px' }}>{exports_.length}</div>
              </div>
              <div className={isInline ? "detail-stat-card" : ""} style={isInline ? {} : { background: 'var(--black-3)', border: '1px solid var(--border)', borderRadius: '6px', padding: '10px 14px' }}>
                <div className={isInline ? "detail-stat-label" : ""} style={isInline ? {} : { fontFamily: 'Space Grotesk', fontSize: '10px', color: 'var(--beige-3)', fontWeight: '500', letterSpacing: '0.04em' }}>IMPORTS IN</div>
                <div className={isInline ? "detail-stat-val" : ""} style={isInline ? {} : { fontFamily: 'Space Mono', fontSize: '20px', fontWeight: '700', color: 'var(--beige)', marginTop: '2px' }}>{file.incomingCount}</div>
              </div>
              <div className={isInline ? "detail-stat-card" : ""} style={isInline ? {} : { background: 'var(--black-3)', border: '1px solid var(--border)', borderRadius: '6px', padding: '10px 14px' }}>
                <div className={isInline ? "detail-stat-label" : ""} style={isInline ? {} : { fontFamily: 'Space Grotesk', fontSize: '10px', color: 'var(--beige-3)', fontWeight: '500', letterSpacing: '0.04em' }}>IMPORTS OUT</div>
                <div className={isInline ? "detail-stat-val" : ""} style={isInline ? {} : { fontFamily: 'Space Mono', fontSize: '20px', fontWeight: '700', color: 'var(--beige)', marginTop: '2px' }}>{file.outgoingCount}</div>
              </div>
            </div>

            {/* Findings/Issues */}
            {findings.length > 0 && (
              <>
                <div className="detail-section-title" style={{ color: '#FF4D00' }}>ISSUES ({findings.length})</div>
                <div className="issues-list">
                  {findings.map((fin, idx) => (
                    <div className={`issue-item ${fin.type === 'warning' ? 'warning' : ''}`} key={idx}>
                      <div className="issue-header">
                        <span className="issue-rule">{fin.rule || 'issue'}</span>
                        <span style={{ fontFamily: 'Space Mono', fontSize: '10px', color: fin.type === 'error' ? 'var(--orange)' : '#EAB308' }}>
                          {fin.type}
                        </span>
                      </div>
                      <div className="issue-msg">{fin.message}</div>
                      {fin.suggestion && <div className="issue-sugg">{fin.suggestion}</div>}
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Imports Section */}
            <div className="detail-section-title">IMPORTS FROM ({imports.length})</div>
            {imports.length === 0 ? (
              <div style={{ fontFamily: 'Space Grotesk', fontSize: '11px', color: 'var(--beige-3)' }}>No resolved imports.</div>
            ) : (
              imports.map((imp, idx) => {
                const targetFile = files.find(f => f.relativePath === imp.resolvedPath);
                const lc = layerColors[targetFile?.layer] || '#888';
                return (
                  <div className="list-item-row" key={idx}>
                    <div className="list-item-left">
                      <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: lc, flexShrink: 0 }}></span>
                      <span 
                        className="list-item-name clickable" 
                        onClick={() => onSelectFile(targetFile || { relativePath: imp.resolvedPath, name: imp.specifier, findings: [], imports: [], exports: [] })}
                      >
                        {imp.resolvedPath || imp.specifier}
                      </span>
                    </div>
                    <span style={{ fontFamily: 'Space Mono', fontSize: '9px', color: 'var(--beige-3)', background: 'var(--black-3)', border: '1px solid var(--border)', borderRadius: '3px', padding: '1px 5px', flexShrink: 0 }}>
                      {imp.kind || 'static'}
                    </span>
                  </div>
                );
              })
            )}

            {/* Exports Section */}
            <div className="detail-section-title">EXPORTS ({exports_.length})</div>
            {exports_.length === 0 ? (
              <div style={{ fontFamily: 'Space Grotesk', fontSize: '11px', color: 'var(--beige-3)' }}>No exports.</div>
            ) : (
              exports_.map((exp, idx) => {
                const usedBy = files.filter(f => f.imports?.some(i => i.resolvedPath === file.relativePath && i.importedNames?.includes(exp.name))).length;
                return (
                  <div className="list-item-row" key={idx}>
                    <span style={{ fontFamily: 'Space Mono', fontSize: '11px', color: 'var(--beige)', flex: 1 }}>{exp.name}</span>
                    <span style={{ fontFamily: 'Space Mono', fontSize: '9px', color: 'var(--beige-3)', background: 'var(--black-3)', border: '1px solid var(--border)', borderRadius: '3px', padding: '1px 5px', marginRight: '6px' }}>
                      {exp.kind || 'fn'}
                    </span>
                    <span style={{ fontFamily: 'Space Mono', fontSize: '9px', color: usedBy === 0 ? '#EAB308' : 'var(--beige-3)' }}>
                      used by {usedBy}
                    </span>
                  </div>
                );
              })
            )}

            {/* Imported By Section */}
            <div className="detail-section-title">IMPORTED BY ({importedBy.length})</div>
            {importedBy.length === 0 ? (
              <div style={{ fontFamily: 'Space Grotesk', fontSize: '11px', color: 'var(--beige-3)' }}>Nothing imports this file.</div>
            ) : (
              importedBy.map((imp, idx) => {
                const lc = layerColors[imp.layer] || '#888';
                return (
                  <div className="list-item-row" key={idx}>
                    <div className="list-item-left">
                      <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: lc, flexShrink: 0 }}></span>
                      <span 
                        className="list-item-name clickable" 
                        onClick={() => onSelectFile(imp)}
                      >
                        {imp.relativePath}
                      </span>
                    </div>
                  </div>
                );
              })
            )}

            {/* Environment Variables */}
            {envVars.length > 0 && (
              <>
                <div className="detail-section-title">ENV VARIABLES ({envVars.length})</div>
                {envVars.map((ev, idx) => (
                  <div className="list-item-row" key={idx}>
                    <span style={{ fontFamily: 'Space Mono', fontSize: '11px', color: '#EAB308', flex: 1 }}>{ev}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default DetailPanel;
