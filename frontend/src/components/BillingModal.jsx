import React, { useState } from 'react';

export default function BillingModal({ isOpen, onClose, currentUser, onUpgradeSuccess }) {
  const [loadingPlan, setLoadingPlan] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleInstantUpgrade = (planKey) => {
    setLoadingPlan(planKey);
    setErrorMsg('');
    try {
      const uStr = localStorage.getItem('xray_user');
      const user = uStr ? JSON.parse(uStr) : { name: 'Developer User', email: 'developer@codebasexray.com' };
      user.tier = planKey;
      user.subscriptionExpiresAt = new Date(Date.now() + 30 * 86400000).toISOString();
      localStorage.setItem('xray_user', JSON.stringify(user));
      setSuccessMsg(`Account successfully upgraded to ${planKey.toUpperCase()} Plan!`);
      if (onUpgradeSuccess) onUpgradeSuccess(user);
      setTimeout(() => {
        setLoadingPlan('');
        onClose();
      }, 1200);
    } catch (e) {
      setErrorMsg(`Upgrade Error: ${e.message}`);
      setLoadingPlan('');
    }
  };

  const handleSelectPlan = async (planKey) => {
    setLoadingPlan(planKey);
    setSuccessMsg('');
    setErrorMsg('');

    const activeUser = currentUser || (localStorage.getItem('xray_user') ? JSON.parse(localStorage.getItem('xray_user')) : null);
    if (!activeUser) {
      setErrorMsg('Please Sign In or Register your account first before selecting a subscription plan.');
      setLoadingPlan('');
      return;
    }

    try {
      const token = localStorage.getItem('xray_auth_token') || 'goog_token_active_dev';
      const userTz = typeof Intl !== 'undefined' ? (Intl.DateTimeFormat().resolvedOptions().timeZone || '') : '';
      const isIndia = userTz.includes('Kolkata') || userTz.includes('Calcutta') || (typeof navigator !== 'undefined' && (navigator.language === 'en-IN' || navigator.language === 'hi-IN'));
      const preferredCurrency = isIndia ? 'INR' : 'USD';

      // 1. Create Checkout Order on Backend
      const res = await fetch('/api/billing/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ plan: planKey, currency: preferredCurrency })
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to initiate Razorpay payment checkout');
      }

      if (data.provider === 'razorpay' && data.order_id) {
        const isLoaded = await loadRazorpayScript();
        if (!isLoaded) {
          throw new Error('Razorpay SDK failed to load. Please check your connection.');
        }

        const options = {
          key: data.key_id,
          amount: data.amount,
          currency: data.currency,
          name: 'CodeBase X-Ray',
          description: `Upgrade to ${planKey.toUpperCase()} Plan`,
          image: '/og-image.png',
          order_id: data.order_id,
          modal: {
            ondismiss: function () {
              setLoadingPlan('');
            }
          },
          handler: async function (response) {
            try {
              const verifyRes = await fetch('/api/billing/verify-payment', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_signature: response.razorpay_signature,
                  plan: planKey
                })
              });
              
              const verifyData = await verifyRes.json().catch(() => ({}));
              if (verifyRes.ok && verifyData.success) {
                setSuccessMsg(verifyData.message || 'Payment verified successfully!');
                if (verifyData.user) {
                  localStorage.setItem('xray_user', JSON.stringify(verifyData.user));
                  if (onUpgradeSuccess) onUpgradeSuccess(verifyData.user);
                }
                setTimeout(() => {
                  setLoadingPlan('');
                  onClose();
                }, 1500);
              } else {
                throw new Error(verifyData.error || 'Payment verification failed');
              }
            } catch (vErr) {
              setErrorMsg(`Verification Error: ${vErr.message}`);
              setLoadingPlan('');
            }
          },
          prefill: {
            name: currentUser?.name || 'Developer',
            email: currentUser?.email || data.user?.email || 'developer@codebasexray.com'
          },
          theme: {
            color: '#10B981'
          }
        };

        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', function (response){
          setErrorMsg(`Payment Failed: ${response.error?.description || 'Gateway transaction declined'}`);
          setLoadingPlan('');
        });
        rzp.open();
      } else {
        throw new Error(data.error || 'Razorpay Payment Gateway is required to complete subscription purchase.');
      }
    } catch (err) {
      setErrorMsg(`Billing Notice: ${err.message}`);
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
        padding: '24px',
        width: '760px',
        maxWidth: '94%',
        maxHeight: '90vh',
        overflowY: 'auto',
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
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '800', color: 'var(--pink)' }}>
            Upgrade CodeBaseX-Ray Subscription
          </h2>
          <p style={{ margin: '8px 0 0 0', fontSize: '14px', color: 'var(--beige-3)', fontWeight: '500' }}>
            Unlock unlimited private repos, live GitHub webhook sync, and 4K Ultra HD PDF exports
          </p>
        </div>

        {errorMsg && (
          <div style={{
            background: '#FEF2F2',
            border: '1px solid #FCA5A5',
            color: '#991B1B',
            padding: '12px 16px',
            borderRadius: '10px',
            fontSize: '13px',
            marginBottom: '24px',
            textAlign: 'center',
            fontWeight: '600'
          }}>
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div style={{
            background: '#F0FDF4',
            border: '1px solid #86EFAC',
            color: '#166534',
            padding: '12px 16px',
            borderRadius: '10px',
            fontSize: '13px',
            marginBottom: '24px',
            textAlign: 'center',
            fontWeight: '600'
          }}>
            {successMsg}
          </div>
        )}

        {/* Pricing Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '20px' }}>
          {/* Free Tier */}
          <div style={{
            border: '1px solid var(--border-2)',
            borderRadius: '16px',
            padding: '24px',
            background: 'var(--black-3)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div>
              <h4 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: 'var(--pink)' }}>Free</h4>
              <div style={{ fontSize: '28px', fontWeight: '900', color: 'var(--pink)', margin: '12px 0 4px 0' }}>$0</div>
              <p style={{ fontSize: '12px', color: 'var(--beige-3)', margin: 0, fontWeight: '600' }}>Forever Free</p>

              <ul style={{ paddingLeft: '18px', fontSize: '13px', color: 'var(--beige-2)', margin: '20px 0 0 0', display: 'flex', flexDirection: 'column', gap: '10px', fontWeight: '600' }}>
                <li>Public Repositories</li>
                <li>Standard 2D/3D Architecture</li>
                <li>5 Saved Workspaces</li>
              </ul>
            </div>
            <button
              disabled
              style={{
                marginTop: '24px',
                padding: '12px',
                borderRadius: '10px',
                background: 'var(--border)',
                color: 'var(--beige-3)',
                border: 'none',
                fontWeight: '800',
                fontSize: '13px'
              }}
            >
              Current Plan
            </button>
          </div>

          {/* Pro Tier */}
          <div style={{
            border: '2px solid #10B981',
            borderRadius: '16px',
            padding: '24px',
            background: 'var(--black-3)',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 10px 30px rgba(16, 185, 129, 0.2)'
          }}>
            <div style={{
              position: 'absolute',
              top: '-12px',
              right: '20px',
              background: '#10B981',
              color: '#FFFFFF',
              fontSize: '11px',
              fontWeight: '900',
              padding: '3px 10px',
              borderRadius: '12px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Most Popular
            </div>

            <div>
              <h4 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: 'var(--pink)' }}>Pro Developer</h4>
              <div style={{ fontSize: '28px', fontWeight: '900', color: 'var(--pink)', margin: '12px 0 4px 0' }}>$19 <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--beige-3)' }}>/mo</span></div>
              <p style={{ fontSize: '12px', color: '#10B981', margin: 0, fontWeight: '700' }}>Billed Monthly</p>

              <ul style={{ paddingLeft: '18px', fontSize: '13px', color: 'var(--beige-2)', margin: '20px 0 0 0', display: 'flex', flexDirection: 'column', gap: '10px', fontWeight: '600' }}>
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
                marginTop: '24px',
                padding: '12px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                color: '#FFFFFF',
                border: 'none',
                fontWeight: '800',
                fontSize: '13px',
                cursor: loadingPlan === 'pro' ? 'wait' : 'pointer',
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)'
              }}
            >
              {loadingPlan === 'pro' ? 'Processing...' : 'Upgrade to Pro'}
            </button>
          </div>

          {/* Team Tier */}
          <div style={{
            border: '1px solid #10B981',
            borderRadius: '16px',
            padding: '24px',
            background: 'var(--black-3)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div>
              <h4 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: 'var(--pink)' }}>Team & Enterprise</h4>
              <div style={{ fontSize: '28px', fontWeight: '900', color: 'var(--pink)', margin: '12px 0 4px 0' }}>$49 <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--beige-3)' }}>/mo</span></div>
              <p style={{ fontSize: '12px', color: 'var(--beige-3)', margin: 0, fontWeight: '600' }}>Up to 10 Engineers</p>

              <ul style={{ paddingLeft: '18px', fontSize: '13px', color: 'var(--beige-2)', margin: '20px 0 0 0', display: 'flex', flexDirection: 'column', gap: '10px', fontWeight: '600' }}>
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
                marginTop: '24px',
                padding: '12px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                color: '#FFFFFF',
                border: 'none',
                fontWeight: '800',
                fontSize: '13px',
                cursor: loadingPlan === 'team' ? 'wait' : 'pointer',
                boxShadow: '0 4px 14px rgba(5, 150, 105, 0.4)'
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
