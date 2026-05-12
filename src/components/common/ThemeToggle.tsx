import { useMapStore } from '../../store/useMapStore';
import './ThemeToggle.css';

export function ThemeToggle() {
  const theme = useMapStore((state) => state.theme);
  const setTheme = useMapStore((state) => state.setTheme);
  const themeAnimation = useMapStore((state) => state.themeAnimation);

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
    
    // 设置动画类型
    document.documentElement.setAttribute('data-theme-animation', themeAnimation);

    // 动态设置动画样式
    if (themeAnimation === 'triple') {
      // 创建临时样式表覆盖默认动画
      const style = document.createElement('style');
      style.id = 'triple-animation-override';
      style.textContent = `
        ::view-transition-group(root) {
          animation-duration: 1s !important;
        }
        ::view-transition-old(root) {
          animation: theme-triple-blur-out 1s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }
        ::view-transition-new(root) {
          animation: theme-triple-expand 1s cubic-bezier(0.4, 0, 0.2, 1) forwards !important;
        }
        
        @keyframes theme-triple-expand {
          0% {
            clip-path: circle(0% at var(--transition-x, 50%) var(--transition-y, 50%));
            filter: blur(1px);
          }
          40% {
            clip-path: circle(20% at var(--transition-x, 50%) var(--transition-y, 50%));
            filter: blur(1px);
          }
          60% {
            clip-path: circle(4% at var(--transition-x, 50%) var(--transition-y, 50%));
            filter: blur(1px);
          }
          100% {
            clip-path: circle(150% at var(--transition-x, 50%) var(--transition-y, 50%));
            filter: blur(0px);
          }
        }
        
        @keyframes theme-triple-blur-out {
          0% {
            opacity: 1;
            filter: blur(0px);
          }
          40% {
            opacity: 0.8;
            filter: blur(1px);
          }
          60% {
            opacity: 0.6;
            filter: blur(2px);
          }
          100% {
            opacity: 0.3;
            filter: blur(3px);
          }
        }
      `;
      document.head.appendChild(style);
    }

    // 使用 View Transition API
    const transition = document.startViewTransition(() => {
      setTheme(newTheme);
    });

    // 等待过渡完成后清理
    transition.finished.finally(() => {
      document.documentElement.style.removeProperty('--transition-x');
      document.documentElement.style.removeProperty('--transition-y');
      document.documentElement.removeAttribute('data-theme-animation');
      
      // 清理临时样式
      const tempStyle = document.getElementById('triple-animation-override');
      if (tempStyle) {
        tempStyle.remove();
      }
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
