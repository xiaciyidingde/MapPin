import { useMapStore } from '../../store/useMapStore';
import './ThemeToggle.css';

export function ThemeToggle() {
  const theme = useMapStore((state) => state.theme);
  const setTheme = useMapStore((state) => state.setTheme);

  const handleToggle = (event: React.MouseEvent<HTMLButtonElement>) => {
    const newTheme = theme === 'light' ? 'dark' : 'light';

    // 检查浏览器是否支持 View Transition API
    if (!document.startViewTransition) {
      setTheme(newTheme);
      return;
    }

    // 获取点击位置（像素值）
    const x = event.clientX;
    const y = event.clientY;

    // 设置 CSS 变量用于动画圆心位置（百分比）
    const xPercent = (x / window.innerWidth) * 100;
    const yPercent = (y / window.innerHeight) * 100;
    document.documentElement.style.setProperty('--transition-x', `${xPercent}%`);
    document.documentElement.style.setProperty('--transition-y', `${yPercent}%`);

    // 使用 View Transition API
    const transition = document.startViewTransition(() => {
      setTheme(newTheme);
    });

    // 等待过渡完成后清理
    transition.finished.finally(() => {
      document.documentElement.style.removeProperty('--transition-x');
      document.documentElement.style.removeProperty('--transition-y');
    });
  };

  return (
    <button
      className="theme-toggle"
      onClick={handleToggle}
      aria-label="Toggle theme"
      title={theme === 'light' ? '切换到深色模式' : '切换到浅色模式'}
    >
      <svg
        className="theme-toggle-icon"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* 太阳图标 */}
        <g className={`sun-icon ${theme === 'light' ? 'active' : ''}`}>
          <circle cx="12" cy="12" r="5" fill="currentColor" />
          <g className="sun-rays">
            <line x1="12" y1="1" x2="12" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="12" y1="21" x2="12" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="1" y1="12" x2="3" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="21" y1="12" x2="23" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </g>
        </g>

        {/* 月亮图标 */}
        <g className={`moon-icon ${theme === 'dark' ? 'active' : ''}`}>
          <path
            d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
            fill="currentColor"
          />
        </g>
      </svg>
    </button>
  );
}
