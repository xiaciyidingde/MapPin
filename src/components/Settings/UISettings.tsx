import { Card, Flex, theme } from 'antd';
import { BulbOutlined } from '@ant-design/icons';
import { ThemeToggle } from '../common/ThemeToggle';

export function UISettings() {
  const { token } = theme.useToken();
  
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '16px' }}>
      <Flex vertical gap={16} style={{ width: '100%', maxWidth: 600 }}>
        {/* 主题设置卡片 */}
        <Card size="small">
          <Flex justify="space-between" align="center">
            <Flex vertical gap={8}>
              <Flex align="center" gap={8}>
                <BulbOutlined style={{ fontSize: 18, color: '#faad14' }} />
                <span className="font-semibold">主题模式</span>
              </Flex>
              <div style={{ fontSize: 14, color: token.colorTextSecondary }}>
                切换应用的明暗主题
              </div>
            </Flex>
            <ThemeToggle />
          </Flex>
        </Card>
      </Flex>
    </div>
  );
}
