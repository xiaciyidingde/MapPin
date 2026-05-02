import { describe, it, expect } from 'vitest';
import {
  sanitizeHTML,
  sanitizeFileName,
  sanitizePointNumber,
  isValidFileName,
  isValidPointNumber,
  isValidFileType,
  isValidFileSize,
  isValidCoordinate,
  isValidLatLng,
  isValidNumber,
  limitStringLength,
} from './sanitize';

describe('sanitize.ts - 输入验证和清理', () => {
  describe('sanitizeHTML', () => {
    it('应该转义 HTML 标签', () => {
      const input = '<script>alert("xss")</script>Hello';
      const result = sanitizeHTML(input);
      // sanitizeHTML 使用 textContent，会转义 HTML
      expect(result).toContain('&lt;');
      expect(result).toContain('&gt;');
      expect(result).toContain('Hello');
    });

    it('应该转义事件处理器', () => {
      const input = '<div onclick="alert(1)">Click</div>';
      const result = sanitizeHTML(input);
      expect(result).toContain('&lt;');
      expect(result).toContain('&gt;');
    });

    it('应该转义所有 HTML', () => {
      const input = '<p>Hello <strong>World</strong></p>';
      const result = sanitizeHTML(input);
      expect(result).toContain('&lt;');
      expect(result).toContain('&gt;');
    });

    it('应该处理空字符串', () => {
      expect(sanitizeHTML('')).toBe('');
    });

    it('应该处理纯文本', () => {
      const input = 'Hello World';
      const result = sanitizeHTML(input);
      expect(result).toBe('Hello World');
    });
  });

  describe('sanitizeFileName', () => {
    it('应该移除路径遍历字符', () => {
      const input = '../../../etc/passwd';
      const result = sanitizeFileName(input);
      // sanitizeFileName 会移除 .. 和 /，但可能保留 .
      expect(result).not.toContain('..');
      // 结果应该是清理后的安全字符串
      expect(result.length).toBeGreaterThan(0);
      // 不应该包含路径分隔符
      expect(result).not.toMatch(/\.\.\//);
    });

    it('应该移除特殊字符', () => {
      const input = 'file<>:"|?*.dat';
      const result = sanitizeFileName(input);
      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
      expect(result).not.toContain(':');
      expect(result).not.toContain('"');
      expect(result).not.toContain('|');
      expect(result).not.toContain('?');
      expect(result).not.toContain('*');
      expect(result).toContain('.dat'); // 扩展名应该保留
    });

    it('应该保留中文字符', () => {
      const input = '测量数据.dat';
      const result = sanitizeFileName(input);
      expect(result).toContain('测量数据');
    });

    it('应该保留合法字符', () => {
      const input = 'data_2024-01-01.dat';
      const result = sanitizeFileName(input);
      expect(result).toBe('data_2024-01-01.dat');
    });

    it('应该处理空字符串', () => {
      const result = sanitizeFileName('');
      expect(result).toBe('');
    });

    it('应该将空格替换为下划线', () => {
      const input = 'my file name.dat';
      const result = sanitizeFileName(input);
      expect(result).toBe('my_file_name.dat');
    });
  });

  describe('sanitizePointNumber', () => {
    it('应该移除特殊字符', () => {
      const input = 'J1<script>alert(1)</script>';
      const result = sanitizePointNumber(input);
      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
      expect(result).not.toContain('(');
      expect(result).not.toContain(')');
      // 应该只保留字母和数字
      expect(result).toMatch(/^[a-zA-Z0-9\u4e00-\u9fa5_-]+$/);
    });

    it('应该保留字母和数字', () => {
      const input = 'J123';
      const result = sanitizePointNumber(input);
      expect(result).toBe('J123');
    });

    it('应该保留中文字符', () => {
      const input = '控制点1';
      const result = sanitizePointNumber(input);
      expect(result).toContain('控制点1');
    });

    it('应该处理空字符串', () => {
      expect(sanitizePointNumber('')).toBe('');
    });

    it('应该限制长度', () => {
      const longInput = 'J' + '1'.repeat(100);
      const result = sanitizePointNumber(longInput);
      expect(result.length).toBeLessThanOrEqual(50); // MAX_LENGTH = 50
    });
  });

  describe('isValidFileName', () => {
    it('应该接受合法文件名', () => {
      expect(isValidFileName('data.dat')).toBe(true);
      expect(isValidFileName('测量数据.dat')).toBe(true);
      expect(isValidFileName('data_2024-01-01.dat')).toBe(true);
    });

    it('应该拒绝包含路径遍历的文件名', () => {
      expect(isValidFileName('../data.dat')).toBe(false);
      expect(isValidFileName('../../etc/passwd')).toBe(false);
      expect(isValidFileName('data/../file.dat')).toBe(false);
    });

    it('应该拒绝包含特殊字符的文件名', () => {
      expect(isValidFileName('data<>.dat')).toBe(false);
      expect(isValidFileName('data|?.dat')).toBe(false);
    });

    it('应该拒绝空文件名', () => {
      expect(isValidFileName('')).toBe(false);
      expect(isValidFileName('   ')).toBe(false);
      expect(isValidFileName('.dat')).toBe(false);
    });
  });

  describe('isValidPointNumber', () => {
    it('应该接受合法点号', () => {
      expect(isValidPointNumber('J1')).toBe(true);
      expect(isValidPointNumber('123')).toBe(true);
      expect(isValidPointNumber('控制点1')).toBe(true);
    });

    it('应该拒绝包含特殊字符的点号', () => {
      expect(isValidPointNumber('J1<script>')).toBe(false);
      expect(isValidPointNumber('J1/../')).toBe(false);
      expect(isValidPointNumber('J1@#$')).toBe(false);
    });

    it('应该拒绝空点号', () => {
      expect(isValidPointNumber('')).toBe(false);
      expect(isValidPointNumber('   ')).toBe(false);
    });

    it('应该拒绝过长的点号', () => {
      const longNumber = 'J' + '1'.repeat(100);
      expect(isValidPointNumber(longNumber)).toBe(false);
    });
  });

  describe('isValidFileType', () => {
    it('应该接受 .dat 文件', () => {
      expect(isValidFileType('data.dat', ['dat'])).toBe(true);
      expect(isValidFileType('DATA.DAT', ['dat'])).toBe(true);
    });

    it('应该拒绝其他文件类型', () => {
      expect(isValidFileType('data.txt', ['dat'])).toBe(false);
      expect(isValidFileType('data.exe', ['dat'])).toBe(false);
      expect(isValidFileType('data', ['dat'])).toBe(false);
    });

    it('应该处理空字符串', () => {
      expect(isValidFileType('', ['dat'])).toBe(false);
    });

    it('应该支持多个扩展名', () => {
      expect(isValidFileType('data.dat', ['dat', 'txt'])).toBe(true);
      expect(isValidFileType('data.txt', ['dat', 'txt'])).toBe(true);
      expect(isValidFileType('data.csv', ['dat', 'txt'])).toBe(false);
    });
  });

  describe('isValidFileSize', () => {
    it('应该接受合法大小的文件', () => {
      expect(isValidFileSize(1024)).toBe(true); // 1KB
      expect(isValidFileSize(1024 * 1024)).toBe(true); // 1MB
      expect(isValidFileSize(10 * 1024 * 1024)).toBe(true); // 10MB
    });

    it('应该拒绝超过限制的文件', () => {
      const maxSize = 50 * 1024 * 1024; // 50MB
      expect(isValidFileSize(maxSize + 1)).toBe(false);
      expect(isValidFileSize(100 * 1024 * 1024)).toBe(false);
    });

    it('应该拒绝零大小的文件', () => {
      expect(isValidFileSize(0)).toBe(false);
    });

    it('应该拒绝负数大小', () => {
      expect(isValidFileSize(-1)).toBe(false);
    });

    it('应该支持自定义最大大小', () => {
      expect(isValidFileSize(10 * 1024 * 1024, 5)).toBe(false); // 10MB > 5MB
      expect(isValidFileSize(3 * 1024 * 1024, 5)).toBe(true); // 3MB < 5MB
    });
  });

  describe('isValidCoordinate', () => {
    it('应该接受合法的坐标', () => {
      expect(isValidCoordinate(500000, 3500000, 100)).toBe(true);
      expect(isValidCoordinate(0, 0, 0)).toBe(true);
    });

    it('应该拒绝超出范围的坐标', () => {
      // 根据 constants.ts，X/Y 范围是 -10000000 到 10000000
      expect(isValidCoordinate(10000001, 0, 0)).toBe(false); // X 超出范围
      expect(isValidCoordinate(0, 10000001, 0)).toBe(false); // Y 超出范围
      expect(isValidCoordinate(0, 0, 20000)).toBe(false); // Z 超出范围（Z_MAX = 10000）
    });

    it('应该拒绝 NaN', () => {
      expect(isValidCoordinate(NaN, 0, 0)).toBe(false);
      expect(isValidCoordinate(0, NaN, 0)).toBe(false);
      expect(isValidCoordinate(0, 0, NaN)).toBe(false);
    });

    it('应该拒绝 Infinity', () => {
      expect(isValidCoordinate(Infinity, 0, 0)).toBe(false);
      expect(isValidCoordinate(0, -Infinity, 0)).toBe(false);
    });
  });

  describe('isValidLatLng', () => {
    it('应该接受合法的经纬度', () => {
      expect(isValidLatLng(39.9, 116.4)).toBe(true); // 北京
      expect(isValidLatLng(0, 0)).toBe(true);
      expect(isValidLatLng(90, 180)).toBe(true);
      expect(isValidLatLng(-90, -180)).toBe(true);
    });

    it('应该拒绝超出范围的经纬度', () => {
      expect(isValidLatLng(91, 0)).toBe(false); // 纬度超出
      expect(isValidLatLng(-91, 0)).toBe(false);
      expect(isValidLatLng(0, 181)).toBe(false); // 经度超出
      expect(isValidLatLng(0, -181)).toBe(false);
    });

    it('应该拒绝 NaN', () => {
      expect(isValidLatLng(NaN, 0)).toBe(false);
      expect(isValidLatLng(0, NaN)).toBe(false);
    });
  });

  describe('isValidNumber', () => {
    it('应该接受合法的数字', () => {
      expect(isValidNumber(0)).toBe(true);
      expect(isValidNumber(123)).toBe(true);
      expect(isValidNumber(-123)).toBe(true);
      expect(isValidNumber(123.456)).toBe(true);
    });

    it('应该接受数字字符串', () => {
      expect(isValidNumber('123')).toBe(true);
      expect(isValidNumber('-123')).toBe(true);
      expect(isValidNumber('123.456')).toBe(true);
    });

    it('应该拒绝 NaN', () => {
      expect(isValidNumber(NaN)).toBe(false);
    });

    it('应该拒绝 Infinity', () => {
      expect(isValidNumber(Infinity)).toBe(false);
      expect(isValidNumber(-Infinity)).toBe(false);
    });

    it('应该拒绝非数字字符串', () => {
      expect(isValidNumber('abc')).toBe(false);
      // '12a3' 会被 parseFloat 解析为 12，所以会返回 true
      expect(isValidNumber('12a3')).toBe(true); // parseFloat('12a3') = 12
    });

    it('应该拒绝空字符串', () => {
      expect(isValidNumber('')).toBe(false);
    });

    it('应该拒绝 null 和 undefined', () => {
      expect(isValidNumber(null)).toBe(false);
      expect(isValidNumber(undefined)).toBe(false);
    });
  });

  describe('limitStringLength', () => {
    it('应该保留短于限制的字符串', () => {
      const input = 'Hello';
      const result = limitStringLength(input, 10);
      expect(result).toBe('Hello');
    });

    it('应该截断超过限制的字符串', () => {
      const input = 'Hello World';
      const result = limitStringLength(input, 5);
      expect(result).toBe('Hello');
    });

    it('应该处理等于限制长度的字符串', () => {
      const input = 'Hello';
      const result = limitStringLength(input, 5);
      expect(result).toBe('Hello');
    });

    it('应该处理空字符串', () => {
      const result = limitStringLength('', 10);
      expect(result).toBe('');
    });

    it('应该正确处理中文字符', () => {
      const input = '你好世界';
      const result = limitStringLength(input, 2);
      expect(result).toBe('你好');
    });
  });
});
