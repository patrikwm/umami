import { SideMenu } from '@/components/common/SideMenu';
import { useMessages, useNavigation } from '@/components/hooks';
import { Globe, KeyRound, ScrollText, User, Users } from '@/components/icons';

export function AdminNav({ onItemClick }: { onItemClick?: () => void }) {
  const { formatMessage, labels } = useMessages();
  const { pathname } = useNavigation();

  const items = [
    {
      label: formatMessage(labels.manage),
      items: [
        {
          id: 'users',
          label: formatMessage(labels.users),
          path: '/admin/users',
          icon: <User />,
        },
        {
          id: 'websites',
          label: formatMessage(labels.websites),
          path: '/admin/websites',
          icon: <Globe />,
        },
        {
          id: 'teams',
          label: formatMessage(labels.teams),
          path: '/admin/teams',
          icon: <Users />,
        },
        {
          id: 'providers',
          label: formatMessage(labels.providers),
          path: '/admin/providers',
          icon: <KeyRound />,
        },
        {
          id: 'audit',
          label: formatMessage(labels.auditLog),
          path: '/admin/audit',
          icon: <ScrollText />,
        },
      ],
    },
  ];

  const selectedKey = items
    .flatMap(e => e.items)
    ?.find(({ path }) => path && pathname.startsWith(path))?.id;

  return (
    <SideMenu
      items={items}
      title={formatMessage(labels.admin)}
      selectedKey={selectedKey}
      allowMinimize={false}
      onItemClick={onItemClick}
    />
  );
}
