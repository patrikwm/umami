'use client';
import { AlertDialog, Row } from '@umami/react-zen';
import { useDeleteQuery, useMessages, useModified } from '@/components/hooks';

export function ProviderDeleteForm({
  providerId,
  providerName,
  onClose,
}: {
  providerId: string;
  providerName: string;
  onClose?: () => void;
}) {
  const { messages, labels, formatMessage } = useMessages();
  const { mutateAsync } = useDeleteQuery(`/oidc-providers/${providerId}`);
  const { touch } = useModified();

  const handleConfirm = async () => {
    await mutateAsync(null, {
      onSuccess: async () => {
        touch('oidc-providers');
        onClose?.();
      },
    });
  };

  return (
    <AlertDialog
      title={formatMessage(labels.deleteProvider)}
      onConfirm={handleConfirm}
      onCancel={onClose}
      confirmLabel={formatMessage(labels.delete)}
      isDanger
    >
      <Row gap="1">{formatMessage(messages.confirmDelete, { target: providerName })}</Row>
    </AlertDialog>
  );
}
