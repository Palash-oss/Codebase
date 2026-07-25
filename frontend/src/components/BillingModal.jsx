import React, { useState } from 'react';

export default function BillingModal({ isOpen, onClose, currentUser, onUpgradeSuccess }) {
  const [loadingPlan, setLoadingPlan] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const handleSelectPlan = async (planKey) => {
    setLoadingPlan(planKey);
    setSuccessMsg('');

    try {
      const token = localStorage.getItem('xray_auth_token') || '';
      const res = await fetch('/api/billing/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ plan: planKey })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setSuccessMsg(`Upgraded to ${planKey.toUpperCase()} Plan successfully!`);
        if (data.user) {
          localStorage.setItem('xray_user', JSON.stringify(data.user));
          if (onUpgradeSuccess) onUpgradeSuccess(data.user);
        }
      } else {
        throw new Error(data.error || 'Failed to initiate plan upgrade');
      }
    } catch (err) {
      alert(`Billing Error: ${err.message}`);
    } finally {
      setLoadingPlan('');
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
      zIndex: 210
    }}>
      <div style={{
        background: '#FFFFFF',
        borderRadius: '20px',
        padding: '32px',
        width: '740px',
        maxWidth: '92%',
        boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
        border: '1px solid #E2E8F0',
        position: 'relative'
      }}>
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

        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: '#111827' }}>
            Upgrade CodeBaseX-Ray Subscription
          </h2>
          <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#64748B' }}>
            Unlock unlimited private repos, live GitHub webhook sync, and 4K Ultra HD PDF exports
          </p>
        </div>

        {successMsg && (
          <div style={{
            background: '#F0FDF4',
            border: '1px solid #86EFAC',
            color: '#166534',
            padding: '10px 14px',
            borderRadius: '8px',
            fontSize: '13px',
            marginBottom: '20px',
            textAlign: 'center',
            fontWeight: '600'
          }}>
            {successMsg}
          </div>
        )}

        {/* Pricing Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
          {/* Free Tier */}
          <div style={{
            border: '1px solid #E2E8F0',
            borderRadius: '14px',
            padding: '20px',
            background: '#F8FAFC',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div>
              <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#111827' }}>Free</h4>
              <div style={{ fontSize: '24px', fontWeight: '800', color: '#111827', margin: '10px 0 4px 0' }}>$0</div>
              <p style={{ fontSize: '11px', color: '#64748B', margin: 0 }}>Forever Free</p>

              <ul style={{ paddingLeft: '16px', fontSize: '12px', color: '#475569', margin: '16px 0 0 0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <li>Public Repositories</li>
                <li>Standard 2D/3D Architecture</li>
                <li>5 Saved Workspaces</li>
              </ul>
            </div>
            <button
              disabled
              style={{
                marginTop: '20px',
                padding: '10px',
                borderRadius: '8px',
                background: '#E2E8F0',
                color: '#64748B',
                border: 'none',
                fontWeight: '700',
                fontSize: '12px'
              }}
            >
              Current Plan
            </button>
          </div>

          {/* Pro Tier */}
          <div style={{
            border: '2px solid #FF5E1A',
            borderRadius: '14px',
            padding: '20px',
            background: '#FFF7ED',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 8px 24px rgba(255, 94, 26, 0.15)'
          }}>
            <div style={{
              position: 'absolute',
              top: '-12px',
              right: '16px',
              background: '#FF5E1A',
              color: '#FFFFFF',
              fontSize: '10px',
              fontWeight: '800',
              padding: '2px 8px',
              borderRadius: '10px',
              textTransform: 'uppercase'
            }}>
              Most Popular
            </div>

            <div>
              <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#111827' }}>Pro Developer</h4>
              <div style={{ fontSize: '24px', fontWeight: '800', color: '#111827', margin: '10px 0 4px 0' }}>$19 <span style={{ fontSize: '12px', fontWeight: '500' }}>/mo</span></div>
              <p style={{ fontSize: '11px', color: '#64748B', margin: 0 }}>Billed Monthly</p>

              <ul style={{ paddingLeft: '16px', fontSize: '12px', color: '#334155', margin: '16px 0 0 0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <li>Private & Public Repos</li>
                <li>Live GitHub Webhook Sync</li>
                <li>4K HD & Printable PDF Export</li>
                <li>AI Architect Assistant</li>
              </ul>
            </div>
            <button
              onClick={() => handleSelectPlan('pro')}
              disabled={loadingPlan === 'pro'}
              style={{
                marginTop: '20px',
                padding: '10px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #FF5E1A 0%, #FF2A00 100%)',
                color: '#FFFFFF',
                border: 'none',
                fontWeight: '700',
                fontSize: '12px',
                cursor: loadingPlan === 'pro' ? 'wait' : 'pointer'
              }}
            >
              {loadingPlan === 'pro' ? 'Processing...' : 'Upgrade to Pro'}
            </button>
          </div>

          {/* Team Tier */}
          <div style={{
            border: '1px solid #8B5CF6',
            borderRadius: '14px',
            padding: '20px',
            background: '#F5F3FF',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div>
              <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#111827' }}>Team & Enterprise</h4>
              <div style={{ fontSize: '24px', fontWeight: '800', color: '#111827', margin: '10px 0 4px 0' }}>$49 <span style={{ fontSize: '12px', fontWeight: '500' }}>/mo</span></div>
              <p style={{ fontSize: '11px', color: '#64748B', margin: 0 }}>Up to 10 Engineers</p>

              <ul style={{ paddingLeft: '16px', fontSize: '12px', color: '#334155', margin: '16px 0 0 0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <li>Everything in Pro</li>
                <li>GitHub PR Guard Bot</li>
                <li>Shared Team Workspaces</li>
                <li>Priority API & Support</li>
              </ul>
            </div>
            <button
              onClick={() => handleSelectPlan('team')}
              disabled={loadingPlan === 'team'}
              style={{
                marginTop: '20px',
                padding: '10px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%)',
                color: '#FFFFFF',
                border: 'none',
                fontWeight: '700',
                fontSize: '12px',
                cursor: loadingPlan === 'team' ? 'wait' : 'pointer'
              }}
            >
              {loadingPlan === 'team' ? 'Processing...' : 'Upgrade to Team'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
