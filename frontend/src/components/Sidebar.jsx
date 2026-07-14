import React from 'react';

function Sidebar({ currentView, onViewChange }) {
  const navItems = [
    {
      id: 'architecture',
      tooltip: 'System Architecture',
      svg: (
        <svg viewBox="0 0 24 24">
          <path d="M4 15h6v6H4v-6zm0-10h6v6H4V5zm10 10h6v6h-6v-6zm0-10h6v6h-6V5z" />
        </svg>
      )
    },
    {
      id: 'layers',
      tooltip: 'Layer Diagram',
      svg: (
        <svg viewBox="0 0 24 24">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
      )
    },
    {
      id: 'explorer',
      tooltip: 'File Explorer',
      svg: (
        <svg viewBox="0 0 24 24">
          <path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6 10H6v-2h8v2zm4-4H6v-2h12v2z" />
        </svg>
      )
    },
    {
      id: 'stack',
      tooltip: 'Tech Stack',
      svg: (
        <svg viewBox="0 0 24 24">
          <path d="M12.89 3.03a1 1 0 0 0-1.78 0L3.05 17.06a1 1 0 0 0 .89 1.44h16.12a1 1 0 0 0 .89-1.44L12.89 3.03z" />
        </svg>
      )
    },
    {
      id: 'flow',
      tooltip: 'Data Flow',
      svg: (
        <svg viewBox="0 0 24 24">
          <path d="M16.01 11H4v2h12.01v3L20 12l-3.99-4v3z" />
        </svg>
      )
    }
  ];

  return (
    <aside className="sidebar">
      {navItems.map((item) => (
        <div 
          key={item.id}
          className={`sidebar-btn ${currentView === item.id ? 'active' : ''}`}
          onClick={() => onViewChange(item.id)}
        >
          {item.svg}
          <div className="tooltip">{item.tooltip}</div>
        </div>
      ))}

      {/* Feature Divider */}
      <div style={{ width: '28px', height: '1px', backgroundColor: 'var(--border-2)', margin: '8px 0' }} />

      {/* Button 1 — Blast Radius */}
      <div 
        className={`sidebar-btn ${currentView === 'blast-radius' ? 'active' : ''}`}
        onClick={() => onViewChange('blast-radius')}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="22" y1="12" x2="18" y2="12" />
          <line x1="6" y1="12" x2="2" y2="12" />
          <line x1="12" y1="6" x2="12" y2="2" />
          <line x1="12" y1="22" x2="12" y2="18" />
        </svg>
        <div className="tooltip">Blast Radius</div>
      </div>

      {/* Button 2 — Code Story */}
      <div
        className={`sidebar-btn ${currentView === 'story' ? 'active' : ''}`}
        onClick={() => onViewChange('story')}
      >
        <svg viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z" />
        </svg>
        <div className="tooltip">Code Story</div>
      </div>

      {/* Button 3 — System Design */}
      <div
        className={`sidebar-btn ${currentView === 'system-design' ? 'active' : ''}`}
        onClick={() => onViewChange('system-design')}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <rect x="2" y="3" width="7" height="5" rx="1"/>
          <rect x="11" y="16" width="7" height="5" rx="1"/>
          <path d="M7.5 13.5h2a2 2 0 012 2v4h-6a2 2 0 012-2h0"/>
          <path d="M15.5 9l1.5-1.5L15.5 6"/>
        </svg>
        <div className="tooltip">System Design</div>
      </div>
    </aside>
  );
}

export default Sidebar;
