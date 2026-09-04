import React, { useState, useEffect } from 'react';
import LandingPage from './components/LandingPage';
import Dashboard from './components/Dashboard';

function App() {
  const [latestResult, setLatestResult] = useState(null);
  const [loading, setLoading] = useState(true);
  // Live webhook notification banner state
  const [webhookBanner, setWebhookBanner] = useState(null); // { message, type }

  // Global Theme Management (Dark by default, switches between Dark and Light)
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('theme') || 'dark';
    } catch (e) {
      return 'dark';
    }
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('theme', theme);
    } catch (e) {}
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Auto-dismiss webhook banner after 8 seconds
  useEffect(() => {
    if (!webhookBanner) return;
    const timer = setTimeout(() => setWebhookBanner(null), 8000);
    return () => clearTimeout(timer);
  }, [webhookBanner]);

  // Reload analysis result from server
  const reloadLatestResult = async () => {
    try {
      const baseUrl = window.location.origin;
      const res = await fetch(`${baseUrl}/api/latest-result`);
      if (res.ok) {
        const data = await res.json();
        setLatestResult(data);
      }
    } catch (err) {
      console.error('[X-RAY] Error reloading latest result:', err);
    }
  };

  // Check if there is an active analysis on mount + setup SSE
  useEffect(() => {
    async function checkLatestResult() {
      try {
        const baseUrl = window.location.origin;
        const res = await fetch(`${baseUrl}/api/latest-result`);
        if (res.ok) {
          const data = await res.json();
          setLatestResult(data);
        }
      } catch (err) {
        console.error('Error fetching latest result:', err);
      } finally {
        setLoading(false);
      }
    }
    checkLatestResult();

    // Live SSE Listener — handles both legacy ARCH_UPDATE and new webhook push events
    let eventSource;
    let isUpdatingFromWebhook = false;
    try {
      eventSource = new EventSource('/api/sse');

      eventSource.onmessage = async (event) => {
        try {
          const payload = JSON.parse(event.data);
          console.log('[X-RAY SSE] Event received:', payload);

          // Legacy architecture update
          if (payload.type === 'ARCH_UPDATE') {
            await reloadLatestResult();
            return;
          }

          // Webhook push-received notification
          if (payload.phase === 'webhook-update') {
            let webhookData = {};
            try {
              webhookData = typeof payload.message === 'string' && payload.message.startsWith('{')
                ? JSON.parse(payload.message)
                : { message: payload.message };
            } catch (e) { webhookData = { message: payload.message }; }

            const eventType = webhookData.type;

            if (eventType === 'push-received') {
              isUpdatingFromWebhook = true;
              setWebhookBanner({
                type: 'updating',
                message: webhookData.message || '🔄 GitHub push detected — re-analyzing live...'
              });
            } else if (eventType === 'repo-mismatch') {
              setWebhookBanner({
                type: 'info',
                message: `ℹ️ Push from different repo — not updating current diagram`
              });
            } else if (eventType === 'no-previous-scan') {
              setWebhookBanner({
                type: 'info',
                message: `ℹ️ Push received — scan the repo first to enable live monitoring`
              });
            }
            return;
          }

          // Analysis complete after webhook re-analysis — reload the diagram
          if (payload.phase === 'complete' && isUpdatingFromWebhook) {
            isUpdatingFromWebhook = false;
            setWebhookBanner({
              type: 'success',
              message: '✅ Live update complete! Diagrams refreshed with latest push.'
            });
            setTimeout(async () => {
              await reloadLatestResult();
            }, 600);
            return;
          }

          // Webhook error
          if (payload.phase === 'webhook-error') {
            isUpdatingFromWebhook = false;
            setWebhookBanner({
              type: 'error',
              message: '❌ Live re-analysis failed. Check server logs.'
            });
          }
        } catch (e) {
          console.warn('[X-RAY SSE] Failed to parse event data:', e);
        }
      };

      eventSource.onerror = () => {
        // SSE auto-reconnects — this is normal behavior
      };
    } catch (e) {
      console.warn('[X-RAY SSE] Error establishing live sync stream:', e);
    }

    return () => {
      if (eventSource) eventSource.close();
    };
  }, []);

  const handleNewAnalysis = () => {
    setLatestResult(null);
  };

  if (loading) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme === 'light' ? '#ffffff' : '#080808',
        color: theme === 'light' ? '#000000' : '#ffffff',
        fontFamily: 'Space Mono, monospace',
        letterSpacing: '0.25em',
        fontSize: '14px'
      }}>
        LOADING X-RAY...
      </div>
    );
  }

  const hasValidAnalysis = Boolean(latestResult && Array.isArray(latestResult.files) && latestResult.files.length > 0);

  const bannerColors = {
    updating: { bg: 'linear-gradient(135deg, #1E3A5F, #1E40AF)', border: '#3B82F6' },
    success:  { bg: 'linear-gradient(135deg, #052E16, #065F46)', border: '#10B981' },
    info:     { bg: 'linear-gradient(135deg, #1C1C1C, #374151)', border: '#6B7280' },
    error:    { bg: 'linear-gradient(135deg, #450A0A, #7F1D1D)', border: '#EF4444' }
  };

  return (
    <>
      {/* Live GitHub Webhook Update Banner */}
      {webhookBanner && (
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          background: bannerColors[webhookBanner.type]?.bg || bannerColors.info.bg,
          border: `1px solid ${bannerColors[webhookBanner.type]?.border || '#6B7280'}`,
          borderRadius: '12px',
          padding: '12px 20px',
          color: '#FFFFFF',
          fontSize: '13px',
          fontWeight: '600',
          fontFamily: '"Space Grotesk", sans-serif',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px ${bannerColors[webhookBanner.type]?.border || '#6B7280'}22`,
          maxWidth: '560px',
          whiteSpace: 'nowrap'
        }}>
          {webhookBanner.type === 'updating' && (
            <div style={{
              width: '14px', height: '14px', borderRadius: '50%',
              border: '2px solid rgba(255,255,255,0.25)',
              borderTopColor: '#60A5FA',
              animation: 'spin 0.8s linear infinite',
              flexShrink: 0
            }} />
          )}
          <span style={{ flex: 1 }}>{webhookBanner.message}</span>
          <button
            onClick={() => setWebhookBanner(null)}
            style={{
              background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)',
              cursor: 'pointer', fontSize: '16px', padding: '0 0 0 8px', lineHeight: 1
            }}
          >✕</button>
        </div>
      )}

      {hasValidAnalysis ? (
        <Dashboard
          data={latestResult}
          onNewAnalysis={handleNewAnalysis}
          onSelectWorkspaceProject={(newData) => setLatestResult(newData)}
          theme={theme}
          toggleTheme={toggleTheme}
        />
      ) : (
        <LandingPage
          onAnalysisSuccess={setLatestResult}
          theme={theme}
          toggleTheme={toggleTheme}
        />
      )}
    </>
  );
}

export default App;
