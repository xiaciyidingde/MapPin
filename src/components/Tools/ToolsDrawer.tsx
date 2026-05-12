import { useState } from 'react';
import { Tabs, theme } from 'antd';
import { PointSettings } from '../Settings/PointSettings';
import { AnomalyDetection } from './AnomalyDetection';

interface ToolsDrawerProps {
  open: boolean;
  onClose: () => void;
  defaultTab?: string;
}

export function ToolsDrawer({ onClose, defaultTab = 'points' }: ToolsDrawerProps) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const { token } = theme.useToken();

  const items = [
    {
      key: 'points',
      label: '点位设置',
      children: <PointSettings />,
    },
    {
      key: 'anomaly',
      label: '异常检测',
      children: <AnomalyDetection isActive={activeTab === 'anomaly'} onLocate={onClose} />,
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
