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
      <span style={{ color: '#FF4D00', fontSize: '18px', fontWeight: 'bold' }}>✓</span>
      <span>{message}</span>
    </div>
  );
}

export default Toast;
