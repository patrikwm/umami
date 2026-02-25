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
import { useState } from 'react';
import { useMessages, useUpdateQuery } from '@/components/hooks';
import {
  detectProviderType,
  getDefaultScope,
  getProviderSpec,
  type ProviderType,
} from '@/lib/oidc-providers';

export function ProviderAddForm({
  providerCategory,
  onSave,
  onClose,
}: {
  providerCategory: 'oidc' | 'oauth2';
  onSave?: () => void;
  onClose?: () => void;
}) {
  const { mutateAsync, error, isPending } = useUpdateQuery('/oidc-providers');
  const { formatMessage, labels, messages, getErrorMessage } = useMessages();
  const [selectedType, setSelectedType] = useState<ProviderType | null>(null);

  // Auto-detect provider type from issuer URL
  const handleIssuerChange = (value: string) => {
    if (value) {
      const detected = detectProviderType(value);
      setSelectedType(detected);
    }
  };

  // Get provider spec for selected type
  const providerSpec = selectedType ? getProviderSpec(selectedType) : null;
  const category = providerSpec?.category || providerCategory;

  const handleSubmit = async (data: any) => {
    // Build extraConfig from provider-specific fields
    const extraConfig: Record<string, any> = {};

    if (providerSpec?.extraFields) {
      providerSpec.extraFields.forEach(field => {
        if (data[field.key]) {
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

    // Build payload
    const payload: any = {
      ...data,
      type: selectedType || 'generic',
      category,
      teamMappings: parsedTeamMappings,
      extraConfig: Object.keys(extraConfig).length > 0 ? extraConfig : null,
      enabled: data.enabled !== false,
      autoCreate: data.autoCreate !== false,
      trusted: data.trusted !== false,
      isPrimary: data.isPrimary === true,
      sortOrder: data.sortOrder === '' || data.sortOrder === null ? null : Number(data.sortOrder),
    };

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
        onSave?.();
        onClose?.();
      },
    });
  };

  // Phase 1.4: Compute callback URI
  const authUrl =
    typeof window !== 'undefined' ? window.location.origin : process.env.AUTH_URL || '';
  const callbackUri = `${authUrl}/api/auth/callback/[provider-id]`;

  const showIssuerField = category === 'oidc' || category === 'oidc-quirks';
  const showManualEndpoints = category === 'oauth2';
  const showGroupFields = providerSpec?.supportsGroups !== false;
  const hasExtraFields = providerSpec?.extraFields && providerSpec.extraFields.length > 0;

  return (
    <Form
      onSubmit={handleSubmit}
      error={getErrorMessage(error)}
      defaultValues={{ type: selectedType || 'oidc' }}
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
              <Text style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.25rem' }}>
                {formatMessage(messages.callbackUriPlaceholder)}
              </Text>
            </div>

            <FormField
              label={formatMessage(labels.name)}
              name="name"
              rules={{ required: formatMessage(labels.required) }}
            >
              <TextField placeholder="Authentik, Keycloak, Google..." />
            </FormField>

            {/* Provider Type Selector */}
            <FormField
              label={formatMessage(labels.providerType)}
              name="providerType"
              style={{ marginBottom: selectedType ? '0.5rem' : '1rem' }}
            >
              <Select
                selectedKey={selectedType || undefined}
                onSelectionChange={key => {
                  setSelectedType(key as ProviderType);
                }}
              >
                {providerCategory === 'oidc' ? (
                  <>
                    <ListItem id="authentik">Authentik</ListItem>
                    <ListItem id="keycloak">Keycloak</ListItem>
                    <ListItem id="okta">Okta</ListItem>
                    <ListItem id="entra-id">Microsoft Entra ID (Azure AD)</ListItem>
                    <ListItem id="gitlab">GitLab</ListItem>
                    <ListItem id="google">Google</ListItem>
                    <ListItem id="generic">Generic OIDC</ListItem>
                  </>
                ) : (
                  <>
                    <ListItem id="github">GitHub</ListItem>
                    <ListItem id="discord">Discord</ListItem>
                    <ListItem id="slack">Slack</ListItem>
                  </>
                )}
              </Select>
            </FormField>

            {selectedType && (
              <div
                style={{
                  marginBottom: '1rem',
                  padding: '0.75rem',
                  background: '#f5f5f5',
                  borderRadius: '4px',
                }}
              >
                <Text style={{ fontSize: '0.875rem', color: '#333' }}>
                  <strong>{providerSpec?.displayName}:</strong>{' '}
                  {category === 'oidc' && formatMessage(messages.issuerAutoDiscovery)}
                  {category === 'oauth2' && formatMessage(messages.oauth2ManualEndpoints)}
                  {!showGroupFields && ` ${formatMessage(messages.oauth2NoGroups)}`}
                </Text>
              </div>
            )}

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
              label={formatMessage(labels.clientSecret)}
              name="clientSecret"
              rules={{ required: formatMessage(labels.required) }}
            >
              <TextField type="password" />
            </FormField>

            {/* Phase 1.3: Scope field */}
            <FormField label={formatMessage(labels.scope)} name="scope">
              <TextField
                placeholder={selectedType ? getDefaultScope(selectedType) : 'openid profile email'}
                defaultValue={selectedType ? getDefaultScope(selectedType) : undefined}
              />
            </FormField>

            {/* Manual endpoint URLs - only for OAuth 2.0 providers */}
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
            </TabPanel>
          )}

          {/* Tab 3: Settings */}
          <TabPanel id="settings" style={{ height: '730px', overflowY: 'auto' }}>
            {/* Phase 1.2: Trusted flag */}
            <FormField label={formatMessage(labels.trusted)} name="trusted">
              <Checkbox defaultSelected={providerSpec?.trustedDefault || false}>
                {formatMessage(messages.trustedProviderHelp)}
              </Checkbox>
            </FormField>

            <FormField label={formatMessage(labels.enabled)} name="enabled">
              <Checkbox defaultSelected={true}>{formatMessage(labels.enabled)}</Checkbox>
            </FormField>

            <FormField label={formatMessage(labels.autoCreateUsers)} name="autoCreate">
              <Checkbox defaultSelected={true}>{formatMessage(labels.autoCreateUsers)}</Checkbox>
            </FormField>

            {/* Phase 5.4: Sort order */}
            <FormField label={formatMessage(labels.sortOrder)} name="sortOrder">
              <TextField placeholder="0" type="number" />
            </FormField>

            {/* Set as primary login */}
            <FormField label={formatMessage(labels.isPrimary)} name="isPrimary">
              <Checkbox defaultSelected={false}>
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
              <Text style={{ marginBottom: '1rem', color: '#666' }}>
                {formatMessage(messages.testConfigHelp)}
              </Text>

              <div style={{ marginTop: '1.5rem' }}>
                <Text style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>
                  {formatMessage(labels.callbackUri)}
                </Text>
                <Text style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>
                  Configure this URL in your identity provider's allowed redirect URIs:
                </Text>
                <TextField value={callbackUri} isReadOnly />
                <Text style={{ fontSize: '0.8rem', color: '#999', marginTop: '0.25rem' }}>
                  Note: The actual callback URI will use the provider ID instead of [provider-id]
                  once created.
                </Text>
              </div>

              {selectedType && (
                <div style={{ marginTop: '1.5rem' }}>
                  <Text style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>
                    {formatMessage(labels.requiredScopes)}
                  </Text>
                  <TextField
                    value={selectedType ? getDefaultScope(selectedType) : 'openid profile email'}
                    isReadOnly
                  />
                  <Text style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.25rem' }}>
                    {formatMessage(messages.requiredScopesHelp)}
                  </Text>
                </div>
              )}

              <div
                style={{
                  marginTop: '1.5rem',
                  padding: '1rem',
                  background: '#1e293b',
                  borderRadius: '4px',
                  border: '1px solid #334155',
                }}
              >
                <Text
                  style={{
                    fontSize: '0.875rem',
                    fontWeight: 'bold',
                    marginBottom: '0.5rem',
                    color: '#f1f5f9',
                  }}
                >
                  💡 {formatMessage(labels.testingTip)}
                </Text>
                <Text style={{ fontSize: '0.875rem', color: '#cbd5e1' }}>
                  {formatMessage(messages.testProviderAfterSave)}
                </Text>
              </div>
            </div>
          </TabPanel>
        </Tabs>
      </div>

      <FormButtons>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            width: '100%',
            alignItems: 'center',
          }}
        >
          <Button isDisabled={isPending} onPress={onClose}>
            {formatMessage(labels.cancel)}
          </Button>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: '0.25rem',
            }}
          >
            {!selectedType && (
              <Text style={{ fontSize: '0.75rem', color: '#d97706', fontWeight: 500 }}>
                {formatMessage(messages.selectProviderTypeFirst)}
              </Text>
            )}
            <FormSubmitButton variant="primary" isDisabled={!selectedType || isPending}>
              {formatMessage(labels.save)}
            </FormSubmitButton>
          </div>
        </div>
      </FormButtons>
    </Form>
  );
}
