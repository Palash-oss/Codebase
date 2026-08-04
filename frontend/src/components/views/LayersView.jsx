import React, { useState } from 'react';

function LayersView({ data, onSelectFile }) {
  const isLight = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light';
  const [expandedLayers, setExpandedLayers] = useState({});
  const [searchQueries, setSearchQueries] = useState({});

  const orderedLayers = ['Presentation', 'Interaction', 'Gateway', 'Domain', 'Persistence', 'Foundation', 'Infrastructure', 'Test', 'Unknown'];
  const layerColors = {
    Presentation: '#10B981',
    Interaction: '#3B82F6',
    Gateway: '#8B5CF6',
    Domain: '#EC4899',
    Persistence: '#F59E0B',
    Foundation: '#14B8A6',
    Infrastructure: '#6366F1',
    Test: '#84CC16',
    Unknown: isLight ? '#475569' : '#94A3B8'
  };

  // Helper to count cross-layer imports down
  const getImportsCountBetween = (layerName, filePaths) => {
    let importsCount = 0;
    (data.files || []).forEach(f => {
      if (f.imports) {
        f.imports.forEach(imp => {
          if (imp.status === 'resolved' && filePaths.includes(imp.resolvedPath)) {
            importsCount++;
          }
        });
      }
    });
    return importsCount;
  };

  const toggleLayerExpand = (layerName) => {
    setExpandedLayers(prev => ({ ...prev, [layerName]: !prev[layerName] }));
  };

  const handleSearchChange = (layerName, query) => {
    setSearchQueries(prev => ({ ...prev, [layerName]: query }));
  };

  const layersToRender = [];
  let layerIndex = 0;

  orderedLayers.forEach(layerName => {
    const filePaths = data.layers ? data.layers[layerName] : [];
    if (!filePaths || filePaths.length === 0) return;

    let filesData = filePaths.map(p => (data.files || []).find(f => f.relativePath === p)).filter(Boolean);
    // Sort files by complexity/connections count
    filesData.sort((a, b) => {
      const aConn = (a.imports ? a.imports.length : 0) + (a.exports ? a.exports.length : 0);
      const bConn = (b.imports ? b.imports.length : 0) + (b.exports ? b.exports.length : 0);
      return bConn - aConn;
    });

    const isExpanded = !!expandedLayers[layerName];
    const searchQuery = (searchQueries[layerName] || '').toLowerCase().trim();

    let filteredFiles = filesData;
    if (searchQuery) {
      filteredFiles = filesData.filter(f => 
        f.name.toLowerCase().includes(searchQuery) || 
        f.relativePath.toLowerCase().includes(searchQuery)
      );
    }

    const visibleFiles = filteredFiles;
    const hiddenCount = 0;


    layersToRender.push({
      name: layerName,
      color: layerColors[layerName] || '#888888',
      filesData: filesData,
      visibleFiles: visibleFiles,
      hiddenCount: hiddenCount,
      isExpanded: isExpanded,
      searchQuery: searchQuery,
      index: layerIndex,
      filePaths: filePaths
    });

    layerIndex++;
  });

  return (
    <div 
      id="view-layers" 
      style={{ 
        background: isLight ? '#FFFFFF' : 'transparent',
        minHeight: '100%',
        padding: '24px',
        borderRadius: '12px'
      }}
    >
      {layersToRender.map((layer, idx) => {
        const hasIncomingArrows = idx > 0;
        const arrowImportsCount = hasIncomingArrows ? getImportsCountBetween(layer.name, layer.filePaths) : 0;

        return (
          <React.Fragment key={layer.name}>
            {/* Vertical connector arrow */}
            {hasIncomingArrows && (
              <div className="layer-connector">
                <div className="layer-connector-label" style={{ background: isLight ? '#FFFFFF' : '#0F172A', color: isLight ? '#334155' : '#94A3B8', border: '1px solid #10B981' }}>
                  ↓ {arrowImportsCount} imports
                </div>
              </div>
            )}

            {/* Horizontal layer band */}
            <div className="layer-band" style={{ background: isLight ? '#FFFFFF' : 'var(--bg-card)', borderColor: isLight ? '#E2E8F0' : 'var(--border)', flexDirection: 'column' }}>
              
              {/* Header row with search and expand toggle */}
              <div 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  padding: '12px 16px', 
                  borderBottom: `1px solid ${isLight ? '#E2E8F0' : 'var(--border)'}`,
                  background: isLight ? '#F8FAFC' : 'rgba(255, 255, 255, 0.02)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span className="layer-dot" style={{ backgroundColor: layer.color, width: '10px', height: '10px', borderRadius: '50%' }}></span>
                  <span className="layer-name" style={{ color: layer.color, fontWeight: '800', fontSize: '14px', fontFamily: '"Space Mono", monospace' }}>{layer.name}</span>
                  <span className="layer-count" style={{ color: isLight ? '#64748B' : 'var(--beige-3)', fontSize: '12px' }}>
                    ({layer.filesData.length} file{layer.filesData.length > 1 ? 's' : ''})
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {/* Search Filter for Layer */}
                  {layer.filesData.length > 15 && (
                    <input
                      type="text"
                      placeholder={`Search ${layer.name}...`}
                      value={searchQueries[layer.name] || ''}
                      onChange={(e) => handleSearchChange(layer.name, e.target.value)}
                      style={{
                        background: isLight ? '#FFFFFF' : 'var(--black-3)',
                        border: `1px solid ${isLight ? '#CBD5E1' : 'var(--border-2)'}`,
                        color: isLight ? '#0F172A' : '#FAF7F2',
                        borderRadius: '6px',
                        padding: '4px 10px',
                        fontSize: '11px',
                        outline: 'none',
                        width: '160px'
                      }}
                    />
                  )}

                  {/* Expand / Collapse Button */}
                  {layer.filesData.length > 60 && (
                    <button
                      onClick={() => toggleLayerExpand(layer.name)}
                      style={{
                        background: layer.isExpanded ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.12)',
                        border: `1px solid ${layer.isExpanded ? 'rgba(239,68,68,0.4)' : 'rgba(16,185,129,0.4)'}`,
                        color: layer.isExpanded ? '#EF4444' : '#10B981',
                        borderRadius: '6px',
                        padding: '4px 12px',
                        fontSize: '11px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      {layer.isExpanded ? 'Collapse ▲' : `Show All ${layer.filesData.length} Files ▼`}
                    </button>
                  )}
                </div>
              </div>

              {/* Scrollable File Cards Column with Fix for Flex Clipping */}
              <div 
                className={`layer-files-col ${layer.isExpanded ? 'expanded' : ''}`}
                style={{ 
                  background: isLight ? '#FFFFFF' : 'transparent',
                  padding: '16px',
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignContent: 'flex-start',
                  gap: '8px',
                  flex: '1 1 auto',
                  minHeight: '0',
                  maxHeight: layer.isExpanded ? '650px' : '280px',
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  WebkitOverflowScrolling: 'touch',
                  scrollBehavior: 'smooth',
                  boxSizing: 'border-box'
                }}
              >
                {layer.visibleFiles.map((file) => {
                  const hasErrors = file.findings?.some(f => f.type === 'error');
                  const hasWarnings = file.findings?.some(f => f.type === 'warning');

                  return (
                    <div 
                      className="file-card" 
                      key={file.relativePath}
                      onClick={() => onSelectFile(file)}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = layer.color;
                        e.currentTarget.style.transform = 'translateY(-2px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = isLight ? '#E2E8F0' : 'var(--border-2)';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                      style={{ transition: 'all 0.2s ease', background: isLight ? '#FFFFFF' : 'var(--bg-card)', color: isLight ? '#0F172A' : '#F8FAFC', borderColor: isLight ? '#E2E8F0' : 'var(--border-2)', cursor: 'pointer' }}
                    >
                      {hasErrors && <span className="finding-dot error"></span>}
                      {!hasErrors && hasWarnings && <span className="finding-dot warning"></span>}
                      <span className="name">{file.name}</span>
                    </div>
                  );
                })}

                {layer.hiddenCount > 0 && (
                  <button 
                    className="file-card" 
                    onClick={() => toggleLayerExpand(layer.name)}
                    style={{ 
                      background: 'rgba(16,185,129,0.15)', 
                      borderColor: '#10B981', 
                      color: '#10B981', 
                      cursor: 'pointer',
                      fontWeight: '700',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <span className="name">
                      + {layer.hiddenCount} more files (Click to expand)
                    </span>
                  </button>
                )}
              </div>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default LayersView;
