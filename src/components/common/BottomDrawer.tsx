import { Drawer } from 'antd';
import type { ReactNode, CSSProperties } from 'react';

interface BottomDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /**
   * 是否覆盖标题栏（默认不覆盖，从标题栏下方开始）
   */
  coverHeader?: boolean;
  /**
   * 抽屉尺寸（default | large 或具体数值）
   */
  size?: 'default' | 'large' | number | string;
  /**
   * 自定义样式
   */
  styles?: {
    body?: CSSProperties;
    wrapper?: CSSProperties;
  };
  className?: string;
  destroyOnClose?: boolean;
}

/**
 * 底部抽屉组件
 * 统一管理从底部滑上来的抽屉样式和行为
 */
export function BottomDrawer({
  open,
  onClose,
  title,
  children,
  coverHeader = false,
  size,
  styles: customStyles,
  className,
  destroyOnClose = false,
}: BottomDrawerProps) {
  // 默认样式：不覆盖标题栏
  const defaultWrapperStyle: CSSProperties = coverHeader
    ? {} // 覆盖标题栏时不设置 top
    : {
        top: 64,
        height: 'calc(100dvh - 64px)',
        maxHeight: 'calc(100dvh - 64px)',
      };

  const defaultBodyStyle: CSSProperties = {
    padding: 0,
    ...customStyles?.body,
  };

  return (
    <Drawer
      open={open}
      title={title}
      placement="bottom"
      onClose={onClose}
      size={size}
      className={className}
      destroyOnClose={destroyOnClose}
      styles={{
        body: defaultBodyStyle,
        wrapper: {
          ...defaultWrapperStyle,
          ...customStyles?.wrapper,
        },
      }}
    >
      {children}
    </Drawer>
  );
}
