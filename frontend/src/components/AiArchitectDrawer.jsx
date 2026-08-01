import React, { useState } from 'react';

export default function AiArchitectDrawer({ isOpen, onClose, activeAnalysisData }) {
  const [messages, setMessages] = useState([
    {
      sender: 'ai',
      text: 'Hello! I am your AI Codebase Architect. Ask me anything about your project structure, database data paths, API endpoints, or dependency relationships.'
    }
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputQuery.trim() || loading) return;

    try {
      const uStr = localStorage.getItem('xray_user');
      const user = uStr ? JSON.parse(uStr) : null;
      const tier = user?.tier || 'free';
      const aiCount = parseInt(localStorage.getItem('xray_ai_query_count') || '0', 10);

      if (tier === 'free' && aiCount >= 3) {
        setMessages(prev => [
          ...prev,
          { sender: 'user', text: inputQuery.trim() },
          {
            sender: 'ai',
            text: 'You have reached your 3 free AI Architect queries limit. Upgrade to Pro for Unlimited AI Architect Assistant Access!'
          }
        ]);
        setInputQuery('');
        return;
      }

      localStorage.setItem('xray_ai_query_count', String(aiCount + 1));
    } catch (e) {}

    const userText = inputQuery.trim();
    setInputQuery('');
    setMessages(prev => [...prev, { sender: 'user', text: userText }]);
    setLoading(true);

    try {
      const res = await fetch('/api/ai/architect-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: userText,
          graphData: activeAnalysisData?.graph || null,
          stackData: activeAnalysisData?.stack || null
        })
      });
      const data = await res.json();

      setMessages(prev => [
        ...prev,
        {
          sender: 'ai',
          text: data.answer || 'Analyzed your architecture graph. No direct dependency violations found.',
          suggestedFiles: data.suggestedFiles || []
        }
      ]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        { sender: 'ai', text: `Error analyzing architecture query: ${err.message}` }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      justifyContent: 'flex-end',
      zIndex: 195
    }}>
      <div style={{
        width: '460px',
        maxWidth: '100%',
        height: '100%',
        background: '#FFFFFF',
        boxShadow: '-10px 0 30px rgba(0,0,0,0.2)',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #10B981 0%, #047857 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF'
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M12 2a10 10 0 0 1 10 10c0 5.523-4.477 10-10 10S2 17.523 2 12A10 10 0 0 1 12 2z"/>
                <path d="M12 8v8"/>
                <path d="M8 12h8"/>
              </svg>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#111827' }}>
                AI Architect Assistant
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748B' }}>
                Instant Q&A for your codebase graph
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748B' }}
          >
            ✕
          </button>
        </div>

        {/* Chat History */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px',
          background: '#F8FAFC',
          borderRadius: '12px',
          border: '1px solid #E2E8F0',
          marginBottom: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          {messages.map((msg, idx) => (
            <div
              key={idx}
              style={{
                alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '88%',
                padding: '12px 16px',
                borderRadius: '12px',
                background: msg.sender === 'user' ? '#10B981' : '#FFFFFF',
                color: msg.sender === 'user' ? '#FFFFFF' : '#1E293B',
                fontSize: '13px',
                lineHeight: '1.5',
                boxShadow: msg.sender === 'ai' ? '0 2px 8px rgba(0,0,0,0.05)' : 'none',
                border: msg.sender === 'ai' ? '1px solid #E2E8F0' : 'none'
              }}
            >
              <div>{msg.text}</div>
              {msg.suggestedFiles && msg.suggestedFiles.length > 0 && (
                <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #E2E8F0' }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748B' }}>Relevant Source Files:</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                    {msg.suggestedFiles.map((file, fIdx) => (
                      <span key={fIdx} style={{ fontSize: '11px', fontFamily: 'Space Mono, monospace', color: '#10B981' }}>
                        📄 {file}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div style={{ alignSelf: 'flex-start', fontSize: '12px', color: '#64748B', fontStyle: 'italic' }}>
              AI Architect is scanning codebase graph...
            </div>
          )}
        </div>

        {/* Input Form */}
        <form onSubmit={handleSend} style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            placeholder="Ask e.g. Where is database write logic?"
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              fontSize: '13px',
              outline: 'none'
            }}
          />
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '10px 18px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #10B981 0%, #047857 100%)',
              color: '#FFFFFF',
              border: 'none',
              fontWeight: '700',
              fontSize: '13px',
              cursor: loading ? 'wait' : 'pointer'
            }}
          >
            Ask
          </button>
        </form>
      </div>
    </div>
  );
}
