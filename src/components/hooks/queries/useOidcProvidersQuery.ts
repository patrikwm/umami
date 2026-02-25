import { useApi } from '../useApi';
import { useModified } from '../useModified';
import { usePagedQuery } from '../usePagedQuery';

export function useOidcProvidersQuery() {
  const { get } = useApi();
  const { modified } = useModified('oidc-providers');

  return usePagedQuery({
    queryKey: ['oidc-providers:admin', { modified }],
    queryFn: (pageParams: any) => {
      return get('/oidc-providers', {
        ...pageParams,
      });
    },
  });
}
