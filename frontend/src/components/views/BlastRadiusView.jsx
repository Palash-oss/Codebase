import React, { useState, useEffect } from 'react';

const LAYER_COLORS = {
  Presentation: '#10B981',
  Interaction: '#FFFFFF',
  Gateway: 'rgba(255,255,255,0.8)',
  Domain: 'rgba(255,255,255,0.65)',
  Persistence: 'rgba(255,255,255,0.5)',
  Foundation: 'rgba(255,255,255,0.4)',
  Infrastructure: 'rgba(255,255,255,0.3)',
  Test: 'rgba(255,255,255,0.25)',
  Unknown: 'rgba(255,255,255,0.15)'
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
          body: JSON.stringify({ 
            relativePath: selectedFile.relativePath,
            nodes: DATA?.graph?.nodes,
            edges: DATA?.graph?.edges
          }),
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
          console.warn('[X-RAY] API blast radius error. Computing locally fallback:', err.message);
          const fallbackData = computeClientBlast(selectedFile.relativePath, DATA?.files, DATA?.graph);
          setBlastData(fallbackData);
          setLoading(false);
        }
      }
    }

    function computeClientBlast(targetPath, files, graph) {
      const nodes = graph?.nodes || (files ? files.map(f => ({ id: f.relativePath || f.path, layer: f.layer })) : []);
      const edges = graph?.edges || [];

      const reverseMap = new Map();
      nodes.forEach(n => reverseMap.set(n.id, []));
      edges.forEach(e => {
        if (reverseMap.has(e.target)) {
          reverseMap.get(e.target).push(e.source);
        }
      });

      let directImpact = reverseMap.get(targetPath) || [];
      if (directImpact.length === 0 && files) {
        directImpact = files.filter(f => 
          (f.imports && f.imports.includes(targetPath)) || 
          (f.dependencies && f.dependencies.includes(targetPath))
        ).map(f => f.relativePath || f.path);
      }

      const directSet = new Set(directImpact);
      const indirectSet = new Set();
      directImpact.forEach(dFile => {
        const importers = reverseMap.get(dFile) || [];
        importers.forEach(f => {
          if (f !== targetPath && !directSet.has(f)) {
            indirectSet.add(f);
          }
        });
      });

      const indirectImpact = [...indirectSet].slice(0, 20);
      const totalAffected = directImpact.length + indirectImpact.length;
      const safetyScore = Math.round(Math.max(0, 100 - (totalAffected / Math.max(nodes.length, 1)) * 100));
      let severity = 'safe';
      if (safetyScore < 25) severity = 'critical';
      else if (safetyScore < 50) severity = 'high';
      else if (safetyScore < 70) severity = 'medium';
      else if (safetyScore < 90) severity = 'low';

      return { targetPath, directImpact, indirectImpact, totalAffected, safetyScore, severity };
    }

    fetchBlastRadius();

    return () => {
      controller.abort();
    };
  }, [selectedFile, DATA]);

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
        <svg viewBox="0 0 24 24" style={{ width: '36px', height: '36px', stroke: 'var(--orange)', fill: 'none', strokeWidth: '1.8', strokeLinecap: 'round', strokeLinejoin: 'round', marginBottom: '16px' }}>
          <circle cx="12" cy="12" r="10" />
          <line x1="22" y1="12" x2="18" y2="12" />
          <line x1="6" y1="12" x2="2" y2="12" />
          <line x1="12" y1="6" x2="12" y2="2" />
          <line x1="12" y1="22" x2="12" y2="18" />
        </svg>
        <h3 style={{ fontFamily: 'Space Grotesk', fontSize: '15px', color: 'var(--beige)', fontWeight: '600', margin: '0 0 6px 0', letterSpacing: '0.02em' }}>
          PULL REQUEST BLAST RADIUS ANALYSIS
        </h3>
        <p style={{ fontFamily: 'Space Grotesk', fontSize: '13px', color: 'var(--beige-3)', margin: '0 0 20px 0', textAlign: 'center', maxWidth: '380px', lineHeight: 1.5 }}>
          Select a file from the explorer or choose a high-impact core module below to calculate downstream breaking changes and regression risks.
        </p>

        {highImpactFiles.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: '340px' }}>
            <div style={{ fontFamily: 'Space Mono', fontSize: '10px', fontWeight: 700, color: 'var(--beige-3)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              HIGH-IMPACT MODULE CANDIDATES
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
              {highImpactFiles.map(f => (
                <div
                  key={f.relativePath}
                  onClick={() => onFileSelect(f)}
                  style={{
                    backgroundColor: 'var(--black-3)',
                    border: '1px solid var(--border-2)',
                    borderRadius: '6px',
                    padding: '10px 14px',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    transition: 'border-color 0.2s, background-color 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--orange)';
                    e.currentTarget.style.backgroundColor = 'var(--black-2)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-2)';
                    e.currentTarget.style.backgroundColor = 'var(--black-3)';
                  }}
                >
                  <span style={{ fontFamily: 'Space Mono', fontSize: '11px', color: 'var(--orange)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '210px' }}>
                    {f.name || (f.relativePath ? f.relativePath.split('/').pop() : 'File')}
                  </span>
                  <span style={{ fontFamily: 'Space Mono', fontSize: '10px', color: 'var(--beige-3)', background: 'var(--black-2)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border)' }}>
                    {f.incomingCount} dependents
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
        <p style={{ fontFamily: 'Space Grotesk', fontSize: '13px', color: 'var(--beige-3)', margin: 0 }}>Computing AST dependency graph blast radius...</p>
      </div>
    );
  }

  if (!blastData) return null;

  const severityColors = {
    safe: '#10B981',
    low: 'rgba(255,255,255,0.55)',
    medium: 'rgba(255,255,255,0.75)',
    high: '#FFFFFF',
    critical: '#FFFFFF'
  };

  const severityColor = severityColors[blastData.severity] || '#8E8578';
  const layerColor = LAYER_COLORS[selectedFile.layer] || '#8E8578';

  // Compute test suites affected
  const testFiles = (DATA?.files || []).filter(f => {
    const fn = f.name || f.relativePath || '';
    return (f.layer === 'Test' || fn.includes('.test.') || fn.includes('.spec.')) &&
      (blastData.directImpact.includes(f.relativePath) || blastData.indirectImpact.includes(f.relativePath));
  });

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--black)', position: 'relative' }}>
      {/* Scrollable View Content */}
      <div style={{ flexGrow: 1, overflowY: 'auto', padding: '24px 24px 100px 24px' }}>
        
        {/* Header Card */}
        <div style={{ backgroundColor: 'var(--black-3)', border: '1px solid var(--border-2)', borderRadius: '8px', padding: '18px 20px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontFamily: 'Space Grotesk', fontSize: '15px', fontWeight: '600', color: 'var(--beige)', wordBreak: 'break-all' }}>
                {selectedFile.name}
              </span>
              <span style={{ 
                fontFamily: 'Space Mono', 
                fontSize: '9px', 
                fontWeight: '700', 
                backgroundColor: layerColor + '15', 
                color: layerColor, 
                border: `1px solid ${layerColor}33`,
                borderRadius: '4px',
                padding: '3px 8px',
                textTransform: 'uppercase'
              }}>
                {selectedFile.layer || 'Unknown'}
              </span>
            </div>

            {/* Quick File Selector Dropdown */}
            <select
              value={selectedFile?.relativePath || ''}
              onChange={(e) => {
                const targetFile = (DATA?.files || []).find(f => f.relativePath === e.target.value);
                if (targetFile && onFileSelect) {
                  onFileSelect(targetFile);
                }
              }}
              style={{
                backgroundColor: 'var(--black-2)',
                border: '1px solid var(--border)',
                color: 'var(--orange)',
                borderRadius: '4px',
                padding: '6px 12px',
                fontFamily: 'Space Mono',
                fontSize: '11px',
                fontWeight: '700',
                outline: 'none',
                cursor: 'pointer',
                maxWidth: '220px'
              }}
            >
              <option value="" disabled>Change Selected File...</option>
              {(DATA?.files || []).map(f => (
                <option key={f.relativePath} value={f.relativePath}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
          <div style={{ fontFamily: 'Space Mono', fontSize: '10px', color: 'var(--beige-3)', wordBreak: 'break-all', marginBottom: '16px' }}>
            {selectedFile.relativePath}
          </div>
          
          {/* Stats Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
            <div style={{ textAlign: 'center', background: 'var(--black-2)', borderRadius: '6px', border: '1px solid var(--border)', padding: '10px 4px' }}>
              <div style={{ fontFamily: 'Space Mono', fontSize: '20px', fontWeight: '700', color: 'var(--beige)' }}>{blastData.directImpact.length}</div>
              <div style={{ fontFamily: 'Space Grotesk', fontSize: '10px', color: 'var(--beige-3)', marginTop: '2px' }}>Direct Dependents</div>
            </div>
            <div style={{ textAlign: 'center', background: 'var(--black-2)', borderRadius: '6px', border: '1px solid var(--border)', padding: '10px 4px' }}>
              <div style={{ fontFamily: 'Space Mono', fontSize: '20px', fontWeight: '700', color: 'var(--beige)' }}>{blastData.indirectImpact.length}</div>
              <div style={{ fontFamily: 'Space Grotesk', fontSize: '10px', color: 'var(--beige-3)', marginTop: '2px' }}>Cascade Dependents</div>
            </div>
            <div style={{ textAlign: 'center', background: 'var(--black-2)', borderRadius: '6px', border: '1px solid var(--border)', padding: '10px 4px' }}>
              <div style={{ fontFamily: 'Space Mono', fontSize: '20px', fontWeight: '700', color: 'var(--beige)' }}>{blastData.totalAffected}</div>
              <div style={{ fontFamily: 'Space Grotesk', fontSize: '10px', color: 'var(--beige-3)', marginTop: '2px' }}>Total Affected</div>
            </div>
          </div>
        </div>

        {/* PR Safety Rating Bar */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ width: '100%', height: '6px', borderRadius: '4px', backgroundColor: 'var(--border)', overflow: 'hidden', marginBottom: '8px' }}>
            <div style={{ 
              height: '100%', 
              width: `${100 - blastData.safetyScore}%`, 
              backgroundColor: severityColor,
              borderRadius: '4px',
              transition: 'width 0.6s ease'
            }}></div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: 'Space Mono', fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', color: severityColor }}>
              RISK LEVEL: {blastData.severity.toUpperCase()}
            </span>
            <span style={{ fontFamily: 'Space Mono', fontSize: '11px', color: 'var(--beige-3)' }}>
              SAFETY RATING: {blastData.safetyScore}/100
            </span>
          </div>
        </div>

        {/* Technical Impact Summary */}
        <div style={{ 
          background: 'var(--black-3)', 
          border: `1px solid ${severityColor}33`,
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
            ? `Isolated module: Zero active files import ${selectedFile.name}. Modifications pose low risk to existing contracts.`
            : `Modifying ${selectedFile.name} directly impacts ${blastData.directImpact.length} module(s) and cascades across ${blastData.indirectImpact.length} indirect consumer(s). Verify downstream interface contracts before deployment.`
          }
        </div>

        {/* Recommended Verification Test Suites */}
        <div style={{ backgroundColor: 'var(--black-3)', border: '1px solid var(--border-2)', borderRadius: '6px', padding: '14px 16px', marginBottom: '24px' }}>
          <div style={{ fontFamily: 'Space Mono', fontSize: '10px', fontWeight: '700', color: 'var(--beige-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
            RECOMMENDED TEST VERIFICATION
          </div>
          {testFiles.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {testFiles.map(tf => (
                <div key={tf.relativePath} style={{ fontFamily: 'Space Mono', fontSize: '11px', color: '#00F0FF', background: 'var(--black-2)', padding: '6px 10px', borderRadius: '4px', border: '1px solid var(--border)' }}>
                  npx jest {tf.relativePath}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontFamily: 'Space Grotesk', fontSize: '11px', color: 'var(--beige-3)' }}>
              No direct test suites bound to this path. Run full regression suite across Presentation & Gateway layers.
            </div>
          )}
        </div>

        {/* Expandable Sections */}
        {/* Direct Impact Section */}
        <div style={{ marginBottom: '16px' }}>
          <div 
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', padding: '6px 0', borderBottom: '1px solid var(--border-2)', marginBottom: '8px' }}
            onClick={() => setDirectExpanded(!directExpanded)}
          >
            <span style={{ fontFamily: 'Space Grotesk', fontSize: '12px', fontWeight: '600', color: 'var(--beige)', letterSpacing: '0.04em' }}>
              {directExpanded ? '▼' : '▶'} DIRECT IMPORTERS — {blastData.directImpact.length} FILES
            </span>
          </div>
          {directExpanded && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {blastData.directImpact.length === 0 ? (
                <div style={{ padding: '12px 16px', color: 'var(--beige-3)', fontFamily: 'Space Grotesk', fontSize: '12px' }}>
                  No direct importers found.
                </div>
              ) : (
                blastData.directImpact.map((path) => {
                  const filename = path.split('/').pop();
                  const fileObj = (DATA?.files || []).find(f => f.relativePath === path) || { relativePath: path, name: filename, layer: 'Unknown' };
                  const dotColor = LAYER_COLORS[fileObj.layer] || '#8E8578';
                  return (
                    <div 
                      key={path} 
                      style={{ display: 'flex', alignItems: 'center', height: '38px', padding: '0 12px', borderRadius: '4px', transition: 'background 0.2s' }}
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
              {indirectExpanded ? '▼' : '▶'} CASCADE IMPORTERS — {blastData.indirectImpact.length} FILES
            </span>
          </div>
          {indirectExpanded && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {blastData.indirectImpact.length === 0 ? (
                <div style={{ padding: '12px 16px', color: 'var(--beige-3)', fontFamily: 'Space Grotesk', fontSize: '12px' }}>
                  No indirect cascade impacts found.
                </div>
              ) : (
                <>
                  {blastData.indirectImpact.map((path) => {
                    const filename = path.split('/').pop();
                    const fileObj = (DATA?.files || []).find(f => f.relativePath === path) || { relativePath: path, name: filename, layer: 'Unknown' };
                    return (
                      <div 
                        key={path} 
                        style={{ display: 'flex', alignItems: 'center', height: '38px', padding: '0 12px', borderRadius: '4px', transition: 'background 0.2s' }}
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
        height: '70px', 
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
          Highlight Cascading Path on Architecture Graph →
        </button>
      </div>

      {/* ── Pillar 3: System Health Radar ── */}
      {DATA?.healthSummary && (
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--beige-3)', marginBottom: '12px' }}>
            System Health Radar
          </div>

          {/* Health Grade */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
            <div style={{
              width: '48px', height: '48px', borderRadius: '12px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '20px', fontWeight: 900, fontFamily: '"Space Mono", monospace',
              background: DATA.healthSummary.grade === 'A+' || DATA.healthSummary.grade === 'A' ? 'rgba(16,185,129,0.15)' :
                DATA.healthSummary.grade === 'B' ? 'rgba(234,179,8,0.15)' : 'rgba(239,68,68,0.15)',
              color: DATA.healthSummary.grade === 'A+' || DATA.healthSummary.grade === 'A' ? '#10B981' :
                DATA.healthSummary.grade === 'B' ? '#EAB308' : '#EF4444',
              border: `1px solid ${DATA.healthSummary.grade === 'A+' || DATA.healthSummary.grade === 'A' ? 'rgba(16,185,129,0.3)' :
                DATA.healthSummary.grade === 'B' ? 'rgba(234,179,8,0.3)' : 'rgba(239,68,68,0.3)'}`
            }}>
              {DATA.healthSummary.grade}
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#FFF' }}>
                Codebase Health Grade
              </div>
              <div style={{ fontSize: '10px', color: 'var(--beige-3)' }}>
                {DATA.healthSummary.totalFiles} files analyzed | Avg risk: {DATA.healthSummary.averageRisk}
              </div>
            </div>
          </div>

          {/* Summary Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '14px' }}>
            {[
              { label: 'SPOF Files', value: DATA.healthSummary.spofCount, color: '#EF4444' },
              { label: 'God Objects', value: DATA.healthSummary.godObjectCount, color: '#F59E0B' },
              { label: 'High Complexity', value: DATA.healthSummary.highComplexityCount, color: '#8B5CF6' }
            ].map((stat, i) => (
              <div key={i} style={{ background: 'var(--black-2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: 800, color: stat.value > 0 ? stat.color : '#10B981', fontFamily: '"Space Mono", monospace' }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: '9px', color: 'var(--beige-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>

          {/* Top Risk Files */}
          {DATA.healthSummary.topRiskFiles?.length > 0 && (
            <div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--beige-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
                Top Risk Files
              </div>
              {DATA.healthSummary.topRiskFiles.map((f, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '6px 8px', borderRadius: '6px', marginBottom: '4px',
                  background: 'var(--black-2)', border: '1px solid var(--border)', cursor: 'pointer'
                }}
                onClick={() => {
                  const fileObj = DATA.files?.find(file => file.relativePath === f.id);
                  if (fileObj) onFileSelect(fileObj);
                }}>
                  <div style={{ fontSize: '11px', color: '#FFF', fontFamily: '"Space Mono", monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%' }}>
                    {f.id}
                  </div>
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    {f.flags.map((flag, fi) => (
                      <span key={fi} style={{
                        fontSize: '8px', padding: '1px 5px', borderRadius: '3px', fontWeight: 700, textTransform: 'uppercase',
                        background: flag === 'spof' ? 'rgba(239,68,68,0.15)' : flag === 'god-object' ? 'rgba(245,158,11,0.15)' : 'rgba(139,92,246,0.15)',
                        color: flag === 'spof' ? '#EF4444' : flag === 'god-object' ? '#F59E0B' : '#8B5CF6'
                      }}>
                        {flag}
                      </span>
                    ))}
                    <span style={{ fontSize: '10px', color: 'var(--beige-3)', fontFamily: '"Space Mono", monospace' }}>
                      {f.riskScore}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Pillar 1: Layer Violations ── */}
      {DATA?.findings?.layerViolations?.length > 0 && (
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#EF4444', marginBottom: '12px' }}>
            Layer Violations ({DATA.findings.layerViolations.length})
          </div>
          <div style={{ fontSize: '10px', color: 'var(--beige-3)', marginBottom: '10px', lineHeight: 1.5 }}>
            These files import across forbidden architectural layer boundaries, bypassing intermediate layers.
          </div>
          {DATA.findings.layerViolations.slice(0, 15).map((v, i) => (
            <div key={i} style={{
              background: 'var(--black-2)', border: `1px solid ${v.severity === 'critical' ? 'rgba(239,68,68,0.3)' : 'rgba(234,179,8,0.3)'}`,
              borderRadius: '8px', padding: '10px', marginBottom: '8px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{
                  fontSize: '8px', padding: '2px 6px', borderRadius: '4px', fontWeight: 800, textTransform: 'uppercase',
                  background: v.severity === 'critical' ? 'rgba(239,68,68,0.15)' : 'rgba(234,179,8,0.15)',
                  color: v.severity === 'critical' ? '#EF4444' : '#EAB308'
                }}>
                  {v.severity}
                </span>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <span style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '3px', background: 'rgba(59,130,246,0.15)', color: '#3B82F6' }}>{v.sourceLayer}</span>
                  <span style={{ fontSize: '9px', color: 'var(--beige-3)' }}>→</span>
                  <span style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '3px', background: 'rgba(16,185,129,0.15)', color: '#10B981' }}>{v.targetLayer}</span>
                </div>
              </div>
              <div style={{ fontSize: '10px', color: '#FFF', fontFamily: '"Space Mono", monospace', marginBottom: '4px', lineHeight: 1.4 }}>
                {v.source.split('/').pop()} → {v.target.split('/').pop()}
              </div>
              <div style={{ fontSize: '9px', color: 'var(--beige-3)', lineHeight: 1.4 }}>
                {v.suggestion}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default BlastRadiusView;

