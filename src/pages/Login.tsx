import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { signIn } from '../lib/authClient';
import { useAuthFeatures } from '../hooks/useAuthFeatures';
import { GoogleSignInBlock } from '../components/auth/GoogleSignInBlock';

export const Login: React.FC = () => {
  const { enterDemoMode } = useAuth();
  const { features } = useAuthFeatures();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await signIn.email({ email, password });
      if (result.error) {
        setError(result.error.message || 'Invalid credentials');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      await signIn.social({ provider: 'google', callbackURL: '/' });
    } catch (err: any) {
      setError(err.message || 'Google login failed');
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase mb-2">Personal Fitness Coach</p>
          <h1 className="font-display text-4xl font-bold text-primary tracking-tight">DRIFT</h1>
        </div>

        {/* Email/Password Form */}
        <form onSubmit={handleEmailLogin} className="space-y-3 mb-4">
          <div>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Email"
              required
              className="w-full bg-surface-container border border-outline-variant/30 rounded-xl px-4 py-3 text-on-surface font-body text-sm placeholder-on-surface-variant/40 focus:outline-none focus:border-primary/50 transition-colors"
            />
          </div>
          <div>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              required
              className="w-full bg-surface-container border border-outline-variant/30 rounded-xl px-4 py-3 text-on-surface font-body text-sm placeholder-on-surface-variant/40 focus:outline-none focus:border-primary/50 transition-colors"
            />
          </div>

          {error && (
            <div className="bg-red-950/30 border border-red-900/40 rounded-xl p-3">
              <p className="font-label text-label-sm text-red-400">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-surface font-display font-bold text-sm py-3 rounded-xl tracking-widest uppercase hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-surface border-t-transparent rounded-full animate-spin" />
                Signing in...
              </span>
            ) : 'Sign in'}
          </button>
        </form>

        {features?.google && (
          <GoogleSignInBlock onClick={handleGoogleLogin} loading={googleLoading} />
        )}

        {/* Sign up link */}
        <p className="font-label text-label-sm text-on-surface-variant/60 text-center mb-4">
          Don't have an account?{' '}
          <Link to="/signup" className="text-primary hover:underline">Sign up</Link>
        </p>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-outline-variant/20" />
          <span className="font-label text-label-sm text-on-surface-variant/30">or</span>
          <div className="flex-1 h-px bg-outline-variant/20" />
        </div>

        {/* Demo mode */}
        <button
          onClick={enterDemoMode}
          className="w-full bg-surface-container border border-outline-variant/20 text-on-surface-variant font-display font-bold text-sm py-3 rounded-xl tracking-widest uppercase hover:text-on-surface hover:border-outline-variant/50 transition-colors"
        >
          Try Demo Mode
        </button>
        <p className="font-label text-label-sm text-on-surface-variant/40 mt-2 text-center">
          Explore the app with sample data
        </p>
      </div>
    </div>
  );
};
