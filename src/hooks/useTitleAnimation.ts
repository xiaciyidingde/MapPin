import { useState, useEffect } from 'react';

/**
 * 标题动画 Hook
 * 在小屏幕上控制标题的显示和动画
 */
export function useTitleAnimation() {
  const [showTitle, setShowTitle] = useState(true);
  const [startAnimation, setStartAnimation] = useState(false);

  useEffect(() => {
    const checkWidth = () => {
      // 如果宽度小于 500px，启动动画
      if (window.innerWidth < 500) {
        // 1秒后开始动画
        const timer = setTimeout(() => {
          setStartAnimation(true);
          // 动画持续 1 秒后隐藏标题
          setTimeout(() => {
            setShowTitle(false);
          }, 1000);
        }, 1000);
        return () => clearTimeout(timer);
      } else {
        setShowTitle(true);
        setStartAnimation(false);
      }
    };

    checkWidth();
    window.addEventListener('resize', checkWidth);
    return () => window.removeEventListener('resize', checkWidth);
  }, []);

  return {
    showTitle,
    startAnimation,
  };
}
