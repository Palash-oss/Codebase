import React, { useState, useEffect } from 'react';

function DetailPanel({ file, files, onClose, onSelectFile, layout = 'sidebar', setImpactHighlight }) {
  if (!file) return null;

  const isComponentZone = file.type === 'component' || file.zone;

  const [impactData, setImpactData] = useState(null);
  const [impactLoading, setImpactLoading] = useState(false);
  const [directExpanded, setDirectExpanded] = useState(true);
  const [indirectExpanded, setIndirectExpanded] = useState(false);

  useEffect(() => {
    if (!file || isComponentZone || !file.relativePath) {
      setImpactData(null);
      setImpactLoading(false);
      if (setImpactHighlight) setImpactHighlight(null);
      return;
    }

    setImpactLoading(true);
    setImpactData(null);
    if (setImpactHighlight) setImpactHighlight(null);

    const controller = new AbortController();
    const signal = controller.signal;

    async function fetchImpact() {
      try {
        const res = await fetch('/api/impact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ relativePath: file.relativePath }),
          signal
        });
        if (!res.ok) throw new Error('Failed to load impact');
        const data = await res.json();
        setImpactData(data);
        setImpactLoading(false);
        
        const severityColors = {
          safe: '#22C55E',
          low: '#EAB308',
          medium: '#F97316',
          high: '#FF4D00',
          critical: '#EF4444'
        };
        
        if (setImpactHighlight) {
          setImpactHighlight({
            targetId: file.relativePath,
            affectedIds: new Set([...data.directImpact, ...data.indirectImpact]),
            severityColor: severityColors[data.severity] || '#8E8578'
          });
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error(err);
          setImpactLoading(false);
        }
      }
    }

    fetchImpact();

    return () => {
      controller.abort();
    };
  }, [file.relativePath, isComponentZone, setImpactHighlight]);

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

            {/* Impact Radar Section */}
            <div id="impact-radar-section" style={{ marginTop: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '20px' }}>
              <div className="detail-section-title">IMPACT RADAR</div>
              
              {impactLoading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0', color: 'var(--beige-3)', fontSize: '12px' }}>
                  <span className="inline-spinner" style={{ width: '12px', height: '12px', border: '2px solid var(--border-3)', borderTopColor: 'var(--orange)', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }}></span>
                  <span>calculating blast radius...</span>
                </div>
              )}

              {!impactLoading && impactData && (
                <>
                  {/* Severity Bar */}
                  <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--border)', borderRadius: '3px', overflow: 'hidden', marginTop: '12px', marginBottom: '8px' }}>
                    <div style={{ 
                      height: '100%', 
                      width: `${100 - impactData.safetyScore}%`, 
                      backgroundColor: 
                        impactData.severity === 'safe' ? '#22C55E' :
                        impactData.severity === 'low' ? '#EAB308' :
                        impactData.severity === 'medium' ? '#F97316' :
                        impactData.severity === 'high' ? '#FF4D00' : '#EF4444',
                      borderRadius: '3px',
                      transition: 'width 0.4s ease'
                    }}></div>
                  </div>

                  {/* Severity details row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ 
                      fontFamily: 'Space Grotesk', 
                      fontSize: '11px', 
                      fontWeight: '700', 
                      letterSpacing: '0.04em',
                      color: 
                        impactData.severity === 'safe' ? '#22C55E' :
                        impactData.severity === 'low' ? '#EAB308' :
                        impactData.severity === 'medium' ? '#F97316' :
                        impactData.severity === 'high' ? '#FF4D00' : '#EF4444',
                    }}>
                      {impactData.severity.toUpperCase()}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--beige-3)' }}>
                      {impactData.totalAffected} {impactData.totalAffected === 1 ? 'file' : 'files'} affected
                    </span>
                  </div>

                  {/* Safety Score label */}
                  <div style={{ fontFamily: 'Space Mono', fontSize: '11px', color: 'var(--beige-3)', marginBottom: '16px' }}>
                    Safety score: {impactData.safetyScore}%
                  </div>

                  {/* Impact content */}
                  {impactData.totalAffected === 0 ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--beige-3)', fontFamily: 'Space Grotesk', fontSize: '12px', padding: '8px 0' }}>
                      <span style={{ color: '#22C55E', fontWeight: 'bold' }}>✓</span>
                      Nothing imports this file. Safe to modify or delete.
                    </div>
                  ) : (
                    <>
                      {/* Direct Impact */}
                      <div style={{ marginBottom: '10px' }}>
                        <div 
                          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', padding: '4px 0' }}
                          onClick={() => setDirectExpanded(!directExpanded)}
                        >
                          <span style={{ fontFamily: 'Space Grotesk', fontSize: '11px', fontWeight: '600', color: 'var(--beige-2)' }}>
                            {directExpanded ? '▼' : '▶'} Direct impact ({impactData.directImpact.length})
                          </span>
                        </div>
                        {directExpanded && (
                          <div style={{ paddingLeft: '12px', marginTop: '4px' }}>
                            {impactData.directImpact.length === 0 ? (
                              <div style={{ fontSize: '11px', color: 'var(--beige-3)', fontStyle: 'italic' }}>No direct importers.</div>
                            ) : (
                              impactData.directImpact.map((path, idx) => {
                                const filename = path.split('/').pop();
                                const fileObj = files.find(f => f.relativePath === path) || { relativePath: path, name: filename, findings: [], imports: [], exports: [] };
                                return (
                                  <div key={idx} style={{ padding: '4px 0', borderBottom: '1px solid var(--border-2)' }}>
                                    <span 
                                      className="clickable" 
                                      style={{ fontFamily: 'Space Mono', fontSize: '11px', color: 'var(--orange)', cursor: 'pointer', display: 'block' }}
                                      onClick={() => onSelectFile(fileObj)}
                                    >
                                      {filename}
                                    </span>
                                    <span style={{ fontSize: '9px', color: 'var(--beige-3)', fontFamily: 'Space Mono', display: 'block', marginTop: '2px', wordBreak: 'break-all' }}>
                                      {path}
                                    </span>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>

                      {/* Indirect Impact */}
                      <div>
                        <div 
                          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', padding: '4px 0' }}
                          onClick={() => setIndirectExpanded(!indirectExpanded)}
                        >
                          <span style={{ fontFamily: 'Space Grotesk', fontSize: '11px', fontWeight: '600', color: 'var(--beige-2)' }}>
                            {indirectExpanded ? '▼' : '▶'} Indirect impact ({impactData.indirectImpact.length})
                          </span>
                        </div>
                        {indirectExpanded && (
                          <div style={{ paddingLeft: '12px', marginTop: '4px' }}>
                            {impactData.indirectImpact.length === 0 ? (
                              <div style={{ fontSize: '11px', color: 'var(--beige-3)', fontStyle: 'italic' }}>No indirect importers.</div>
                            ) : (
                              impactData.indirectImpact.map((path, idx) => {
                                const filename = path.split('/').pop();
                                const fileObj = files.find(f => f.relativePath === path) || { relativePath: path, name: filename, findings: [], imports: [], exports: [] };
                                return (
                                  <div key={idx} style={{ padding: '4px 0', borderBottom: '1px solid var(--border-2)' }}>
                                    <span 
                                      className="clickable" 
                                      style={{ fontFamily: 'Space Mono', fontSize: '11px', color: 'var(--beige-2)', cursor: 'pointer', display: 'block' }}
                                      onClick={() => onSelectFile(fileObj)}
                                    >
                                      {filename}
                                    </span>
                                    <span style={{ fontSize: '9px', color: 'var(--beige-3)', fontFamily: 'Space Mono', display: 'block', marginTop: '2px', wordBreak: 'break-all' }}>
                                      {path}
                                    </span>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}
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
