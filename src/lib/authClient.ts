import { createAuthClient } from 'better-auth/react';

// `baseURL: '/api/auth'` breaks client init (Better Auth needs a full URL or use basePath only).
export const authClient = createAuthClient({
  basePath: '/api/auth',
});

export const {
  useSession,
  signIn,
  signUp,
  signOut,
} = authClient;
