import React, { useState } from 'react';
import DetailPanel from '../DetailPanel';

function ExplorerView({ data, selectedFile, onSelectFile, setImpactHighlight }) {
  const [searchVal, setSearchVal] = useState('');
  const [expandedDirs, setExpandedDirs] = useState(new Set());

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

  const toggleDirectory = (dir) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(dir)) {
        next.delete(dir);
      } else {
        next.add(dir);
      }
      return next;
    });
  };

  // Group files by directory
  const grouped = {};
  data.files.forEach(f => {
    if (searchVal && !f.relativePath.toLowerCase().includes(searchVal.toLowerCase())) return;

    const dir = f.directory === '' ? '.' : f.directory;
    if (!grouped[dir]) {
      grouped[dir] = [];
    }
    grouped[dir].push(f);
  });

  const dirs = Object.keys(grouped).sort();

  // Render Directory and File Tree Rows
  const renderTree = () => {
    const rows = [];

    dirs.forEach(dir => {
      const isRoot = dir === '.';
      const parts = isRoot ? [] : dir.split('/');
      const depth = parts.length;
      const dirName = isRoot ? '/' : parts[parts.length - 1];

      // Don't render folder row if searching, just display flat files list
      if (!isRoot && !searchVal) {
        const isCollapsed = !expandedDirs.has(dir);
        
        // Sum errors & warnings in directory
        let errs = 0, warns = 0;
        grouped[dir].forEach(f => {
          if (f.findings) {
            f.findings.forEach(fin => {
              if (fin.type === 'error') errs++;
              if (fin.type === 'warning') warns++;
            });
          }
        });

        let badgeHtml = null;
        if (errs > 0) {
          badgeHtml = <span className="badge-count error">{errs}</span>;
        } else if (warns > 0) {
          badgeHtml = <span className="badge-count warning">{warns}</span>;
        }

        rows.push(
          <div 
            className="tree-row" 
            key={`dir-${dir}`}
            onClick={() => toggleDirectory(dir)}
            style={{ paddingLeft: `${(depth - 1) * 12 + 12}px` }}
          >
            <div className="tree-node-left">
              <svg className={`tree-chevron ${isCollapsed ? 'collapsed' : ''}`} viewBox="0 0 24 24" style={{ width: '12px', height: '12px', fill: 'var(--beige-3)', transition: 'transform 0.2s' }}>
                <path d="M7 10l5 5 5-5z"/>
              </svg>
              <svg className="tree-icon" viewBox="0 0 24 24" style={{ width: '14px', height: '14px', fill: 'var(--beige-3)' }}>
                <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
              </svg>
              <span className="tree-label">{dirName}</span>
            </div>
            <div className="tree-row-badges">{badgeHtml}</div>
          </div>
        );

        // Hide files under directory if folder is collapsed
        if (isCollapsed) return;
      }

      // Render files in folder
      const filesInDir = grouped[dir].sort((a, b) => a.name.localeCompare(b.name));
      filesInDir.forEach(file => {
        let errs = 0, warns = 0;
        if (file.findings) {
          file.findings.forEach(fin => {
            if (fin.type === 'error') errs++;
            if (fin.type === 'warning') warns++;
          });
        }

        let badgeHtml = null;
        if (errs > 0) {
          badgeHtml = <span className="badge-count error">{errs}</span>;
        } else if (warns > 0) {
          badgeHtml = <span className="badge-count warning">{warns}</span>;
        }

        const fileDepth = searchVal ? 0 : (isRoot ? 0 : depth);
        const isSelected = selectedFile && selectedFile.relativePath === file.relativePath;

        rows.push(
          <div 
            className={`tree-row ${isSelected ? 'selected' : ''}`} 
            key={`file-${file.relativePath}`}
            onClick={() => onSelectFile(file)}
            style={{ paddingLeft: `${fileDepth * 12 + 24}px` }}
          >
            <div className="tree-node-left">
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: layerColors[file.layer] || '#888', marginRight: '4px', flexShrink: 0 }}></span>
              <span className="tree-label file">{file.name}</span>
            </div>
            <div className="tree-row-badges">
              <span className="pill-badge" style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: layerColors[file.layer] || '#888', padding: '1px 6px', fontSize: '9px', marginRight: '6px' }}>
                {file.layer}
              </span>
              {badgeHtml}
            </div>
          </div>
        );
      });
    });

    return rows;
  };

  return (
    <div id="view-explorer" style={{ display: 'flex', width: '100%', height: '100%' }}>
      {/* File Tree Left Column */}
      <div className="explorer-left">
        <div className="explorer-header">Files</div>
        <input 
          type="text" 
          className="explorer-search" 
          placeholder="filter files..."
          value={searchVal}
          onChange={(e) => setSearchVal(e.target.value)}
        />
        <div className="explorer-tree" id="explorer-tree-container">
          {renderTree()}
        </div>
      </div>

      {/* Details Right Column */}
      <div className="explorer-right" style={{ flexGrow: 1, padding: 0 }}>
        {selectedFile ? (
          <div style={{ height: '100%', position: 'relative' }}>
            <DetailPanel 
              file={selectedFile} 
              files={data.files} 
              onClose={() => { onSelectFile(null); if (setImpactHighlight) setImpactHighlight(null); }} 
              onSelectFile={onSelectFile}
              layout="inline"
              setImpactHighlight={setImpactHighlight}
            />
          </div>
        ) : (
          <div className="explorer-placeholder">
            <svg style={{ width: '32px', height: '32px', fill: 'var(--border-3)' }} viewBox="0 0 24 24">
              <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
            </svg>
            <div style={{ fontSize: '15px', fontWeight: 500 }}>select a file</div>
            <div style={{ fontSize: '13px' }}>click anything to inspect it</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ExplorerView;
