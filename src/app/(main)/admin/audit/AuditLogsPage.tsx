'use client';
import { useQuery } from '@tanstack/react-query';
import { Column, Grid, Row, Text } from '@umami/react-zen';
import { useState } from 'react';
import { PageHeader } from '@/components/common/PageHeader';
import { useApi, useMessages } from '@/components/hooks';
import styles from './AuditLogsPage.module.css';

const ACTION_COLORS: Record<string, string> = {
  login: '#10b981',
  logout: '#3b82f6',
  login_failed: '#ef4444',
  user_created: '#8b5cf6',
};

const ACTION_LABELS: Record<string, string> = {
  login: 'Login',
  logout: 'Logout',
  login_failed: 'Login Failed',
  user_created: 'User Created',
};

export default function AuditLogsPage() {
  const { formatMessage, labels } = useMessages();
  const { get } = useApi();
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page],
    queryFn: () => get('/audit-logs', { page, pageSize }),
  });

  const formatMetadata = (metadata: any) => {
    if (!metadata) return null;
    return (
      <details style={{ fontSize: '0.9em', color: '#666' }}>
        <summary style={{ cursor: 'pointer' }}>Details</summary>
        <pre
          style={{
            marginTop: '4px',
            padding: '8px',
            background: '#f5f5f5',
            borderRadius: '4px',
            fontSize: '0.85em',
          }}
        >
          {JSON.stringify(metadata, null, 2)}
        </pre>
      </details>
    );
  };

  return (
    <>
      <PageHeader title={formatMessage(labels.auditLog)}>
        <Text>
          Total: {data?.total || 0} events | Page {page} of {data?.pageCount || 1}
        </Text>
      </PageHeader>
      <Grid>
        <Column>
          {isLoading ? (
            <div style={{ padding: '20px', textAlign: 'center' }}>Loading...</div>
          ) : (
            <>
              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>{formatMessage(labels.date)}</th>
                      <th>{formatMessage(labels.user)}</th>
                      <th>{formatMessage(labels.action)}</th>
                      <th>Provider / Resource</th>
                      <th>IP Address</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.data?.length === 0 && (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '20px' }}>
                          No audit logs found
                        </td>
                      </tr>
                    )}
                    {data?.data?.map((row: any) => (
                      <tr key={row.id}>
                        <td>
                          <div style={{ whiteSpace: 'nowrap' }}>
                            {new Date(row.createdAt).toLocaleDateString()}
                          </div>
                          <div style={{ fontSize: '0.85em', color: '#666' }}>
                            {new Date(row.createdAt).toLocaleTimeString()}
                          </div>
                        </td>
                        <td>
                          <strong>{row.user?.username || 'System'}</strong>
                          {row.user?.email && (
                            <div style={{ fontSize: '0.85em', color: '#666' }}>
                              {row.user.email}
                            </div>
                          )}
                        </td>
                        <td>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '0.85em',
                              fontWeight: '500',
                              backgroundColor: ACTION_COLORS[row.action] || '#6b7280',
                              color: 'white',
                            }}
                          >
                            {ACTION_LABELS[row.action] || row.action}
                          </span>
                        </td>
                        <td>{row.resource || '—'}</td>
                        <td>
                          <code style={{ fontSize: '0.9em' }}>{row.ipAddress || '—'}</code>
                        </td>
                        <td>{formatMetadata(row.metadata)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {data?.pageCount > 1 && (
                <Row justifyContent="center" gap="md" style={{ marginTop: '20px' }}>
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    style={{
                      padding: '8px 16px',
                      cursor: page === 1 ? 'not-allowed' : 'pointer',
                      opacity: page === 1 ? 0.5 : 1,
                    }}
                  >
                    Previous
                  </button>
                  <Text>
                    Page {page} of {data.pageCount}
                  </Text>
                  padding: '8px 16px', cursor: page === data.pageCount ? 'not-allowed' : 'pointer',
                  opacity: page === data.pageCount ? 0.5 : 1,
                  <button
                    onClick={() => setPage(p => Math.min(data.pageCount, p + 1))}
                    disabled={page === data.pageCount}
                    style={{
                      padding: '8px 16px',
                      cursor: page === data.pageCount ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Next
                  </button>
                </Row>
              )}
            </>
          )}
        </Column>
      </Grid>
    </>
  );
}
