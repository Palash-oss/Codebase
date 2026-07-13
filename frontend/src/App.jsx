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
        const res = await fetch('/api/latest-result');
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

  return (
    <>
      {latestResult ? (
        <Dashboard data={latestResult} onNewAnalysis={handleNewAnalysis} />
      ) : (
        <LandingPage onAnalysisSuccess={setLatestResult} />
      )}
    </>
  );
}

export default App;
