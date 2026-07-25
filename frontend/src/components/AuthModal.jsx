import React, { useState } from 'react';

export default function AuthModal({ isOpen, onClose, onAuthSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  // Password Validation Rules
  const hasMinLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  const isPasswordStrong = hasMinLength && hasUpper && hasLower && hasNumber && hasSpecial;

  const validateEmail = (val) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Form Validations
    if (!validateEmail(email)) {
      setError('Please enter a valid email address (e.g. user@domain.com)');
      return;
    }

    if (!isLogin) {
      if (!name.trim()) {
        setError('Please enter your full name');
        return;
      }
      if (!isPasswordStrong) {
        setError('Password must be at least 8 characters and include uppercase, lowercase, number, and special character');
        return;
      }
    }

    setLoading(true);

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const payload = isLogin ? { email, password } : { email, password, name };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Authentication failed');
      }

      // Store Auth Token in localStorage
      if (data.token) {
        localStorage.setItem('xray_auth_token', data.token);
        localStorage.setItem('xray_user', JSON.stringify(data.user));
      }

      if (onAuthSuccess) onAuthSuccess(data.user);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    // Simulating OAuth Google Sign In
    const googleUser = {
      id: `goog_${Date.now()}`,
      name: name || 'Google Developer',
      email: email && validateEmail(email) ? email : 'developer@gmail.com',
      tier: 'pro',
      provider: 'google'
    };
    localStorage.setItem('xray_auth_token', `goog_token_${Date.now()}`);
    localStorage.setItem('xray_user', JSON.stringify(googleUser));
    if (onAuthSuccess) onAuthSuccess(googleUser);
    onClose();
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
      zIndex: 200
    }}>
      <div style={{
        background: '#FFFFFF',
        borderRadius: '16px',
        padding: '28px',
        width: '420px',
        maxWidth: '94%',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
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
            fontSize: '18px',
            cursor: 'pointer',
            color: '#64748B'
          }}
        >
          ✕
        </button>

        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #FF5E1A 0%, #FF2A00 100%)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            marginBottom: '10px'
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#111827' }}>
            {isLogin ? 'Sign In to CodeBaseX-Ray' : 'Create Developer Account'}
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748B' }}>
            {isLogin ? 'Access your saved codebase architecture workspaces' : 'Start saving and monitoring architecture graphs'}
          </p>
        </div>

        {/* Google SSO Button */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          style={{
            width: '100%',
            padding: '10px',
            borderRadius: '8px',
            border: '1px solid #CBD5E1',
            background: '#FFFFFF',
            color: '#1E293B',
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            marginBottom: '16px',
            transition: 'background 0.2s'
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
          </svg>
          Continue with Google
        </button>

        <div style={{ display: 'flex', alignItems: 'center', margin: '14px 0', gap: '10px' }}>
          <div style={{ flex: 1, height: '1px', background: '#E2E8F0' }} />
          <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: '500' }}>OR EMAIL</span>
          <div style={{ flex: 1, height: '1px', background: '#E2E8F0' }} />
        </div>

        {error && (
          <div style={{
            background: '#FEF2F2',
            border: '1px solid #FCA5A5',
            color: '#DC2626',
            padding: '10px 14px',
            borderRadius: '8px',
            fontSize: '12px',
            marginBottom: '16px'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Palash Developer"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          )}

          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="developer@company.com"
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                fontSize: '13px',
                color: '#0F172A',
                background: '#FFFFFF',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{
                  width: '100%',
                  padding: '10px 42px 10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '13px',
                  color: '#0F172A',
                  background: '#FFFFFF',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '12px',
                  color: '#64748B',
                  padding: '4px'
                }}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              </button>
            </div>

            {/* Registration Password Requirements Badge */}
            {!isLogin && (
              <div style={{ marginTop: '8px', padding: '8px 10px', background: '#F8FAFC', borderRadius: '6px', fontSize: '11px', border: '1px solid #E2E8F0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                <span style={{ color: hasMinLength ? '#166534' : '#64748B' }}>
                  {hasMinLength ? '✓' : '•'} 8+ Characters
                </span>
                <span style={{ color: hasUpper ? '#166534' : '#64748B' }}>
                  {hasUpper ? '✓' : '•'} Uppercase Letter
                </span>
                <span style={{ color: hasLower ? '#166534' : '#64748B' }}>
                  {hasLower ? '✓' : '•'} Lowercase Letter
                </span>
                <span style={{ color: hasNumber && hasSpecial ? '#166534' : '#64748B' }}>
                  {hasNumber && hasSpecial ? '✓' : '•'} Number & Special
                </span>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #FF5E1A 0%, #FF2A00 100%)',
              color: '#FFFFFF',
              fontSize: '14px',
              fontWeight: '700',
              border: 'none',
              cursor: loading ? 'wait' : 'pointer',
              boxShadow: '0 4px 14px rgba(255, 94, 26, 0.35)'
            }}
          >
            {loading ? 'Authenticating...' : (isLogin ? 'Sign In' : 'Create Account')}
          </button>
        </form>

        <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '12px', color: '#64748B' }}>
          {isLogin ? "Don't have an account? " : 'Already registered? '}
          <button
            onClick={() => setIsLogin(!isLogin)}
            style={{ background: 'none', border: 'none', color: '#FF5E1A', fontWeight: '700', cursor: 'pointer', padding: 0 }}
          >
            {isLogin ? 'Create one now' : 'Sign In'}
          </button>
        </div>
      </div>
    </div>
  );
}
