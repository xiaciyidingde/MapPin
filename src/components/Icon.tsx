interface IconProps {
  name: string;
  size?: number;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Icon 组件 - 使用 SVG sprite 显示图标
 * 
 * @param name - 图标名称（对应 icons.svg 中的 symbol id）
 * @param size - 图标大小（像素）
 * @param color - 图标颜色
 * @param className - CSS 类名
 * @param style - 内联样式
 * 
 * @example
 * <Icon name="control-point" size={32} />
 * <Icon name="map-icon" color="#1890ff" />
 * <Icon name="settings-icon" className="text-blue-500" />
 */
export function Icon({ name, size = 24, color, className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      style={{ color, ...style }}
      className={className}
      aria-hidden="true"
    >
      <use href={`/icons.svg#${name}`} />
    </svg>
  );
}
