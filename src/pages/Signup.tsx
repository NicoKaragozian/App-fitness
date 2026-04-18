import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { signUp, signIn } from '../lib/authClient';

export const Signup: React.FC = () => {
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

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-outline-variant/30" />
          <span className="font-label text-label-sm text-on-surface-variant/50">or</span>
          <div className="flex-1 h-px bg-outline-variant/30" />
        </div>

        <button
          onClick={handleGoogleLogin}
          disabled={googleLoading}
          className="w-full bg-surface-container border border-outline-variant/30 text-on-surface font-display font-bold text-sm py-3 rounded-xl tracking-widest uppercase hover:border-primary/50 hover:text-primary transition-colors disabled:opacity-50 mb-4 flex items-center justify-center gap-3"
        >
          {googleLoading ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              Connecting...
            </span>
          ) : (
            <>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </>
          )}
        </button>

        <p className="font-label text-label-sm text-on-surface-variant/60 text-center">
          Already have an account?{' '}
          <Link to="/login" className="text-primary hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
};
