import React, { useEffect } from 'react';

function Toast({ message, onClose }) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      if (onClose) onClose();
    }, 3000);
    return () => clearTimeout(timer);
  }, [message, onClose]);

  if (!message) return null;

  return (
    <div style={{
      position: 'fixed',
      top: '24px',
      right: '24px',
      background: '#1A1A1E',
      border: '1.5px solid #FF4D00',
      color: '#FFFFFF',
      padding: '12px 20px',
      borderRadius: '10px',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      fontSize: '14px',
      fontWeight: '600',
      zIndex: 9999,
      fontFamily: '"Space Grotesk", sans-serif',
      letterSpacing: '0.01em'
    }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF4D00" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      <span>{message}</span>
    </div>
  );
}

export default Toast;
