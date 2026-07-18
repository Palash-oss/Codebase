import React, { useState, useEffect } from 'react';

const LAYER_COLORS = {
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

function BlastRadiusView({ DATA, selectedFile, onFileSelect, onHighlight }) {
  const [blastData, setBlastData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [directExpanded, setDirectExpanded] = useState(true);
  const [indirectExpanded, setIndirectExpanded] = useState(false);

  useEffect(() => {
    if (!selectedFile || !selectedFile.relativePath) {
      setBlastData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setBlastData(null);

    const controller = new AbortController();
    const signal = controller.signal;

    async function fetchBlastRadius() {
      try {
        const response = await fetch('/api/blast-radius', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ relativePath: selectedFile.relativePath }),
          signal
        });
        if (!response.ok) {
          throw new Error('Failed to fetch blast radius');
        }
        const data = await response.json();
        setBlastData(data);
        setLoading(false);
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('[X-RAY] Error fetching blast radius:', err);
          setLoading(false);
        }
      }
    }

    fetchBlastRadius();

    return () => {
      controller.abort();
    };
  }, [selectedFile]);

  // State A: No file selected
  if (!selectedFile) {
    const highImpactFiles = DATA?.files
      ? [...DATA.files]
          .filter(f => f.incomingCount > 0)
          .sort((a, b) => b.incomingCount - a.incomingCount)
          .slice(0, 5)
      : [];

    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--black)', padding: '24px' }}>
        <svg viewBox="0 0 24 24" style={{ width: '40px', height: '40px', stroke: 'var(--beige-3)', fill: 'none', strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round', marginBottom: '16px' }}>
          <circle cx="12" cy="12" r="10" />
          <line x1="22" y1="12" x2="18" y2="12" />
          <line x1="6" y1="12" x2="2" y2="12" />
          <line x1="12" y1="6" x2="12" y2="2" />
          <line x1="12" y1="22" x2="12" y2="18" />
        </svg>
        <h3 style={{ fontFamily: 'Space Grotesk', fontSize: '16px', color: 'var(--beige-3)', fontWeight: '600', margin: '0 0 6px 0' }}>Select any file</h3>
        <p style={{ fontFamily: 'Space Grotesk', fontSize: '13px', color: 'var(--beige-3)', margin: '0 0 16px 0', textAlign: 'center' }}>
          See what breaks if you change or delete it.
        </p>
        <div style={{ 
          background: 'var(--black-3)', 
          border: '1px solid var(--border-2)', 
          borderRadius: '8px', 
          padding: '14px 16px',
          maxWidth: '280px',
          textAlign: 'left',
          marginBottom: '24px'
        }}>
          <div style={{ fontFamily: 'Space Grotesk', fontSize: '11px', color: 'var(--beige-3)', lineHeight: 1.6 }}>
            <div style={{ marginBottom: '6px' }}>① Go to <span style={{ color: 'var(--orange)', fontWeight: 600 }}>Explorer</span> tab</div>
            <div style={{ marginBottom: '6px' }}>② Click any file in the tree</div>
            <div>③ Return here to see its blast radius</div>
          </div>
        </div>

        {highImpactFiles.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: '320px' }}>
            <div style={{ fontFamily: 'Space Grotesk', fontSize: '12px', fontWeight: 600, color: 'var(--beige-2)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Suggested High-Impact Files:
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
              {highImpactFiles.map(f => (
                <div
                  key={f.relativePath}
                  onClick={() => onFileSelect(f)}
                  style={{
                    backgroundColor: 'var(--black-2)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    transition: 'border-color 0.2s, background-color 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--orange)';
                    e.currentTarget.style.backgroundColor = 'var(--black-3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.backgroundColor = 'var(--black-2)';
                  }}
                >
                  <span style={{ fontFamily: 'Space Mono', fontSize: '11px', color: 'var(--orange)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>
                    {f.name}
                  </span>
                  <span style={{ fontFamily: 'Space Mono', fontSize: '10px', color: 'var(--beige-3)' }}>
                    {f.incomingCount} imports
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--black)', padding: '24px' }}>
        <div className="inline-spinner" style={{ width: '24px', height: '24px', border: '3px solid var(--border-3)', borderTopColor: 'var(--orange)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginBottom: '16px' }}></div>
        <p style={{ fontFamily: 'Space Grotesk', fontSize: '13px', color: 'var(--beige-3)', margin: 0 }}>Calculating blast radius...</p>
      </div>
    );
  }

  if (!blastData) return null;

  const severityColors = {
    safe: '#22C55E',
    low: '#EAB308',
    medium: '#F97316',
    high: '#FF4D00',
    critical: '#EF4444'
  };

  const severityColor = severityColors[blastData.severity] || '#8E8578';
  const layerColor = LAYER_COLORS[selectedFile.layer] || '#8E8578';

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--black)', position: 'relative' }}>
      {/* Scrollable View Content */}
      <div style={{ flexGrow: 1, overflowY: 'auto', padding: '24px 24px 100px 24px' }}>
        
        {/* Top File Card */}
        <div style={{ backgroundColor: 'var(--black-3)', border: '1px solid var(--border-2)', borderRadius: '8px', padding: '16px 20px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
            <span style={{ fontFamily: 'Space Grotesk', fontSize: '15px', fontWeight: '600', color: 'var(--beige)', wordBreak: 'break-all' }}>{selectedFile.name}</span>
            <span style={{ 
              fontFamily: 'Space Mono', 
              fontSize: '9px', 
              fontWeight: '700', 
              backgroundColor: layerColor + '15', 
              color: layerColor, 
              border: `1px solid ${layerColor}33`,
              borderRadius: '4px',
              padding: '2px 6px',
              marginLeft: '8px',
              textTransform: 'uppercase'
            }}>{selectedFile.layer || 'Unknown'}</span>
          </div>
          <div style={{ fontFamily: 'Space Mono', fontSize: '10px', color: 'var(--beige-3)', wordBreak: 'break-all', marginBottom: '16px' }}>{selectedFile.relativePath}</div>
          
          {/* Stats boxes */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
            <div style={{ textAlign: 'center', background: 'var(--black-2)', borderRadius: '6px', border: '1px solid var(--border)', padding: '10px 4px' }}>
              <div style={{ fontFamily: 'Space Mono', fontSize: '20px', fontWeight: '700', color: 'var(--beige)' }}>{blastData.directImpact.length}</div>
              <div style={{ fontFamily: 'Space Grotesk', fontSize: '10px', color: 'var(--beige-3)', marginTop: '2px' }}>Direct impact</div>
            </div>
            <div style={{ textAlign: 'center', background: 'var(--black-2)', borderRadius: '6px', border: '1px solid var(--border)', padding: '10px 4px' }}>
              <div style={{ fontFamily: 'Space Mono', fontSize: '20px', fontWeight: '700', color: 'var(--beige)' }}>{blastData.indirectImpact.length}</div>
              <div style={{ fontFamily: 'Space Grotesk', fontSize: '10px', color: 'var(--beige-3)', marginTop: '2px' }}>Indirect impact</div>
            </div>
            <div style={{ textAlign: 'center', background: 'var(--black-2)', borderRadius: '6px', border: '1px solid var(--border)', padding: '10px 4px' }}>
              <div style={{ fontFamily: 'Space Mono', fontSize: '20px', fontWeight: '700', color: 'var(--beige)' }}>{blastData.totalAffected}</div>
              <div style={{ fontFamily: 'Space Grotesk', fontSize: '10px', color: 'var(--beige-3)', marginTop: '2px' }}>Total affected</div>
            </div>
          </div>
        </div>

        {/* Severity Bar */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ width: '100%', height: '8px', borderRadius: '4px', backgroundColor: 'var(--border)', overflow: 'hidden', marginBottom: '8px' }}>
            <div style={{ 
              height: '100%', 
              width: `${100 - blastData.safetyScore}%`, 
              backgroundColor: severityColor,
              borderRadius: '4px',
              transition: 'width 0.6s ease'
            }}></div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: 'Space Mono', fontSize: '11px', fontWeight: '700', letterSpacing: '0.1em', color: severityColor }}>{blastData.severity.toUpperCase()}</span>
            <span style={{ fontFamily: 'Space Mono', fontSize: '11px', color: 'var(--beige-3)' }}>Safety score: {blastData.safetyScore}%</span>
          </div>
        </div>

        {/* Plain English Summary */}
        <div style={{ 
          background: 'var(--black-3)', 
          border: `1px solid ${severityColor}22`,
          borderLeft: `3px solid ${severityColor}`,
          borderRadius: '6px', 
          padding: '12px 16px',
          marginBottom: '20px',
          fontFamily: 'Space Grotesk',
          fontSize: '12px',
          color: 'var(--beige-2)',
          lineHeight: 1.6
        }}>
          {blastData.directImpact.length === 0 
            ? `✓ Nothing in this project imports ${selectedFile.name}. Safe to modify or delete.`
            : blastData.severity === 'critical' || blastData.severity === 'high'
            ? `⚠ Changing ${selectedFile.name} will break ${blastData.directImpact.length} file${blastData.directImpact.length > 1 ? 's' : ''} that directly import it, and cascade through ${blastData.indirectImpact.length} more. Refactor carefully.`
            : blastData.severity === 'medium'
            ? `Changing ${selectedFile.name} affects ${blastData.directImpact.length} direct import${blastData.directImpact.length > 1 ? 's' : ''}. Review those files after any change.`
            : `Low risk. Only ${blastData.directImpact.length} file${blastData.directImpact.length > 1 ? 's' : ''} depend on ${selectedFile.name}.`
          }
        </div>

        {/* Expandable Sections */}
        {/* Direct Impact Section */}
        <div style={{ marginBottom: '16px' }}>
          <div 
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', padding: '6px 0', borderBottom: '1px solid var(--border-2)', marginBottom: '8px' }}
            onClick={() => setDirectExpanded(!directExpanded)}
          >
            <span style={{ fontFamily: 'Space Grotesk', fontSize: '12px', fontWeight: '600', color: 'var(--beige)', letterSpacing: '0.04em' }}>
              {directExpanded ? '▼' : '▶'} DIRECT IMPACT — {blastData.directImpact.length} FILES
            </span>
          </div>
          {directExpanded && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {blastData.directImpact.length === 0 ? (
                <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--beige-3)', fontFamily: 'Space Grotesk', fontSize: '12px' }}>
                  <span style={{ color: '#22C55E', fontWeight: 'bold' }}>✓</span>
                  Nothing imports this file.
                </div>
              ) : (
                blastData.directImpact.map((path) => {
                  const filename = path.split('/').pop();
                  const fileObj = DATA.files.find(f => f.relativePath === path) || { relativePath: path, name: filename, layer: 'Unknown' };
                  const dotColor = LAYER_COLORS[fileObj.layer] || '#8E8578';
                  return (
                    <div 
                      key={path} 
                      style={{ display: 'flex', alignItems: 'center', height: '36px', padding: '0 16px', borderRadius: '4px', transition: 'background 0.2s', cursor: 'default' }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--black-3)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: dotColor, marginRight: '10px', flexShrink: 0 }} />
                      <div style={{ flexGrow: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <span 
                          style={{ fontFamily: 'Space Mono', fontSize: '11px', color: 'var(--orange)', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          onClick={() => onFileSelect(fileObj)}
                        >
                          {filename}
                        </span>
                        <span style={{ fontFamily: 'Space Grotesk', fontSize: '9px', color: 'var(--beige-3)' }}>
                          imports {selectedFile.name} directly
                        </span>
                        <span style={{ fontFamily: 'Space Grotesk', fontSize: '9px', color: 'var(--beige-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {path}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Indirect Impact Section */}
        <div>
          <div 
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', padding: '6px 0', borderBottom: '1px solid var(--border-2)', marginBottom: '8px' }}
            onClick={() => setIndirectExpanded(!indirectExpanded)}
          >
            <span style={{ fontFamily: 'Space Grotesk', fontSize: '12px', fontWeight: '600', color: 'var(--beige)', letterSpacing: '0.04em' }}>
              {indirectExpanded ? '▼' : '▶'} INDIRECT IMPACT — {blastData.indirectImpact.length} FILES
            </span>
          </div>
          {indirectExpanded && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {blastData.indirectImpact.length === 0 ? (
                <div style={{ padding: '12px 16px', color: 'var(--beige-3)', fontFamily: 'Space Grotesk', fontSize: '12px' }}>
                  No indirect impacts found.
                </div>
              ) : (
                <>
                  {blastData.indirectImpact.map((path) => {
                    const filename = path.split('/').pop();
                    const fileObj = DATA.files.find(f => f.relativePath === path) || { relativePath: path, name: filename, layer: 'Unknown' };
                    const dotColor = LAYER_COLORS[fileObj.layer] || '#8E8578';
                    return (
                      <div 
                        key={path} 
                        style={{ display: 'flex', alignItems: 'center', height: '36px', padding: '0 16px', borderRadius: '4px', transition: 'background 0.2s', cursor: 'default' }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--black-3)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                      >
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--beige-2)', marginRight: '10px', flexShrink: 0 }} />
                        <div style={{ flexGrow: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                          <span 
                            style={{ fontFamily: 'Space Mono', fontSize: '11px', color: 'var(--beige-2)', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            onClick={() => onFileSelect(fileObj)}
                          >
                            {filename}
                          </span>
                          <span style={{ fontFamily: 'Space Grotesk', fontSize: '9px', color: 'var(--beige-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {path}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  {blastData.indirectImpact.length >= 30 && (
                    <div style={{ fontFamily: 'Space Grotesk', fontSize: '11px', color: 'var(--beige-3)', padding: '8px 16px', fontStyle: 'italic' }}>
                      + more files (capped at 30)
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

      </div>

      {/* Bottom Fixed Action Bar */}
      <div style={{ 
        position: 'absolute', 
        bottom: 0, 
        left: 0, 
        right: 0, 
        height: '76px', 
        backgroundColor: 'var(--black-2)', 
        borderTop: '1px solid var(--border)', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        padding: '0 24px',
        zIndex: 5
      }}>
        <button 
          style={{ 
            backgroundColor: 'var(--orange)', 
            color: 'var(--black)', 
            border: 'none', 
            borderRadius: '4px', 
            padding: '10px 20px', 
            fontFamily: 'Space Grotesk', 
            fontSize: '13px', 
            fontWeight: '600', 
            cursor: 'pointer',
            width: '100%',
            transition: 'opacity 0.2s'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '1.0'; }}
          onClick={() => {
            const severityColors = {
              safe: '#22C55E',
              low: '#EAB308',
              medium: '#F97316',
              high: '#FF4D00',
              critical: '#EF4444'
            };

            const severityColor = severityColors[blastData.severity] || '#8E8578';
            const affected = new Set([...(blastData.directImpact || []), ...(blastData.indirectImpact || [])]);

            onHighlight({
              targetId: blastData.targetPath,
              affectedIds: affected,
              severityColor,
              directImpact: blastData.directImpact,
              indirectImpact: blastData.indirectImpact,
              safetyScore: blastData.safetyScore,
              severity: blastData.severity
            });
          }}
        >
          Highlight on graph →
        </button>
      </div>
    </div>
  );
}

export default BlastRadiusView;
