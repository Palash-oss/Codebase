import React, { useState, useEffect } from 'react';
import LandingPage from './components/LandingPage';
import Dashboard from './components/Dashboard';

function App() {
  const [latestResult, setLatestResult] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check if there is an active analysis on mount
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

    // Live SSE Real-Time Sync Listener for GitHub Webhooks
    let eventSource;
    try {
      eventSource = new EventSource('/api/live-sync');
      eventSource.onmessage = async (event) => {
        const payload = JSON.parse(event.data);
        console.log('[X-RAY SSE] Live architecture update event received:', payload);
        if (payload.type === 'ARCH_UPDATE') {
          const res = await fetch('/api/latest-result');
          if (res.ok) {
            const data = await res.json();
            setLatestResult(data);
          }
        }
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
        backgroundColor: '#080808',
        color: '#FF4D00',
        fontFamily: 'Space Mono, monospace',
        letterSpacing: '0.25em',
        fontSize: '14px'
      }}>
        LOADING X-RAY...
      </div>
    );
  }

  const hasValidAnalysis = Boolean(latestResult && Array.isArray(latestResult.files) && latestResult.files.length > 0);

  return (
    <>
      {hasValidAnalysis ? (
        <Dashboard data={latestResult} onNewAnalysis={handleNewAnalysis} />
      ) : (
        <LandingPage onAnalysisSuccess={setLatestResult} />
      )}
    </>
  );
}

export default App;
