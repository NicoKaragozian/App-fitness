import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { signUp, signIn } from '../lib/authClient';
import { useAuthFeatures } from '../hooks/useAuthFeatures';
import { GoogleSignInBlock } from '../components/auth/GoogleSignInBlock';

export const Signup: React.FC = () => {
  const { features } = useAuthFeatures();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await signUp.email({ name, email, password });
      if (result.error) {
        setError(result.error.message || 'Signup failed');
      }
    } catch (err: any) {
      setError(err.message || 'Signup failed');
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

        <h2 className="font-display font-bold text-on-surface text-lg tracking-widest uppercase text-center mb-6">Create Account</h2>

        <form onSubmit={handleSignup} className="space-y-3 mb-4">
          <div>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Full name"
              required
              className="w-full bg-surface-container border border-outline-variant/30 rounded-xl px-4 py-3 text-on-surface font-body text-sm placeholder-on-surface-variant/40 focus:outline-none focus:border-primary/50 transition-colors"
            />
          </div>
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
              placeholder="Password (min 8 characters)"
              required
              minLength={8}
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
                Creating account...
              </span>
            ) : 'Create Account'}
          </button>
        </form>

        {features?.google && (
          <div className="mb-4">
            <GoogleSignInBlock onClick={handleGoogleLogin} loading={googleLoading} />
          </div>
        )}

        <p className="font-label text-label-sm text-on-surface-variant/60 text-center">
          Already have an account?{' '}
          <Link to="/login" className="text-primary hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
};
