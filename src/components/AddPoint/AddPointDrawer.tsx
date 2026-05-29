import { useState } from 'react';
import { Tabs, theme } from 'antd';
import { AddPointForm } from './AddPointForm';

interface AddPointDrawerProps {
  open: boolean;
  onClose: () => void;
  defaultTab?: string;
}

export function AddPointDrawer({ onClose, defaultTab = 'add' }: AddPointDrawerProps) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const { token } = theme.useToken();

  const items = [
    {
      key: 'add',
      label: '添加点',
      children: <AddPointForm onClose={onClose} />,
    },
  ];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={items}
        style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%' }}
        tabBarStyle={{ 
          paddingLeft: 16, 
          paddingRight: 16, 
          background: token.colorBgContainer, 
          flexShrink: 0
        }}
        styles={{
          content: { flex: 1, overflow: 'auto' }
        }}
      />
    </div>
  );
}
