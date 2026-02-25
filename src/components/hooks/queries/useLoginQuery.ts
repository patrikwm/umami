import { useSession } from 'next-auth/react';
import { useEffect } from 'react';
import { setUser, useApp } from '@/store/app';
import { useApi } from '../useApi';

const selector = (state: { user: any }) => state.user;

export function useLoginQuery() {
  const { data: session, status } = useSession();
  const { post, useQuery } = useApi();
  const user = useApp(selector);

  // When we have an Auth.js session, fetch full user data (including teams)
  const query = useQuery({
    queryKey: ['login', session?.user?.id],
    queryFn: async () => {
      const data = await post('/auth/verify');

      setUser(data);

      return data;
    },
    enabled: status === 'authenticated' && !user,
  });

  // Set user from session if verify hasn't been called yet
  useEffect(() => {
    if (session?.user && !user && query.isError) {
      setUser(session.user);
    }
  }, [session, user, query.isError]);

  return {
    user: user || (status === 'authenticated' ? session?.user : null),
    setUser,
    isLoading: status === 'loading' || query.isLoading,
    error: status === 'unauthenticated' ? new Error('Not authenticated') : query.error,
  };
}
