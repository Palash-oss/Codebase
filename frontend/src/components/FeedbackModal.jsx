import React, { useState } from 'react';

export default function FeedbackModal({ isOpen, onClose, currentUser, activeRepoName }) {
  const [category, setCategory] = useState('Bug Report');
  const [severity, setSeverity] = useState('Medium');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim()) {
      setErrorMsg('Please enter a description for your feedback/ticket');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const token = localStorage.getItem('xray_auth_token') || '';
      const res = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          category,
          severity,
          subject: subject.trim() || `${category} Ticket`,
          message: message.trim(),
          email: email.trim() || currentUser?.email || 'palash.pathare005@gmail.com',
          activeRepo: activeRepoName || 'None',
          browserEnv: `${navigator.userAgent}`
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg('Your support ticket has been submitted successfully. Our engineering team will review it.');
        setSubject('');
        setMessage('');
        setTimeout(() => {
          setSuccessMsg('');
          onClose();
        }, 2200);
      } else {
        throw new Error(data.error || 'Failed to submit ticket');
      }
    } catch (err) {
      setErrorMsg(`Submission Error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.65)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 220
    }}>
      <div style={{
        background: '#FFFFFF',
        borderRadius: '20px',
        padding: '28px',
        width: '560px',
        maxWidth: '94%',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
        border: '1px solid #E2E8F0',
        position: 'relative'
      }}>
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'none',
            border: 'none',
            fontSize: '20px',
            cursor: 'pointer',
            color: '#64748B'
          }}
        >
          ✕
        </button>

        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #FF5E1A 0%, #FF2E93 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF'
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#111827' }}>
              Feedback & Support Portal
            </h2>
            <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748B' }}>
              Submit feature requests, report bugs, or share your thoughts
            </p>
          </div>
        </div>

        {/* Success Alert */}
        {successMsg && (
          <div style={{
            background: '#F0FDF4',
            border: '1px solid #86EFAC',
            color: '#166534',
            padding: '12px 16px',
            borderRadius: '10px',
            fontSize: '13px',
            marginBottom: '16px',
            fontWeight: '600'
          }}>
            {successMsg}
          </div>
        )}

        {/* Error Alert */}
        {errorMsg && (
          <div style={{
            background: '#FEF2F2',
            border: '1px solid #FCA5A5',
            color: '#991B1B',
            padding: '12px 16px',
            borderRadius: '10px',
            fontSize: '13px',
            marginBottom: '16px',
            fontWeight: '600'
          }}>
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Category Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#374151', marginBottom: '8px' }}>
              Feedback Category
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {[
                { name: 'Bug Report' },
                { name: 'Feature Request' },
                { name: 'General Feedback' },
                { name: 'Billing / Account' }
              ].map(cat => (
                <button
                  type="button"
                  key={cat.name}
                  onClick={() => setCategory(cat.name)}
                  style={{
                    padding: '10px',
                    borderRadius: '8px',
                    border: category === cat.name ? '2px solid #FF5E1A' : '1px solid #E2E8F0',
                    background: category === cat.name ? '#FFF7ED' : '#F8FAFC',
                    color: category === cat.name ? '#FF5E1A' : '#475569',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Severity & Email Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#374151', marginBottom: '6px' }}>
                Priority / Severity
              </label>
              <select
                value={severity}
                onChange={e => setSeverity(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #D1D5DB',
                  fontSize: '13px',
                  color: '#111827',
                  background: '#FFFFFF',
                  outline: 'none'
                }}
              >
                <option value="Low">Low Priority</option>
                <option value="Medium">Medium Priority</option>
                <option value="High">High Priority</option>
                <option value="Urgent">Urgent / Critical</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#374151', marginBottom: '6px' }}>
                Your Email Address
              </label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #D1D5DB',
                  fontSize: '13px',
                  color: '#111827',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          {/* Subject */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#374151', marginBottom: '6px' }}>
              Subject Title
            </label>
            <input
              type="text"
              placeholder="e.g., SVG Diagram Export alignment issue"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #D1D5DB',
                fontSize: '13px',
                color: '#111827',
                outline: 'none'
              }}
            />
          </div>

          {/* Description Message */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#374151', marginBottom: '6px' }}>
              Detailed Description <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <textarea
              rows="4"
              placeholder="Please describe what happened, steps to reproduce, or feature ideas..."
              value={message}
              onChange={e => setMessage(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #D1D5DB',
                fontSize: '13px',
                color: '#111827',
                outline: 'none',
                resize: 'vertical'
              }}
            />
          </div>

          {/* Auto-captured Context Badge */}
          {activeRepoName && (
            <div style={{
              background: '#F8FAFC',
              border: '1px dashed #CBD5E1',
              borderRadius: '8px',
              padding: '8px 12px',
              fontSize: '11px',
              color: '#64748B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <span>Auto-attached Context:</span>
              <strong style={{ color: '#0F172A' }}>📦 Repo: {activeRepoName}</strong>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting}
            style={{
              marginTop: '8px',
              padding: '12px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #FF5E1A 0%, #FF2E93 100%)',
              color: '#FFFFFF',
              border: 'none',
              fontWeight: '700',
              fontSize: '14px',
              cursor: submitting ? 'wait' : 'pointer',
              boxShadow: '0 4px 14px rgba(255, 94, 26, 0.3)'
            }}
          >
            {submitting ? 'Submitting Ticket...' : 'Submit Support Ticket'}
          </button>
        </form>
      </div>
    </div>
  );
}
