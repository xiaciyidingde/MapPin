import { useState } from 'react';
import { Tabs } from 'antd';
import { PointSettings } from '../Settings/PointSettings';
import { DataSettings } from '../Settings/DataSettings';
import { AnomalyDetection } from './AnomalyDetection';

interface ToolsDrawerProps {
  open: boolean;
  onClose: () => void;
  defaultTab?: string;
}

export function ToolsDrawer({ onClose, defaultTab = 'points' }: ToolsDrawerProps) {
  const [activeTab, setActiveTab] = useState(defaultTab);

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
    {
      key: 'data',
      label: '数据管理',
      children: <DataSettings />,
    },
  ];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={items}
        style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%', maxWidth: 600 }}
        tabBarStyle={{ 
          paddingLeft: 16, 
          paddingRight: 16, 
          background: '#fff', 
          flexShrink: 0
        }}
        styles={{
          content: { flex: 1, overflow: 'auto' }
        }}
      />
    </div>
  );
}
