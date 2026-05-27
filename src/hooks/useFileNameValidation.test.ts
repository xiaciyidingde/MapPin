import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useFileNameValidation } from './useFileNameValidation';
import * as sanitize from '../utils/sanitize';

// Mock App.useApp
const mockMessage = {
  error: vi.fn(),
  warning: vi.fn(),
};

vi.mock('antd', () => ({
  App: {
    useApp: () => ({ message: mockMessage }),
  },
}));

describe('useFileNameValidation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateFileName', () => {
    it('应该验证有效的文件名', () => {
      vi.spyOn(sanitize, 'isValidFileName').mockReturnValue(true);

      const { result } = renderHook(() => useFileNameValidation());
      const validated = result.current.validateFileName('测试文件');

      expect(validated).toBe('测试文件');
      expect(mockMessage.error).not.toHaveBeenCalled();
      expect(mockMessage.warning).not.toHaveBeenCalled();
    });

    it('应该拒绝空文件名', () => {
      const { result } = renderHook(() => useFileNameValidation());
      const validated = result.current.validateFileName('');

      expect(validated).toBeNull();
      expect(mockMessage.error).toHaveBeenCalledWith('文件名不能为空');
    });

    it('应该拒绝只有空格的文件名', () => {
      const { result } = renderHook(() => useFileNameValidation());
      const validated = result.current.validateFileName('   ');

      expect(validated).toBeNull();
      expect(mockMessage.error).toHaveBeenCalledWith('文件名不能为空');
    });

    it('应该修剪文件名两端的空格', () => {
      vi.spyOn(sanitize, 'isValidFileName').mockReturnValue(true);

      const { result } = renderHook(() => useFileNameValidation());
      const validated = result.current.validateFileName('  测试文件  ');

      expect(validated).toBe('测试文件');
    });

    it('应该清理包含非法字符的文件名', () => {
      vi.spyOn(sanitize, 'isValidFileName').mockReturnValue(false);
      vi.spyOn(sanitize, 'sanitizeFileName').mockReturnValue('测试文件_清理后');

      const { result } = renderHook(() => useFileNameValidation());
      const validated = result.current.validateFileName('测试文件<>');

      expect(validated).toBe('测试文件_清理后');
      expect(mockMessage.warning).toHaveBeenCalledWith(
        '文件名包含非法字符，已自动清理为：测试文件_清理后'
      );
    });

    it('应该处理包含特殊字符的文件名', () => {
      vi.spyOn(sanitize, 'isValidFileName').mockReturnValue(false);
      vi.spyOn(sanitize, 'sanitizeFileName').mockReturnValue('文件名123');

      const { result } = renderHook(() => useFileNameValidation());
      const validated = result.current.validateFileName('文件名/\\:*?"<>|123');

      expect(validated).toBe('文件名123');
      expect(sanitize.sanitizeFileName).toHaveBeenCalledWith('文件名/\\:*?"<>|123');
    });

    it('应该处理清理后仍然有效的文件名', () => {
      vi.spyOn(sanitize, 'isValidFileName').mockReturnValue(false);
      vi.spyOn(sanitize, 'sanitizeFileName').mockReturnValue('valid_name');

      const { result } = renderHook(() => useFileNameValidation());
      const validated = result.current.validateFileName('invalid<name>');

      expect(validated).toBe('valid_name');
      expect(mockMessage.warning).toHaveBeenCalled();
    });
  });
});
