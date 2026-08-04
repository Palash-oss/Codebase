import React from 'react';
import Toast from './Toast';
import AuthModal from './AuthModal';
import WorkspacesDrawer from './WorkspacesDrawer';
import AiArchitectDrawer from './AiArchitectDrawer';
import BillingModal from './BillingModal';
import FeedbackModal from './FeedbackModal';

function Navbar({ project = { name: 'Codebase', totalFiles: 0 }, detectedStack = [], files = [], data, onNewAnalysis, onSelectWorkspaceProject, theme, toggleTheme }) {
  // Count error/warning findings
  let errorCount = 0;
  let warningCount = 0;

  (files || []).forEach(f => {
    if (f.findings) {
      f.findings.forEach(fin => {
        if (fin.type === 'error') errorCount++;
        if (fin.type === 'warning') warningCount++;
      });
    }
  });

  const getTechLogoUrl = (logoKey) => {
    if (!logoKey || logoKey.startsWith('inline-') || logoKey === 'inline') {
      return '';
    }
    return `https://cdn.jsdelivr.net/gh/devicons/devicon/icons/${logoKey}/${logoKey}-original.svg`;
  };

  const stackList = Array.isArray(detectedStack) ? detectedStack : [];
  const first3 = stackList.slice(0, 3);
  const moreCount = Math.max(0, stackList.length - 3);

  const handleReset = async () => {
    try {
      // Clean backend state on the server
      await fetch('/api/reset', { method: 'POST' });
      onNewAnalysis();
    } catch (e) {
      console.error(e);
    }
  };

  const [showPrGuardModal, setShowPrGuardModal] = React.useState(false);
  const [showExportModal, setShowExportModal] = React.useState(false);
  const [showAuthModal, setShowAuthModal] = React.useState(false);
  const [showWorkspacesDrawer, setShowWorkspacesDrawer] = React.useState(false);
  const [showAiDrawer, setShowAiDrawer] = React.useState(false);
  const [showBillingModal, setShowBillingModal] = React.useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = React.useState(false);
  const [showUserModal, setShowUserModal] = React.useState(false);
  const [mermaidCode, setMermaidCode] = React.useState('');
  const [ghActionYaml, setGhActionYaml] = React.useState('');
  const [toastMsg, setToastMsg] = React.useState('');
  const [currentUser, setCurrentUser] = React.useState(() => {
    try {
      const uStr = localStorage.getItem('xray_user');
      if (!uStr) return null;
      const u = JSON.parse(uStr);
      if (u && u.tier && u.tier !== 'free' && u.subscriptionExpiresAt) {
        if (new Date(u.subscriptionExpiresAt) < new Date()) {
          u.tier = 'free';
          u.subscriptionExpiresAt = null;
          localStorage.setItem('xray_user', JSON.stringify(u));
        }
      }
      return u;
    } catch (e) {
      return null;
    }
  });

  const userTier = currentUser?.tier || 'free';
  const isPro = userTier === 'pro' || userTier === 'team';

  const activeBranch = project.activeBranch || 'main';
  const [realBranches, setRealBranches] = React.useState([activeBranch]);
  const [loadingBranch, setLoadingBranch] = React.useState(false);

  React.useEffect(() => {
    const fetchRepoBranches = async () => {
      const repoUrl = project.repoUrl || (project.name && project.name.includes('/') ? `https://github.com/${project.name}` : '');
      if (!repoUrl || !repoUrl.includes('github.com')) {
        setRealBranches([activeBranch]);
        return;
      }
      try {
        const res = await fetch(`/api/github/branches?url=${encodeURIComponent(repoUrl)}`);
        const data = await res.json();
        if (data.branches && Array.isArray(data.branches) && data.branches.length > 0) {
          setRealBranches(data.branches);
        } else {
          setRealBranches([activeBranch]);
        }
      } catch (e) {
        setRealBranches([activeBranch]);
      }
    };

    fetchRepoBranches();
  }, [project.name, project.repoUrl, activeBranch]);

  const handleBranchSelect = async (e) => {
    const targetBranch = e.target.value;
    if (!targetBranch || targetBranch === activeBranch) return;

    setLoadingBranch(true);
    setToastMsg(`Switching architecture map to branch "${targetBranch}"...`);

    try {
      const repoUrl = project.repoUrl || `https://github.com/${project.name}`;
      const uStr = localStorage.getItem('xray_user');
      const parsed = uStr ? JSON.parse(uStr) : null;
      const token = parsed?.token || '';
      const email = parsed?.email || 'palashpathare001@gmail.com';

      const res = await fetch('/api/github', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'x-user-email': email
        },
        body: JSON.stringify({ url: repoUrl, branch: targetBranch })
      });
      const resData = await res.json();
      if (!res.ok || resData.error) {
        throw new Error(resData.error || 'Failed to switch branch');
      }

      // Fetch fresh analysis data for the new branch
      const freshRes = await fetch('/api/latest-result');
      if (freshRes.ok) {
        const freshData = await freshRes.json();
        if (onSelectWorkspaceProject) {
          onSelectWorkspaceProject(freshData);
        }
      }
      setToastMsg(`Switched architecture map to branch "${targetBranch}".`);
    } catch (err) {
      setToastMsg(`Error switching branch: ${err.message}`);
    } finally {
      setLoadingBranch(false);
    }
  };

  const handleFetchGhAction = async () => {
    try {
      const res = await fetch('/api/generate-gh-action');
      if (!res.ok) throw new Error(`Server returned status: ${res.status}`);
      const resData = await res.json();
      setGhActionYaml(resData.content || '');
      setShowPrGuardModal(true);
    } catch (e) {
      console.error('[X-RAY] Error fetching GitHub action config:', e);
    }
  };

  const handleExportMermaid = async () => {
    try {
      const res = await fetch('/api/export-mermaid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodes: data?.graph?.nodes || [],
          edges: data?.graph?.edges || [],
          files: files
        })
      });
      if (!res.ok) throw new Error(`Server returned status: ${res.status}`);
      const resData = await res.json();
      setMermaidCode(resData.mermaid || '');
      setShowExportModal(true);
    } catch (e) {
      console.error('[X-RAY] Error exporting Mermaid topology:', e);
    }
  };

  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  return (
    <header className="dashboard-navbar">
      <Toast message={toastMsg} onClose={() => setToastMsg('')} />
      <div className="nav-left">
        <div className="wordmark" style={{ fontSize: '11px', letterSpacing: '0.2em' }}>
          <span className="first">CODEBASE</span> <span className="second">X-RAY</span>
        </div>
        <span className="separator">·</span>
        <div className="project-name" title={project.name} style={{ maxWidth: '130px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {project.name}
        </div>

        {/* Git Branch Selector Dropdown */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'var(--black-3)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-2)' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="6" y1="3" x2="6" y2="15"/>
            <circle cx="18" cy="6" r="3"/>
            <circle cx="6" cy="18" r="3"/>
            <path d="M18 9a9 9 0 0 1-9 9"/>
          </svg>
          <select
            value={activeBranch}
            onChange={handleBranchSelect}
            disabled={loadingBranch}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--orange)',
              fontSize: '11px',
              fontWeight: '700',
              fontFamily: '"Space Mono", monospace',
              cursor: loadingBranch ? 'wait' : 'pointer',
              outline: 'none',
              maxWidth: '140px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {realBranches.map(b => (
              <option key={b} value={b} style={{ background: '#FFFFFF', color: '#111827' }}>
                {b}
              </option>
            ))}
          </select>
        </div>

        <span className="file-count" style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>{project.totalFiles} files</span>
      </div>

      {/* Desktop Navigation Items */}
      <div className="nav-right desktop-only-nav" style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
        {errorCount === 0 && warningCount === 0 ? (
          <div className="findings-badge clean" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            <span>clean</span>
          </div>
        ) : (
          <>
            {errorCount > 0 && (
              <div className="findings-badge errors" style={{ flexShrink: 0 }}>{errorCount} error{errorCount > 1 ? 's' : ''}</div>
            )}
            {warningCount > 0 && (
              <div className="findings-badge warnings" style={{ flexShrink: 0 }}>{warningCount} warning{warningCount > 1 ? 's' : ''}</div>
            )}
          </>
        )}

        {/* AI Architect Assistant Button */}
        <button
          className="btn-liquid"
          style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.4)', color: '#10B981', padding: '5px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap', flexShrink: 0 }}
          onClick={() => setShowAiDrawer(true)}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a10 10 0 0 1 10 10c0 5.523-4.477 10-10 10S2 17.523 2 12A10 10 0 0 1 12 2z"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>
          <span>AI Architect</span>
        </button>

        {/* Workspaces Portfolio Drawer Button */}
        <button
          className="btn-liquid"
          style={{ background: 'var(--black-3)', border: '1px solid var(--border-2)', color: 'var(--orange)', padding: '5px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap', flexShrink: 0 }}
          onClick={() => setShowWorkspacesDrawer(true)}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
          <span>Workspaces</span>
        </button>

        {/* Support & Feedback Button */}
        <button
          className="btn-liquid"
          style={{ background: '#10B98122', border: '1px solid #10B98188', color: '#10B981', padding: '5px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap', flexShrink: 0 }}
          onClick={() => setShowFeedbackModal(true)}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          <span>Feedback</span>
        </button>

        {/* User Account / Auth Button */}
        {currentUser ? (
          <button
            className="btn-liquid"
            style={{ background: '#10B98122', border: '1px solid #10B98188', color: '#10B981', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', maxWidth: '160px', overflow: 'hidden', flexShrink: 0 }}
            onClick={() => setShowUserModal(true)}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>
              {currentUser.name || currentUser.email.split('@')[0]} ({(currentUser.tier || 'free').toUpperCase()})
            </span>
          </button>
        ) : (
          <button
            className="btn-liquid"
            style={{ background: '#10B981', border: '1px solid #10B981', color: '#FFFFFF', padding: '6px 14px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap', boxShadow: '0 2px 8px rgba(16,185,129,0.3)' }}
            onClick={() => setShowAuthModal(true)}
          >
            <span>Sign In</span>
          </button>
        )}


        <button 
          className="btn-liquid"
          style={{ background: 'var(--black-3)', border: '1px solid var(--border-2)', color: 'var(--beige)', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          onClick={handleExportMermaid}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          <span>Export Docs</span>
        </button>

        <button 
          className="btn-liquid"
          style={{ background: 'var(--black-3)', border: '1px solid var(--border-2)', color: 'var(--beige)', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          onClick={handleFetchGhAction}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          <span>PR Guard</span>
        </button>

        {/* Theme Toggle Button */}
        <button 
          className="btn-liquid"
          style={{ background: 'var(--black-3)', border: '1px solid var(--border-2)', color: 'var(--beige)', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          onClick={toggleTheme}
          title="Toggle Dark/Light Mode"
        >
          {theme === 'light' ? (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
              <span>Light</span>
            </>
          ) : (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
              <span>Dark</span>
            </>
          )}
        </button>

        <button className="btn-action btn-liquid" onClick={handleReset}><span>New analysis</span></button>
      </div>

      {/* Mobile Menu & Theme Toggle Actions */}
      <div className="mobile-only-nav" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <button 
          className="btn-liquid"
          style={{ background: 'var(--black-3)', border: '1px solid var(--border-2)', color: 'var(--beige)', padding: '6px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          onClick={toggleTheme}
          title="Toggle Dark/Light Mode"
        >
          {theme === 'light' ? (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
              <span>Light</span>
            </>
          ) : (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
              <span>Dark</span>
            </>
          )}
        </button>

        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          style={{
            background: 'var(--orange)',
            border: 'none',
            color: '#FFFFFF',
            padding: '6px 12px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          <span>Options</span>
        </button>
      </div>

      {/* Mobile Actions Drawer Overlay (Theme-Aware Dark / Light) */}
      {isMobileMenuOpen && (
        <div style={{
          position: 'fixed',
          top: '52px',
          left: 0,
          right: 0,
          bottom: 0,
          background: 'var(--bg-card)',
          color: 'var(--beige)',
          backdropFilter: 'blur(20px)',
          zIndex: 1200,
          padding: '20px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          borderTop: '1px solid var(--border)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-2)', paddingBottom: '12px' }}>
            <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '11px', color: 'var(--orange)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
              DASHBOARD OPTIONS
            </span>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              style={{ background: 'transparent', border: 'none', color: 'var(--beige)', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}
            >
              Close
            </button>
          </div>

          {/* Findings Badges */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {errorCount === 0 && warningCount === 0 ? (
              <div className="findings-badge clean" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                <span>clean analysis</span>
              </div>
            ) : (
              <>
                {errorCount > 0 && (
                  <div className="findings-badge errors" style={{ padding: '6px 12px', fontSize: '12px' }}>{errorCount} error{errorCount > 1 ? 's' : ''} found</div>
                )}
                {warningCount > 0 && (
                  <div className="findings-badge warnings" style={{ padding: '6px 12px', fontSize: '12px' }}>{warningCount} warning{warningCount > 1 ? 's' : ''} found</div>
                )}
              </>
            )}
          </div>

          {/* Grid of Action Buttons (Theme Aware) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <button
              style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#10B981', padding: '12px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}
              onClick={() => { setShowAiDrawer(true); setIsMobileMenuOpen(false); }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a10 10 0 0 1 10 10c0 5.523-4.477 10-10 10S2 17.523 2 12A10 10 0 0 1 12 2z"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>
              <span>AI Architect</span>
            </button>

            <button
              style={{ background: 'var(--black-3)', border: '1px solid var(--border-2)', color: '#10B981', padding: '12px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}
              onClick={() => { setShowWorkspacesDrawer(true); setIsMobileMenuOpen(false); }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
              <span>Workspaces</span>
            </button>

            <button
              style={{ background: 'var(--black-3)', border: '1px solid var(--border-2)', color: '#10B981', padding: '12px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}
              onClick={() => { setShowFeedbackModal(true); setIsMobileMenuOpen(false); }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              <span>Feedback</span>
            </button>

            <button
              style={{ background: 'var(--black-3)', border: '1px solid var(--border-2)', color: 'var(--beige)', padding: '12px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}
              onClick={() => { handleExportMermaid(); setIsMobileMenuOpen(false); }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              <span>Export Docs</span>
            </button>

            <button
              style={{ background: 'var(--black-3)', border: '1px solid var(--border-2)', color: 'var(--beige)', padding: '12px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}
              onClick={() => { handleFetchGhAction(); setIsMobileMenuOpen(false); }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              <span>PR Guard</span>
            </button>

            {currentUser ? (
              <button
                style={{ background: 'var(--black-3)', border: '1px solid var(--border-2)', color: '#10B981', padding: '12px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}
                onClick={() => { setShowUserModal(true); setIsMobileMenuOpen(false); }}
              >
                <span>Profile ({(currentUser.tier || 'free').toUpperCase()})</span>
              </button>
            ) : (
              <button
                style={{ background: '#10B981', border: '1px solid #10B981', color: '#FFFFFF', padding: '12px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}
                onClick={() => { setShowAuthModal(true); setIsMobileMenuOpen(false); }}
              >
                <span>Sign In</span>
              </button>
            )}
          </div>

          <button
            style={{ background: 'var(--gradient-sunset)', border: 'none', color: '#FFFFFF', padding: '12px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', width: '100%', marginTop: '8px', boxShadow: '0 4px 12px rgba(16,185,129,0.3)' }}
            onClick={() => { handleReset(); setIsMobileMenuOpen(false); }}
          >
            New analysis
          </button>
        </div>
      )}

      {/* GitHub PR Guard Modal */}
      {showPrGuardModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--black-2)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px', maxWidth: '600px', width: '90%', color: 'var(--beige)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--orange)', marginBottom: '8px' }}>GitHub PR Architecture Guard Workflow</h3>
            <p style={{ fontSize: '12px', color: 'var(--beige-2)', marginBottom: '16px' }}>Copy this YAML workflow file to <code>.github/workflows/codebase-xray-guard.yml</code> in your repository to automatically block PRs that introduce circular dependencies or missing environment variables.</p>
            <pre style={{ background: 'var(--black-3)', border: '1px solid var(--border-2)', padding: '16px', borderRadius: '8px', fontSize: '11px', overflowX: 'auto', maxHeight: '250px', fontFamily: '"Space Mono", monospace' }}>
              {ghActionYaml}
            </pre>
            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <button 
                className="btn-liquid"
                onClick={() => { navigator.clipboard.writeText(ghActionYaml); setToastMsg('Copied GitHub Workflow YAML to clipboard!'); }}
                style={{ flex: 1, background: 'var(--orange)', color: '#fff', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                <span>Copy Workflow YAML</span>
              </button>
              <button 
                onClick={() => setShowPrGuardModal(false)}
                style={{ background: 'var(--black-3)', color: 'var(--beige)', border: '1px solid var(--border)', padding: '10px 16px', borderRadius: '6px', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Mermaid / Docs Modal */}
      {showExportModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--black-2)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px', maxWidth: '600px', width: '90%', color: 'var(--beige)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--orange)', marginBottom: '8px' }}>Export Architecture Documentation</h3>
            <p style={{ fontSize: '12px', color: 'var(--beige-2)', marginBottom: '16px' }}>Copy the generated <code>Mermaid.js</code> diagram syntax below to paste directly into GitHub READMEs, Notion, or Confluence pages.</p>
            <pre style={{ background: 'var(--black-3)', border: '1px solid var(--border-2)', padding: '16px', borderRadius: '8px', fontSize: '11px', overflowX: 'auto', maxHeight: '250px', fontFamily: '"Space Mono", monospace' }}>
              {mermaidCode}
            </pre>


            <div style={{ display: 'flex', gap: '12px', marginTop: '16px', flexWrap: 'wrap' }}>
              <button 
                className="btn-liquid"
                onClick={() => { navigator.clipboard.writeText(mermaidCode); setToastMsg('Copied Mermaid syntax to clipboard!'); }}
                style={{ flex: 1, background: 'var(--orange)', color: '#fff', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                <span>Copy Mermaid Syntax</span>
              </button>

              {/* 4K SVG Export — Pro Only */}
              <button
                onClick={() => {
                  if (!isPro) {
                    setShowExportModal(false);
                    setShowBillingModal(true);
                    setToastMsg('Upgrade to Pro to export 4K Ultra-HD SVG diagrams!');
                  } else {
                    setToastMsg('4K SVG export is coming soon!');
                  }
                }}
                style={{ flex: 1, background: isPro ? 'var(--black-3)' : 'rgba(255,94,26,0.08)', color: isPro ? 'var(--beige)' : 'var(--orange)', border: `1px solid ${isPro ? 'var(--border)' : 'var(--orange)'}`, padding: '10px', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', minWidth: '140px' }}
              >
                {!isPro && <span style={{ fontSize: '11px' }}>🔒</span>}
                <span>{isPro ? '4K SVG Export' : '4K SVG — Pro'}</span>
              </button>

              <button 
                onClick={() => setShowExportModal(false)}
                style={{ background: 'var(--black-3)', color: 'var(--beige)', border: '1px solid var(--border)', padding: '10px 16px', borderRadius: '6px', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Phase 1 Auth & Workspaces UI */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onAuthSuccess={(user) => {
          setCurrentUser(user);
          setToastMsg(`Welcome, ${user.name || user.email}!`);
        }}
      />

      <WorkspacesDrawer
        isOpen={showWorkspacesDrawer}
        onClose={() => setShowWorkspacesDrawer(false)}
        activeProjectData={data}
        onSelectProject={(projectData) => {
          if (onSelectWorkspaceProject) onSelectWorkspaceProject(projectData);
        }}
      />

      {/* Phase 3 AI Architect Assistant Drawer */}
      <AiArchitectDrawer
        isOpen={showAiDrawer}
        onClose={() => setShowAiDrawer(false)}
        activeAnalysisData={data}
      />

      {/* Phase 4 Subscription Monetization & Billing Modal */}
      <BillingModal
        isOpen={showBillingModal}
        onClose={() => setShowBillingModal(false)}
        currentUser={currentUser}
        onUpgradeSuccess={(updatedUser) => {
          setCurrentUser(updatedUser);
          setToastMsg(`Upgraded to ${updatedUser.tier.toUpperCase()} Plan!`);
        }}
      />

      {/* User Feedback & Support Portal Modal */}
      <FeedbackModal
        isOpen={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
        currentUser={currentUser}
        activeRepoName={project?.name || ''}
      />

      {/* Custom User Profile / Sign Out Modal */}
      {showUserModal && currentUser && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 230
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            padding: '24px',
            width: '380px',
            maxWidth: '92%',
            boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
            border: '1px solid #E2E8F0',
            position: 'relative'
          }}>
            <button
              onClick={() => setShowUserModal(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'none',
                border: 'none',
                fontSize: '18px',
                cursor: 'pointer',
                color: '#64748B'
              }}
            >
              ✕
            </button>

            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#10B981', color: '#FFFFFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: '700', marginBottom: '10px' }}>
                {(currentUser.name || currentUser.email)[0].toUpperCase()}
              </div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#111827' }}>
                {currentUser.name || 'Developer Account'}
              </h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748B' }}>
                {currentUser.email}
              </p>
              <div style={{ marginTop: '8px', display: 'inline-block', padding: '3px 10px', borderRadius: '12px', background: '#F1F5F9', border: '1px solid #E2E8F0', fontSize: '11px', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>
                {(currentUser.tier || 'free')} Plan
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '20px' }}>
              <button
                onClick={() => {
                  setShowUserModal(false);
                  setShowBillingModal(true);
                }}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #10B981 0%, #FF2A00 100%)',
                  color: '#FFFFFF',
                  fontWeight: '700',
                  fontSize: '13px',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                Manage Subscription / Upgrade
              </button>

              <button
                onClick={() => {
                  localStorage.removeItem('xray_auth_token');
                  localStorage.removeItem('xray_user');
                  setCurrentUser(null);
                  setShowUserModal(false);
                  setToastMsg('Signed out successfully.');
                }}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  background: '#FEF2F2',
                  border: '1px solid #FCA5A5',
                  color: '#DC2626',
                  fontWeight: '600',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

export default Navbar;
