import React from 'react';

function LayersView({ data, onSelectFile }) {
  const isLight = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light';

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
    data.files.forEach(f => {
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

  const layersToRender = [];
  let layerIndex = 0;

  orderedLayers.forEach(layerName => {
    const filePaths = data.layers[layerName];
    if (!filePaths || filePaths.length === 0) return;

    let filesData = filePaths.map(p => data.files.find(f => f.relativePath === p)).filter(Boolean);
    // Sort files by complexity/connections count
    filesData.sort((a, b) => {
      const aConn = (a.imports ? a.imports.length : 0) + (a.exports ? a.exports.length : 0);
      const bConn = (b.imports ? b.imports.length : 0) + (b.exports ? b.exports.length : 0);
      return bConn - aConn;
    });

    const MAX_FILES = 80;
    const visibleFiles = filesData.slice(0, MAX_FILES);
    const hiddenCount = filesData.length - visibleFiles.length;

    layersToRender.push({
      name: layerName,
      color: layerColors[layerName] || '#888888',
      filesData: filesData,
      visibleFiles: visibleFiles,
      hiddenCount: hiddenCount,
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
                <div className="layer-connector-label" style={{ background: isLight ? '#FFFFFF' : '#0F172A', color: isLight ? '#334155' : '#94A3B8', border: '1px solid #10B981' }}>↓ {arrowImportsCount} imports</div>
              </div>
            )}

            {/* Horizontal layer band */}
            <div className="layer-band" style={{ background: isLight ? '#FFFFFF' : 'var(--bg-card)', borderColor: isLight ? '#E2E8F0' : 'var(--border)' }}>
              <div 
                className="layer-label-col" 
                style={{ 
                  backgroundColor: isLight ? '#F8FAFC' : 'rgba(255, 77, 0, 0.03)',
                  borderRight: `1px solid ${isLight ? '#E2E8F0' : 'var(--border)'}`
                }}
              >
                <div className="layer-title-row">
                  <span className="layer-dot" style={{ backgroundColor: layer.color }}></span>
                  <span className="layer-name" style={{ color: layer.color }}>{layer.name}</span>
                </div>
                <span className="layer-count" style={{ color: isLight ? '#64748B' : 'var(--beige-3)' }}>
                  {layer.filesData.length} file{layer.filesData.length > 1 ? 's' : ''}
                </span>
              </div>

              <div className="layer-files-col" style={{ background: isLight ? '#FFFFFF' : 'transparent' }}>
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
                      style={{ transition: 'all 0.2s ease', background: isLight ? '#FFFFFF' : 'var(--bg-card)', color: isLight ? '#0F172A' : '#F8FAFC', borderColor: isLight ? '#E2E8F0' : 'var(--border-2)' }}
                    >
                      {hasErrors && <span className="finding-dot error"></span>}
                      {!hasErrors && hasWarnings && <span className="finding-dot warning"></span>}
                      <span className="name">{file.name}</span>
                    </div>
                  );
                })}

                {layer.hiddenCount > 0 && (
                  <div 
                    className="file-card" 
                    style={{ opacity: 0.6, cursor: 'default' }}
                  >
                    <span className="name" style={{ color: 'var(--beige-3)', fontStyle: 'italic' }}>
                      + {layer.hiddenCount} more files
                    </span>
                  </div>
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
