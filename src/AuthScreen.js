import React, { useState } from 'react';
import { auth } from './firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth';

const T = {
  bg:       '#0B1F22',
  surface:  '#0F2A2E',
  border:   '#1C4347',
  mint:     '#3ECDA0',
  mintBg:   'rgba(62,205,160,0.08)',
  gold:     '#D4C44C',
  white:    '#E8ECE9',
  light:    '#A3B5B0',
  muted:    '#6B8580',
  dim:      '#4A635E',
  error:    '#E85D5D',
  errorBg:  'rgba(232,93,93,0.10)',
  font:     "'Helvetica Neue', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  radius:   10,
  radiusLg: 14,
  radiusPill: 20,
};

export default function AuthScreen() {
  const [mode, setMode] = useState('login'); // login | signup | reset
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'signup') {
        if (password !== confirm) { setError('Passwords do not match'); setLoading(false); return; }
        if (password.length < 6) { setError('Password must be at least 6 characters'); setLoading(false); return; }
        await createUserWithEmailAndPassword(auth, email, password);
      } else if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
      } else if (mode === 'reset') {
        await sendPasswordResetEmail(auth, email);
        setResetSent(true);
        setLoading(false);
        return;
      }
    } catch (err) {
      const msg = err.code === 'auth/user-not-found' ? 'No account with that email'
        : err.code === 'auth/wrong-password' ? 'Incorrect password'
        : err.code === 'auth/invalid-credential' ? 'Invalid email or password'
        : err.code === 'auth/email-already-in-use' ? 'Email already registered'
        : err.code === 'auth/weak-password' ? 'Password is too weak'
        : err.code === 'auth/invalid-email' ? 'Invalid email address'
        : err.message || 'Something went wrong';
      setError(msg);
    }
    setLoading(false);
  };

  const inputStyle = {
    width: '100%', padding: '12px 16px', borderRadius: T.radius,
    border: `1px solid ${T.border}`, background: T.surface, color: T.white,
    fontSize: 14, fontFamily: T.font, fontWeight: 300, outline: 'none',
    boxSizing: 'border-box', transition: 'border-color 0.15s',
  };

  return (
    <div style={{ background: T.bg, minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', fontFamily: T.font, padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: T.mint,
              boxShadow: `0 0 12px ${T.mint}` }} />
            <span style={{ fontSize: 18, fontWeight: 500, color: T.white, letterSpacing: 0.3 }}>Job Agent</span>
          </div>
          <p style={{ fontSize: 13, color: T.muted, margin: 0 }}>
            {mode === 'login' ? 'Sign in to your account' :
             mode === 'signup' ? 'Create your account' : 'Reset your password'}
          </p>
        </div>

        {/* Form Card */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radiusLg,
          padding: 28 }}>

          {error && (
            <div style={{ background: T.errorBg, border: `1px solid ${T.error}33`, borderRadius: T.radius,
              padding: '10px 14px', marginBottom: 16, fontSize: 12, color: T.error }}>{error}</div>
          )}

          {resetSent ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 14, color: T.mint, marginBottom: 8 }}>Reset link sent!</div>
              <div style={{ fontSize: 12, color: T.muted, marginBottom: 16 }}>Check {email} for instructions</div>
              <button onClick={() => { setMode('login'); setResetSent(false); setError(''); }}
                style={{ background: 'none', border: 'none', color: T.mint, fontSize: 13,
                  cursor: 'pointer', fontFamily: T.font, fontWeight: 500 }}>Back to login</button>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 600, color: T.muted, textTransform: 'uppercase',
                    letterSpacing: 0.8, marginBottom: 4, display: 'block' }}>Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com" style={inputStyle} autoFocus />
                </div>

                {mode !== 'reset' && (
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 600, color: T.muted, textTransform: 'uppercase',
                      letterSpacing: 0.8, marginBottom: 4, display: 'block' }}>Password</label>
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••" style={inputStyle} />
                  </div>
                )}

                {mode === 'signup' && (
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 600, color: T.muted, textTransform: 'uppercase',
                      letterSpacing: 0.8, marginBottom: 4, display: 'block' }}>Confirm Password</label>
                    <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                      placeholder="••••••••" style={inputStyle} />
                  </div>
                )}

                <button onClick={handleSubmit} disabled={loading}
                  style={{ width: '100%', padding: '12px', borderRadius: T.radiusPill, border: 'none',
                    background: T.mint, color: '#0B1F22', fontSize: 14, fontWeight: 600,
                    cursor: loading ? 'wait' : 'pointer', fontFamily: T.font, marginTop: 4,
                    opacity: loading ? 0.6 : 1, transition: 'opacity 0.15s' }}>
                  {loading ? 'Please wait…' :
                   mode === 'login' ? 'Sign In' :
                   mode === 'signup' ? 'Create Account' : 'Send Reset Link'}
                </button>
              </div>

              {/* Footer links */}
              <div style={{ marginTop: 16, textAlign: 'center', fontSize: 12 }}>
                {mode === 'login' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <button onClick={() => { setMode('reset'); setError(''); }}
                      style={{ background: 'none', border: 'none', color: T.dim, fontSize: 12,
                        cursor: 'pointer', fontFamily: T.font }}>Forgot password?</button>
                    <span style={{ color: T.muted }}>
                      No account?{' '}
                      <button onClick={() => { setMode('signup'); setError(''); }}
                        style={{ background: 'none', border: 'none', color: T.mint, fontSize: 12,
                          cursor: 'pointer', fontFamily: T.font, fontWeight: 500 }}>Sign up</button>
                    </span>
                  </div>
                )}
                {mode === 'signup' && (
                  <span style={{ color: T.muted }}>
                    Already have an account?{' '}
                    <button onClick={() => { setMode('login'); setError(''); }}
                      style={{ background: 'none', border: 'none', color: T.mint, fontSize: 12,
                        cursor: 'pointer', fontFamily: T.font, fontWeight: 500 }}>Sign in</button>
                  </span>
                )}
                {mode === 'reset' && (
                  <button onClick={() => { setMode('login'); setError(''); }}
                    style={{ background: 'none', border: 'none', color: T.mint, fontSize: 12,
                      cursor: 'pointer', fontFamily: T.font, fontWeight: 500 }}>Back to login</button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
