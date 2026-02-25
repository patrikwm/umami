'use client';
import { signOut } from 'next-auth/react';
import { useEffect } from 'react';
import { removeClientAuthToken } from '@/lib/client';
import { setUser } from '@/store/app';

export function LogoutPage() {
  useEffect(() => {
    async function logout() {
      // Check if this is an OIDC logout
      try {
        const response = await fetch('/api/auth/oidc-logout-url');
        const data = await response.json();

        // Clear legacy token
        removeClientAuthToken();
        setUser(null);

        if (data.logoutUrl) {
          // OIDC logout: Sign out from Auth.js (clears session cookie)
          // then redirect to provider's end_session endpoint
          await signOut({ redirect: false });

          // Redirect to OIDC provider logout
          // Provider will then redirect back to our login page (post_logout_redirect_uri)
          window.location.href = data.logoutUrl;
        } else {
          // Local credentials logout: just clear session and redirect to login
          await signOut({ callbackUrl: `${process.env.basePath || ''}/login` });
        }
      } catch (error) {
        console.error('Logout error:', error);
        // Fallback to regular logout on error
        await signOut({ callbackUrl: `${process.env.basePath || ''}/login` });
      }
    }

    logout();
  }, []);

  return null;
}
