import { useState } from 'react';
import { Button } from 'antd';
import { isDevelopment } from '../utils/env';

// 仅用于开发环境测试错误边界
export function ErrorTrigger() {
  const [shouldThrow, setShouldThrow] = useState(false);

  // 生产环境不渲染
  if (!isDevelopment) return null;

  if (shouldThrow) {
    throw new Error('这是一个测试错误，用于演示错误边界功能');
  }

  return (
    <div style={{ position: 'fixed', bottom: 80, left: 16, zIndex: 9999 }}>
      <Button 
        danger 
        onClick={() => setShouldThrow(true)}
        size="small"
      >
        触发测试错误
      </Button>
    </div>
  );
}
