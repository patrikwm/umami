'use client';
import { Icon } from '@umami/react-zen';
import { AlertCircle, ChevronRight, Eye, EyeOff } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { type ClientSafeProvider, getProviders, signIn } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { ProviderIcon } from '@/components/common/ProviderIcon';
import { useMessages } from '@/components/hooks';
import { Logo } from '@/components/svg';
import styles from './Login.module.css';

export function LoginForm() {
  const { formatMessage, labels, messages } = useMessages();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [providers, setProviders] = useState<Record<string, ClientSafeProvider>>({});
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState<'local' | 'sso' | null>(null);

  const callbackError = searchParams.get('error');

  useEffect(() => {
    // Fetch both NextAuth providers and login configuration in parallel
    Promise.all([
      getProviders(),
      fetch('/api/auth/login-config')
        .then(res => res.json())
        .catch(() => ({ hasPrimarySsoProvider: false })),
    ]).then(([authProviders, loginConfig]) => {
      if (authProviders) {
        setProviders(authProviders);
      }

      const hasCredentials = !!authProviders?.credentials;
      const hasPrimaryProvider = loginConfig?.hasPrimarySsoProvider || false;

      // Determine default tab
      if (hasPrimaryProvider) {
        // Primary SSO provider configured → default to SSO
        setActiveTab('sso');
      } else if (!hasCredentials && Object.keys(authProviders || {}).length > 0) {
        // No credentials provider available → default to SSO
        setActiveTab('sso');
      } else {
        // Default to local login
        setActiveTab('local');
      }
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;

    try {
      const result = await signIn('credentials', {
        username,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(formatMessage(messages.incorrectUsernamePassword));
      } else if (result?.ok) {
        router.push('/');
      }
    } catch {
      setError(formatMessage(messages.error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProviderSignIn = (providerId: string) => {
    signIn(providerId, { callbackUrl: '/' });
  };

  const credentialsProvider = providers.credentials;
  const oauthProviders = Object.values(providers).filter(p => p.id !== 'credentials');
  const hasBothModes = !!credentialsProvider && oauthProviders.length > 0;
  const errorMessage = error || callbackError;

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        {/* Header */}
        <div className={styles.header}>
          <Icon size="lg">
            <Logo />
          </Icon>
          <span className={styles.brand}>umami</span>
        </div>

        {/* Tabs — only when both local + SSO are available */}
        {hasBothModes && (
          <div className={styles.tabs} role="tablist">
            <button
              type="button"
              className={styles.tab}
              role="tab"
              data-active={activeTab === 'local'}
              onClick={() => setActiveTab('local')}
            >
              {formatMessage(labels.localAccount)}
            </button>
            <button
              type="button"
              className={styles.tab}
              role="tab"
              data-active={activeTab === 'sso'}
              onClick={() => setActiveTab('sso')}
            >
              {formatMessage(labels.singleSignOn)}
            </button>
          </div>
        )}

        {/* Local login panel */}
        <div
          className={styles.panel}
          data-active={!hasBothModes ? !!credentialsProvider : activeTab === 'local'}
        >
          {errorMessage && (
            <div className={styles.error}>
              <AlertCircle size={14} />
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="login-username">
                {formatMessage(labels.username)}
              </label>
              <input
                id="login-username"
                className={styles.input}
                type="text"
                name="username"
                placeholder="admin"
                autoComplete="username"
                required
                data-test="input-username"
              />
            </div>

            <div className={styles.field} style={{ marginTop: 14 }}>
              <label className={styles.label} htmlFor="login-password">
                {formatMessage(labels.password)}
              </label>
              <div className={styles.inputWrap}>
                <input
                  id="login-password"
                  className={styles.input}
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  data-test="input-password"
                />
                <button
                  type="button"
                  className={styles.eyeBtn}
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className={styles.btnPrimary}
              disabled={isSubmitting}
              data-test="button-submit"
              style={{ marginTop: 16 }}
            >
              {formatMessage(labels.login)}
            </button>
          </form>
        </div>

        {/* SSO panel */}
        <div
          className={styles.panel}
          data-active={
            !hasBothModes ? oauthProviders.length > 0 && !credentialsProvider : activeTab === 'sso'
          }
        >
          {oauthProviders.length > 0 ? (
            <div className={styles.providerList}>
              {oauthProviders.map(provider => (
                <button
                  key={provider.id}
                  type="button"
                  className={styles.providerBtn}
                  onClick={() => handleProviderSignIn(provider.id)}
                >
                  <ProviderIcon provider={provider.id} size={18} />
                  <span className={styles.providerBtnLabel}>
                    {formatMessage(labels.continueWith, { provider: provider.name })}
                  </span>
                  <ChevronRight size={14} className={styles.chevron} />
                </button>
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>{formatMessage(labels.noSsoProviders)}</div>
          )}
        </div>
      </div>

      <div className={styles.footer}>
        <span>umami analytics</span>
      </div>
    </div>
  );
}
