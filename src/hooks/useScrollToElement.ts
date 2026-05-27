import { useRef, useEffect, useCallback, useMemo } from 'react';

interface UseScrollToElementOptions {
  targetKeys?: string[];       // 目标元素的 key 数组
  enabled?: boolean;           // 是否启用自动滚动
  delay?: number;              // 延迟时间（默认500ms）
  behavior?: ScrollBehavior;   // 滚动行为（默认smooth）
  block?: ScrollLogicalPosition; // 对齐方式（默认center）
}

/**
 * 自动滚动到指定元素的 Hook
 * 
 * @example
 * ```tsx
 * const { containerRef, getTargetRef } = useScrollToElement({
 *   targetKeys: currentFileId ? [currentFileId] : [],
 *   enabled: open,
 *   delay: 500,
 *   block: 'center',
 * });
 * 
 * <div ref={containerRef}>
 *   {files.map(file => (
 *     <div ref={getTargetRef(file.id)}>
 *       {file.name}
 *     </div>
 *   ))}
 * </div>
 * ```
 */
export function useScrollToElement(options: UseScrollToElementOptions = {}) {
  const {
    targetKeys = [],
    enabled = true,
    delay = 500,
    behavior = 'smooth',
    block = 'center',
  } = options;

  const containerRef = useRef<HTMLDivElement>(null);
  const targetRefsMap = useRef<Map<string, React.RefObject<HTMLDivElement>>>(new Map());
  const hasScrolledRef = useRef(false);

  // 获取或创建目标元素的 ref
  const getTargetRef = useCallback((key: string): React.RefObject<HTMLDivElement> | null => {
    if (!targetKeys.includes(key)) {
      return null;
    }

    if (!targetRefsMap.current.has(key)) {
      targetRefsMap.current.set(key, { current: null as HTMLDivElement | null } as React.RefObject<HTMLDivElement>);
    }

    return targetRefsMap.current.get(key) || null;
  }, [targetKeys]);

  // 手动触发滚动
  const scrollToTarget = useCallback(() => {
    if (!containerRef.current) return;

    // 找到第一个已渲染的目标元素
    for (const key of targetKeys) {
      const targetRef = targetRefsMap.current.get(key);
      if (targetRef?.current) {
        // 使用 scrollIntoView 滚动到元素
        targetRef.current.scrollIntoView({
          behavior,
          block,
          inline: 'nearest',
        });
        return;
      }
    }
  }, [targetKeys, behavior, block]);

  // 自动滚动效果
  useEffect(() => {
    if (!enabled || targetKeys.length === 0) {
      hasScrolledRef.current = false;
      return;
    }

    if (hasScrolledRef.current) {
      return;
    }

    // 使用 requestAnimationFrame 等待浏览器渲染完成
    const rafId = requestAnimationFrame(() => {
      // 延迟执行，确保 DOM 已渲染和模态框动画完成
      const timer = setTimeout(() => {
        if (!hasScrolledRef.current) {
          scrollToTarget();
          hasScrolledRef.current = true;
        }
      }, delay);

      return () => clearTimeout(timer);
    });

    return () => cancelAnimationFrame(rafId);
  }, [enabled, targetKeys, delay, scrollToTarget]);

  // 当 enabled 变为 false 时重置滚动标记
  useEffect(() => {
    if (!enabled) {
      hasScrolledRef.current = false;
    }
  }, [enabled]);

  return useMemo(() => ({
    containerRef,
    getTargetRef,
    scrollToTarget,
  }), [getTargetRef, scrollToTarget]);
}
