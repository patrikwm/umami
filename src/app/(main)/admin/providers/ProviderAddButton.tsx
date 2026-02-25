'use client';
import {
  Button,
  Dialog,
  Icon,
  Menu,
  MenuItem,
  MenuTrigger,
  Modal,
  Popover,
  Row,
  Text,
  useToast,
} from '@umami/react-zen';
import { useState } from 'react';
import { useMessages, useModified } from '@/components/hooks';
import { ChevronDown, Plus } from '@/components/icons';
import { ProviderAddForm } from './ProviderAddForm';

export function ProviderAddButton() {
  const { formatMessage, labels, messages } = useMessages();
  const { toast } = useToast();
  const { touch } = useModified();
  const [selectedCategory, setSelectedCategory] = useState<'oidc' | 'oauth2' | null>(null);

  const handleSave = () => {
    toast(formatMessage(messages.saved));
    touch('oidc-providers');
    setSelectedCategory(null);
  };

  const handleClose = () => {
    setSelectedCategory(null);
  };

  return (
    <>
      <MenuTrigger>
        <Button variant="primary">
          <Icon>
            <Plus />
          </Icon>
          <Text>{formatMessage(labels.addProvider)}</Text>
          <Icon>
            <ChevronDown />
          </Icon>
        </Button>
        <Popover>
          <Menu onAction={key => setSelectedCategory(key as 'oidc' | 'oauth2')}>
            <MenuItem id="oidc">
              <Text>{formatMessage(labels.addOidcProvider)}</Text>
            </MenuItem>
            <MenuItem id="oauth2">
              <Text>{formatMessage(labels.addOauth2Provider)}</Text>
            </MenuItem>
          </Menu>
        </Popover>
      </MenuTrigger>

      <Modal isOpen={!!selectedCategory}>
        <Dialog
          title={formatMessage(
            selectedCategory === 'oidc' ? labels.addOidcProvider : labels.addOauth2Provider,
          )}
          style={{ width: 700, maxWidth: '90vw' }}
        >
          {() =>
            selectedCategory && (
              <ProviderAddForm
                providerCategory={selectedCategory}
                onSave={handleSave}
                onClose={handleClose}
              />
            )
          }
        </Dialog>
      </Modal>
    </>
  );
}
