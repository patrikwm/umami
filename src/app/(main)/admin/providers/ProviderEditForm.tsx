'use client';
import {
  Button,
  Checkbox,
  Form,
  FormButtons,
  FormField,
  FormSubmitButton,
  ListItem,
  Select,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  Text,
  TextField,
} from '@umami/react-zen';
import { useEffect, useState } from 'react';
import { useMessages, useModified, useUpdateQuery } from '@/components/hooks';
import {
  detectProviderType,
  getDefaultScope,
  getProviderSpec,
  type ProviderType,
} from '@/lib/oidc-providers';

export function ProviderEditForm({ provider, onClose }: { provider: any; onClose?: () => void }) {
  const { mutateAsync, error, isPending } = useUpdateQuery(`/oidc-providers/${provider?.id}`);
  const { formatMessage, labels, messages, getErrorMessage } = useMessages();
  const { touch } = useModified();

  // Detect provider type from stored type field, then fall back to URL detection
  const initialType: ProviderType = (() => {
    // Use stored type if it's a valid provider type
    if (provider?.type && provider.type !== 'oidc' && provider.type !== 'oauth2') {
      return provider.type as ProviderType;
    }
    // Fall back to detection from issuer URL
    if (provider?.issuer) {
      return detectProviderType(provider.issuer);
    }
    // For OAuth2 providers, try detecting from endpoint URLs
    if (provider?.category === 'oauth2') {
      const urls =
        `${provider.authUrl || ''} ${provider.tokenUrl || ''} ${provider.userinfoUrl || ''}`.toLowerCase();
      if (urls.includes('github.com')) return 'github';
      if (urls.includes('discord.com')) return 'discord';
      if (urls.includes('slack.com')) return 'slack';
      return 'github'; // Last resort default
    }
    return 'generic';
  })();

  const [selectedType, setSelectedType] = useState<ProviderType>(initialType);

  // Re-detect when issuer changes
  const handleIssuerChange = (value: string) => {
    if (value) {
      const detected = detectProviderType(value);
      setSelectedType(detected);
    }
  };

  // Get provider spec for selected type
  const providerSpec = selectedType ? getProviderSpec(selectedType) : null;
  const category = providerSpec?.category || provider?.category || 'oidc';

  const handleSubmit = async (data: any) => {
    // Build extraConfig from provider-specific fields
    const extraConfig: Record<string, any> = { ...(provider?.extraConfig || {}) };

    if (providerSpec?.extraFields) {
      providerSpec.extraFields.forEach(field => {
        if (data[field.key] !== undefined) {
          extraConfig[field.key] = data[field.key];
          delete data[field.key]; // Remove from top-level data
        }
      });
    }

    // Parse teamMappings JSON if provided
    let parsedTeamMappings = null;
    if (data.teamMappings?.trim()) {
      try {
        parsedTeamMappings = JSON.parse(data.teamMappings);
      } catch (error) {
        // If JSON is invalid, set error and return
        throw new Error('Invalid JSON format for team mappings');
      }
    }

    const payload: any = {
      ...data,
      category,
      teamMappings: parsedTeamMappings,
      extraConfig: Object.keys(extraConfig).length > 0 ? extraConfig : null,
      enabled: !!data.enabled,
      autoCreate: !!data.autoCreate,
      trusted: !!data.trusted,
      isPrimary: !!data.isPrimary,
      sortOrder: data.sortOrder === '' || data.sortOrder === null ? null : Number(data.sortOrder),
    };

    // Don't send empty clientSecret — server interprets absence as "keep current"
    if (!payload.clientSecret) {
      delete payload.clientSecret;
    }

    // Convert empty strings to null for nullable fields
    [
      'issuer',
      'authUrl',
      'tokenUrl',
      'userinfoUrl',
      'scope',
      'adminGroup',
      'viewOnlyGroup',
    ].forEach(field => {
      if (payload[field] === '') {
        payload[field] = null;
      }
    });

    await mutateAsync(payload, {
      onSuccess: async () => {
        touch('oidc-providers');
        onClose?.();
      },
    });
  };

  if (!provider) {
    return null;
  }

  // Phase 1.4: Compute callback URI
  const authUrl =
    typeof window !== 'undefined' ? window.location.origin : process.env.AUTH_URL || '';
  const callbackUri = `${authUrl}/api/auth/callback/${provider.id}`;

  const showIssuerField = category === 'oidc' || category === 'oidc-quirks';
  const showManualEndpoints = category === 'oauth2';
  const showGroupFields = providerSpec?.supportsGroups !== false;
  const hasExtraFields = providerSpec?.extraFields && providerSpec.extraFields.length > 0;

  // Extract extra config values for default values
  const extraConfigDefaults: Record<string, any> = {};
  if (provider.extraConfig && providerSpec?.extraFields) {
    providerSpec.extraFields.forEach(field => {
      if (provider.extraConfig[field.key] !== undefined) {
        extraConfigDefaults[field.key] = provider.extraConfig[field.key];
      }
    });
  }

  return (
    <Form
      onSubmit={handleSubmit}
      error={getErrorMessage(error)}
      defaultValues={{
        name: provider.name,
        issuer: provider.issuer || '',
        clientId: provider.clientId,
        clientSecret: '',
        scope: provider.scope || '',
        authUrl: provider.authUrl || '',
        tokenUrl: provider.tokenUrl || '',
        userinfoUrl: provider.userinfoUrl || '',
        trusted: provider.trusted,
        adminGroup: provider.adminGroup || '',
        viewOnlyGroup: provider.viewOnlyGroup || '',
        teamMappings: provider.teamMappings ? JSON.stringify(provider.teamMappings, null, 2) : '',
        sortOrder: provider.sortOrder ?? '',
        isPrimary: provider.isPrimary,
        enabled: provider.enabled,
        autoCreate: provider.autoCreate,
        ...extraConfigDefaults,
      }}
    >
      <div style={{ height: '730px', overflow: 'hidden' }}>
        <Tabs style={{ height: '100%' }}>
          <TabList>
            <Tab id="basic">{formatMessage(labels.configuration)}</Tab>
            {showGroupFields && <Tab id="roles">{formatMessage(labels.roleMappings)}</Tab>}
            <Tab id="settings">{formatMessage(labels.settings)}</Tab>
            {!showManualEndpoints && (
              <Tab id="optional">{formatMessage(labels.optionalConfiguration)}</Tab>
            )}
            {hasExtraFields && <Tab id="advanced">{formatMessage(labels.advanced)}</Tab>}
            <Tab id="test">{formatMessage(labels.test)}</Tab>
          </TabList>

          {/* Tab 1: Basic Configuration */}
          <TabPanel id="basic" style={{ height: '730px', overflowY: 'auto' }}>
            {/* Phase 1.4: Display callback URI */}
            <div style={{ marginBottom: '1rem' }}>
              <label>{formatMessage(labels.callbackUri || messages.callbackUri)}</label>
              <TextField value={callbackUri} isReadOnly />
            </div>

            <FormField
              label={formatMessage(labels.name)}
              name="name"
              rules={{ required: formatMessage(labels.required) }}
            >
              <TextField />
            </FormField>

            {/* Provider Type Display */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                {formatMessage(labels.providerType)}
              </label>
              <Text style={{ fontSize: '0.875rem', color: '#666' }}>
                {providerSpec?.displayName || 'Generic OIDC'} (
                {category === 'oidc'
                  ? 'Full OIDC'
                  : category === 'oauth2'
                    ? 'OAuth 2.0'
                    : 'OIDC with quirks'}
                )
              </Text>
              {category === 'oidc' && (
                <Text style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.25rem' }}>
                  {formatMessage(messages.issuerAutoDiscovery)}
                </Text>
              )}
              {category === 'oauth2' && (
                <Text style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.25rem' }}>
                  {formatMessage(messages.oauth2ManualEndpoints)}
                </Text>
              )}
              {!showGroupFields && (
                <Text style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.25rem' }}>
                  {formatMessage(messages.oauth2NoGroups)}
                </Text>
              )}
            </div>

            {/* Issuer field - only for OIDC providers */}
            {showIssuerField && (
              <FormField
                label={formatMessage(labels.issuer)}
                name="issuer"
                rules={{ required: formatMessage(labels.required) }}
              >
                <TextField
                  placeholder={
                    selectedType === 'authentik'
                      ? 'https://authentik.company.com/application/o/umami/'
                      : selectedType === 'keycloak'
                        ? 'https://keycloak.company.com/realms/myrealm'
                        : selectedType === 'okta'
                          ? 'https://company.okta.com'
                          : selectedType === 'entra-id'
                            ? 'https://login.microsoftonline.com/{tenant-id}/v2.0'
                            : selectedType === 'gitlab'
                              ? 'https://gitlab.company.com'
                              : selectedType === 'google'
                                ? 'https://accounts.google.com'
                                : 'https://auth.example.com'
                  }
                  onChange={e => handleIssuerChange(e.target.value)}
                />
              </FormField>
            )}

            <FormField
              label={formatMessage(labels.clientId)}
              name="clientId"
              rules={{ required: formatMessage(labels.required) }}
            >
              <TextField />
            </FormField>
            <FormField
              label={`${formatMessage(labels.clientSecret)} (leave blank to keep current)`}
              name="clientSecret"
            >
              <TextField type="password" placeholder="••••••••" />
            </FormField>

            {/* Phase 1.3: Scope field */}
            <FormField label={formatMessage(labels.scope)} name="scope">
              <TextField
                placeholder={selectedType ? getDefaultScope(selectedType) : 'openid profile email'}
              />
            </FormField>

            {/* Manual endpoint URLs - required for OAuth 2.0 providers */}
            {showManualEndpoints && (
              <>
                <FormField
                  label={formatMessage(labels.authorizationUrl)}
                  name="authUrl"
                  rules={{ required: formatMessage(labels.required) }}
                >
                  <TextField
                    placeholder={
                      selectedType === 'github'
                        ? 'https://github.com/login/oauth/authorize'
                        : selectedType === 'discord'
                          ? 'https://discord.com/api/oauth2/authorize'
                          : selectedType === 'slack'
                            ? 'https://slack.com/oauth/v2/authorize'
                            : 'https://provider.com/oauth/authorize'
                    }
                  />
                </FormField>
                <FormField
                  label={formatMessage(labels.tokenUrl)}
                  name="tokenUrl"
                  rules={{ required: formatMessage(labels.required) }}
                >
                  <TextField
                    placeholder={
                      selectedType === 'github'
                        ? 'https://github.com/login/oauth/access_token'
                        : selectedType === 'discord'
                          ? 'https://discord.com/api/oauth2/token'
                          : selectedType === 'slack'
                            ? 'https://slack.com/api/oauth.v2.access'
                            : 'https://provider.com/oauth/token'
                    }
                  />
                </FormField>
                <FormField
                  label={formatMessage(labels.userinfoUrl)}
                  name="userinfoUrl"
                  rules={{ required: formatMessage(labels.required) }}
                >
                  <TextField
                    placeholder={
                      selectedType === 'github'
                        ? 'https://api.github.com/user'
                        : selectedType === 'discord'
                          ? 'https://discord.com/api/users/@me'
                          : selectedType === 'slack'
                            ? 'https://slack.com/api/users.identity'
                            : 'https://provider.com/userinfo'
                    }
                  />
                </FormField>
              </>
            )}
          </TabPanel>

          {/* Tab 2: Role Mappings */}
          {showGroupFields && (
            <TabPanel id="roles" style={{ height: '730px', overflowY: 'auto' }}>
              {selectedType === 'entra-id' && (
                <div
                  style={{
                    marginBottom: '1rem',
                    padding: '0.75rem',
                    background: '#fff7ed',
                    borderRadius: '4px',
                    border: '1px solid #fed7aa',
                  }}
                >
                  <Text style={{ fontSize: '0.8rem', color: '#9a3412' }}>
                    ⚠️ Entra ID uses <strong>Object IDs (GUIDs)</strong> for group names, not display
                    names. Example: <code>a1b2c3d4-e5f6-7890-abcd-ef1234567890</code>. Azure AD
                    Premium P1 is required for group claims with more than 6 groups.
                  </Text>
                </div>
              )}
              {selectedType === 'keycloak' && (
                <div
                  style={{
                    marginBottom: '1rem',
                    padding: '0.75rem',
                    background: '#f0fdf4',
                    borderRadius: '4px',
                    border: '1px solid #bbf7d0',
                  }}
                >
                  <Text style={{ fontSize: '0.8rem', color: '#166534' }}>
                    💡 If Keycloak sends groups with a leading <code>/</code> (e.g.{' '}
                    <code>/umami-admins</code>), set <strong>Full group path: OFF</strong> in the
                    client scope mapper, or enter the group name without the slash here.
                  </Text>
                </div>
              )}
              {selectedType === 'gitlab' && (
                <div
                  style={{
                    marginBottom: '1rem',
                    padding: '0.75rem',
                    background: '#f0fdf4',
                    borderRadius: '4px',
                    border: '1px solid #bbf7d0',
                  }}
                >
                  <Text style={{ fontSize: '0.8rem', color: '#166534' }}>
                    💡 GitLab uses <strong>group path notation</strong> (from the URL), not display
                    names. Example: <code>myorg/admins</code> not &quot;My Org Admins&quot;.
                    Case-sensitive.
                  </Text>
                </div>
              )}
              {selectedType === 'okta' && (
                <div
                  style={{
                    marginBottom: '1rem',
                    padding: '0.75rem',
                    background: '#fff7ed',
                    borderRadius: '4px',
                    border: '1px solid #fed7aa',
                  }}
                >
                  <Text style={{ fontSize: '0.8rem', color: '#9a3412' }}>
                    ⚠️ Role mapping requires a <strong>Custom Authorization Server</strong> (set in
                    Advanced tab). The org-level authorization server does not include the{' '}
                    <code>groups</code> claim.
                  </Text>
                </div>
              )}
              <FormField label={formatMessage(labels.adminGroup)} name="adminGroup">
                <TextField
                  placeholder={
                    selectedType === 'entra-id'
                      ? 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
                      : selectedType === 'gitlab'
                        ? 'myorg/umami-admins'
                        : 'umami-admins'
                  }
                />
                <Text style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.25rem' }}>
                  {formatMessage(messages.adminGroupHelp)}
                </Text>
              </FormField>
              <FormField label={formatMessage(labels.viewOnlyGroup)} name="viewOnlyGroup">
                <TextField
                  placeholder={
                    selectedType === 'entra-id'
                      ? 'b2c3d4e5-f6a7-8901-bcde-f12345678901'
                      : selectedType === 'gitlab'
                        ? 'myorg/umami-viewers'
                        : 'umami-viewers'
                  }
                />
                <Text style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.25rem' }}>
                  {formatMessage(messages.viewOnlyGroupHelp)}
                </Text>
              </FormField>
              <FormField label={formatMessage(labels.teamMappings)} name="teamMappings">
                <TextField
                  asTextArea
                  placeholder='{"engineering-group": "team-uuid", "marketing-group": "team-uuid"}'
                  style={{ minHeight: '100px', fontFamily: 'monospace', fontSize: '0.9rem' }}
                />
                <Text style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.25rem' }}>
                  {formatMessage(messages.teamMappingsHelp)}
                </Text>
              </FormField>

              {/* Show currently configured roles */}
              {(provider.adminGroup || provider.viewOnlyGroup) && (
                <div
                  style={{
                    marginTop: '1.5rem',
                    padding: '1rem',
                    background: '#f0fdf4',
                    borderRadius: '4px',
                    border: '1px solid #bbf7d0',
                  }}
                >
                  <Text
                    style={{
                      fontSize: '0.875rem',
                      fontWeight: 'bold',
                      marginBottom: '0.5rem',
                      color: '#166534',
                    }}
                  >
                    ✓ {formatMessage(labels.configuredRoles)}
                  </Text>
                  {provider.adminGroup && (
                    <Text style={{ fontSize: '0.875rem', marginTop: '0.25rem', color: '#166534' }}>
                      <strong>{formatMessage(labels.admin)}:</strong> {provider.adminGroup}
                    </Text>
                  )}
                  {provider.viewOnlyGroup && (
                    <Text style={{ fontSize: '0.875rem', marginTop: '0.25rem', color: '#166534' }}>
                      <strong>{formatMessage(labels.viewOnly)}:</strong> {provider.viewOnlyGroup}
                    </Text>
                  )}
                </div>
              )}
            </TabPanel>
          )}

          {/* Tab 3: Settings */}
          <TabPanel id="settings" style={{ height: '730px', overflowY: 'auto' }}>
            {/* Phase 1.2: Trusted flag */}
            <FormField label={formatMessage(labels.trusted)} name="trusted">
              <Checkbox>{formatMessage(messages.trustedProviderHelp)}</Checkbox>
            </FormField>

            <FormField label={formatMessage(labels.enabled)} name="enabled">
              <Checkbox>{formatMessage(labels.enabled)}</Checkbox>
            </FormField>

            <FormField label={formatMessage(labels.autoCreateUsers)} name="autoCreate">
              <Checkbox>{formatMessage(labels.autoCreateUsers)}</Checkbox>
            </FormField>

            {/* Phase 5.4: Sort order */}
            <FormField label={formatMessage(labels.sortOrder)} name="sortOrder">
              <TextField placeholder="0" type="number" />
            </FormField>

            {/* Set as primary login */}
            <FormField label={formatMessage(labels.isPrimary)} name="isPrimary">
              <Checkbox>
                <Text style={{ fontSize: '0.875rem' }}>
                  {formatMessage(messages.isPrimaryHelp)}
                </Text>
              </Checkbox>
            </FormField>
          </TabPanel>

          {/* Tab 4: Optional Endpoint Configuration (for OIDC auto-discovery override) */}
          {!showManualEndpoints && (
            <TabPanel id="optional" style={{ height: '730px', overflowY: 'auto' }}>
              <Text style={{ marginBottom: '1rem', color: '#666' }}>
                {formatMessage(labels.advancedEndpointOverrides)}
              </Text>
              <FormField label={formatMessage(labels.authorizationUrl)} name="authUrl">
                <TextField placeholder="(optional - auto-discovered)" />
              </FormField>
              <FormField label={formatMessage(labels.tokenUrl)} name="tokenUrl">
                <TextField placeholder="(optional - auto-discovered)" />
              </FormField>
              <FormField label={formatMessage(labels.userinfoUrl)} name="userinfoUrl">
                <TextField placeholder="(optional - auto-discovered)" />
              </FormField>
            </TabPanel>
          )}
          {/* Tab 5: Advanced (Provider-specific extra fields) */}
          {hasExtraFields && (
            <TabPanel id="advanced" style={{ height: '730px', overflowY: 'auto' }}>
              {providerSpec.extraFields.map(field => (
                <FormField
                  key={field.key}
                  label={field.label}
                  name={field.key}
                  rules={field.required ? { required: formatMessage(labels.required) } : undefined}
                >
                  <TextField
                    type={field.type === 'number' ? 'number' : 'text'}
                    placeholder={field.placeholder}
                  />
                  {field.helpText && (
                    <Text style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.25rem' }}>
                      {field.helpText}
                    </Text>
                  )}
                </FormField>
              ))}
            </TabPanel>
          )}
          {/* Tab 5: Test Configuration */}
          <TabPanel id="test" style={{ height: '730px', overflowY: 'auto' }}>
            <div style={{ padding: '1rem 0' }}>
              <Text style={{ fontWeight: 'bold', fontSize: '1rem', marginBottom: '1rem' }}>
                {formatMessage(labels.testConfiguration)}
              </Text>

              <div style={{ marginTop: '1rem' }}>
                <Text style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>
                  {formatMessage(labels.callbackUri)}
                </Text>
                <TextField value={callbackUri} isReadOnly />
                <Text style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.25rem' }}>
                  {formatMessage(messages.callbackUriHelp)}
                </Text>
              </div>

              <div style={{ marginTop: '1.5rem' }}>
                <Text style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>
                  {formatMessage(labels.providerId)}
                </Text>
                <TextField value={provider.id} isReadOnly />
              </div>

              <div style={{ marginTop: '1.5rem' }}>
                <Text style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>
                  {formatMessage(labels.discoveryEndpoint)}
                </Text>
                {showIssuerField && provider.issuer ? (
                  <>
                    <TextField
                      value={`${provider.issuer.replace(/\/$/, '')}/.well-known/openid-configuration`}
                      isReadOnly
                    />
                    <Text style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.25rem' }}>
                      {formatMessage(messages.discoveryEndpointHelp)}
                    </Text>
                  </>
                ) : (
                  <Text style={{ fontSize: '0.875rem', color: '#999' }}>
                    {formatMessage(messages.oauth2NoDiscovery)}
                  </Text>
                )}
              </div>

              <div style={{ marginTop: '1.5rem' }}>
                <Text style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>
                  {formatMessage(labels.testLoginUrl)}
                </Text>
                <TextField value={`${authUrl}/login?provider=${provider.id}`} isReadOnly />
                <Text style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.25rem' }}>
                  {formatMessage(messages.testLoginUrlHelp)}
                </Text>
              </div>

              <div
                style={{
                  marginTop: '1.5rem',
                  padding: '1rem',
                  background: '#f0f9ff',
                  borderRadius: '4px',
                  border: '1px solid #bfdbfe',
                }}
              >
                <Text
                  style={{
                    fontSize: '0.875rem',
                    fontWeight: 'bold',
                    marginBottom: '0.5rem',
                    color: '#333',
                  }}
                >
                  🔍 {formatMessage(labels.testingSteps)}
                </Text>
                <ol
                  style={{
                    margin: '0.5rem 0 0 1.25rem',
                    padding: 0,
                    fontSize: '0.875rem',
                    lineHeight: '1.6',
                    color: '#333',
                  }}
                >
                  <li>{formatMessage(messages.testStep1)}</li>
                  <li>{formatMessage(messages.testStep2)}</li>
                  <li>{formatMessage(messages.testStep3)}</li>
                  <li>{formatMessage(messages.testStep4)}</li>
                </ol>
              </div>

              {/* Test Buttons */}
              <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                {showIssuerField && provider.issuer && (
                  <Button
                    variant="primary"
                    onPress={() =>
                      window.open(
                        `${provider.issuer.replace(/\/$/, '')}/.well-known/openid-configuration`,
                        '_blank',
                      )
                    }
                  >
                    🔍 Test Discovery Endpoint
                  </Button>
                )}
                <Button
                  variant="primary"
                  onPress={() => window.open(`${authUrl}/login?provider=${provider.id}`, '_blank')}
                >
                  🚀 Test Login Flow
                </Button>
              </div>
            </div>
          </TabPanel>
        </Tabs>
      </div>

      <FormButtons>
        <Button isDisabled={isPending} onPress={onClose}>
          {formatMessage(labels.cancel)}
        </Button>
        <FormSubmitButton variant="primary" isDisabled={false}>
          {formatMessage(labels.save)}
        </FormSubmitButton>
      </FormButtons>
    </Form>
  );
}
