import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email?: string;
      name?: string;
      image?: string;
      role: string;
      username: string;
    };
    provider?: string; // OIDC provider ID for logout
    idToken?: string; // ID token for OIDC logout
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: string;
    username: string;
    provider?: string; // OIDC provider ID
    idToken?: string; // ID token from OIDC login
  }
}
