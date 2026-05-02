import { describe, it, expect } from 'vitest';
import { DatFileParser } from './fileParser';

describe('fileParser - 安全性和边界条件测试', () => {
  const parser = new DatFileParser();

  // 辅助函数：创建 File 对象
  function createTestFile(content: string, fileName: string): File {
    return new File([content], fileName, { type: 'text/plain' });
  }

  describe('XSS 攻击防护', () => {
    it('应该清理 HTML 标签', async () => {
      const testData = `<script>alert('XSS')</script>,,100.0,200.0,50.0
<img src=x onerror=alert('XSS')>,,150.0,250.0,60.0`;
      
      const file = createTestFile(testData, 'xss_attack.dat');
      const result = await parser.parse(file, 'test-file-id');
      
      // 验证所有点号都不包含 HTML 标签
      result.points.forEach(point => {
        expect(point.pointNumber).not.toContain('<');
        expect(point.pointNumber).not.toContain('>');
      });
      
      // 应该有警告（因为点号被清理）
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('应该清理事件处理器中的特殊字符', async () => {
      const testData = `onclick=alert('XSS'),,100.0,200.0,50.0
onerror=alert('XSS'),,150.0,250.0,60.0`;
      
      const file = createTestFile(testData, 'xss_events.dat');
      const result = await parser.parse(file, 'test-file-id');
      
      // 验证点号不包含特殊字符（=, ', ()）
      result.points.forEach(point => {
        expect(point.pointNumber).not.toContain('=');
        expect(point.pointNumber).not.toContain("'");
        expect(point.pointNumber).not.toContain('(');
        expect(point.pointNumber).not.toContain(')');
      });
      
      // 注意：普通字母（如 onclick, alert）会被保留，但没有特殊字符就无法执行
    });

    it('应该清理 JavaScript 协议', async () => {
      const testData = `javascript:alert('XSS'),,100.0,200.0,50.0`;
      
      const file = createTestFile(testData, 'js_protocol.dat');
      const result = await parser.parse(file, 'test-file-id');
      
      // 验证点号不包含冒号
      expect(result.points[0].pointNumber).not.toContain(':');
    });
  });

  describe('路径遍历攻击防护', () => {
    it('应该清理相对路径遍历字符', async () => {
      const testData = `../../etc/passwd,,100.0,200.0,50.0
../../../windows/system32,,150.0,250.0,60.0`;
      
      const file = createTestFile(testData, 'path_traversal.dat');
      const result = await parser.parse(file, 'test-file-id');
      
      // 验证点号不包含路径遍历字符
      result.points.forEach(point => {
        expect(point.pointNumber).not.toContain('..');
        expect(point.pointNumber).not.toContain('/');
        expect(point.pointNumber).not.toContain('\\');
      });
    });

    it('应该清理绝对路径', async () => {
      const testData = `/etc/shadow,,100.0,200.0,50.0
C:\\Windows\\System32,,150.0,250.0,60.0`;
      
      const file = createTestFile(testData, 'absolute_path.dat');
      const result = await parser.parse(file, 'test-file-id');
      
      // 验证点号不包含路径分隔符
      result.points.forEach(point => {
        expect(point.pointNumber).not.toContain('/');
        expect(point.pointNumber).not.toContain('\\');
        expect(point.pointNumber).not.toContain(':');
      });
    });
  });

  describe('注入攻击防护', () => {
    it('应该清理 SQL 注入字符', async () => {
      const testData = `1' OR '1'='1,,100.0,200.0,50.0
admin'--,,150.0,250.0,60.0`;
      
      const file = createTestFile(testData, 'sql_injection.dat');
      const result = await parser.parse(file, 'test-file-id');
      
      // 验证点号不包含 SQL 特殊字符（单引号和等号）
      result.points.forEach(point => {
        expect(point.pointNumber).not.toContain("'");
        expect(point.pointNumber).not.toContain('=');
      });
      
      // 注意：连字符（--）是允许的字符，但没有单引号和空格就无法构成 SQL 注入
      // 第二个点号应该是 "admin--"（连字符被保留）
      expect(result.points[1].pointNumber).toBe('admin--');
    });

    it('应该清理命令注入字符', async () => {
      const testData = `; ls -la,,100.0,200.0,50.0
| cat /etc/passwd,,150.0,250.0,60.0
\`whoami\`,,160.0,260.0,70.0`;
      
      const file = createTestFile(testData, 'command_injection.dat');
      const result = await parser.parse(file, 'test-file-id');
      
      // 验证点号不包含命令注入字符
      result.points.forEach(point => {
        expect(point.pointNumber).not.toContain(';');
        expect(point.pointNumber).not.toContain('|');
        expect(point.pointNumber).not.toContain('`');
        expect(point.pointNumber).not.toContain('$');
      });
    });
  });

  describe('格式错误处理', () => {
    it('应该检测字段不足的行', async () => {
      const testData = `1,100.0,200.0,50.0
2,,150.0,250.0
3,,160.0`;
      
      const file = createTestFile(testData, 'invalid_format.dat');
      const result = await parser.parse(file, 'test-file-id');
      
      // 应该有错误
      expect(result.errors.length).toBeGreaterThan(0);
      
      // 错误信息应该提到字段不足
      expect(result.errors.some(e => e.message.includes('字段数量不足'))).toBe(true);
    });

    it('应该处理只有逗号的行', async () => {
      const testData = `,,,,
1,,100.0,200.0,50.0`;
      
      const file = createTestFile(testData, 'only_commas.dat');
      const result = await parser.parse(file, 'test-file-id');
      
      // 第一行应该产生错误或警告
      expect(result.errors.length + result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('无效坐标处理', () => {
    it('应该检测 NaN 坐标', async () => {
      const testData = `1,,NaN,200.0,50.0
2,,150.0,NaN,60.0
3,,160.0,260.0,NaN`;
      
      const file = createTestFile(testData, 'nan_coordinates.dat');
      const result = await parser.parse(file, 'test-file-id');
      
      // 应该有错误
      expect(result.errors.length).toBeGreaterThan(0);
      
      // 错误信息应该提到坐标无效
      expect(result.errors.some(e => e.message.includes('坐标值无效'))).toBe(true);
    });

    it('应该检测 Infinity 坐标', async () => {
      const testData = `1,,Infinity,200.0,50.0
2,,150.0,-Infinity,60.0`;
      
      const file = createTestFile(testData, 'infinity_coordinates.dat');
      const result = await parser.parse(file, 'test-file-id');
      
      // parseFloat('Infinity') 返回 Infinity，这是有效的数字
      // 但应该有警告（超出合理范围）
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.message.includes('坐标值超出合理范围'))).toBe(true);
    });
  });

  describe('极端数值处理', () => {
    it('应该警告超出范围的坐标', async () => {
      const testData = `1,,999999999.999,999999999.999,999999.999
2,,-999999999.999,-999999999.999,-999999.999`;
      
      const file = createTestFile(testData, 'extreme_values.dat');
      const result = await parser.parse(file, 'test-file-id');
      
      // 应该有警告
      expect(result.warnings.length).toBeGreaterThan(0);
      
      // 警告信息应该提到坐标超出范围
      expect(result.warnings.some(w => w.message.includes('坐标值超出合理范围'))).toBe(true);
    });

    it('应该处理科学计数法', async () => {
      const testData = `1,,1.5e3,2.5e3,5.0e1
2,,1.5e-3,2.5e-3,5.0e-1`;
      
      const file = createTestFile(testData, 'scientific_notation.dat');
      const result = await parser.parse(file, 'test-file-id');
      
      // 应该成功解析
      expect(result.points.length).toBe(2);
      
      // 验证坐标值
      expect(result.points[0].x).toBeCloseTo(1500, 1);
      expect(result.points[1].x).toBeCloseTo(0.0015, 4);
    });
  });

  describe('特殊字符处理', () => {
    it('应该保留中文字符', async () => {
      const testData = `测量点1,,100.0,200.0,50.0
控制点2,,150.0,250.0,60.0`;
      
      const file = createTestFile(testData, 'chinese_characters.dat');
      const result = await parser.parse(file, 'test-file-id');
      
      // 应该成功解析
      expect(result.points.length).toBe(2);
      
      // 验证中文字符被保留
      expect(result.points[0].pointNumber).toContain('测量点');
      expect(result.points[1].pointNumber).toContain('控制点');
    });

    it('应该清理特殊符号', async () => {
      const testData = `Point#1,,100.0,200.0,50.0
Point@2,,150.0,250.0,60.0
Point$3,,160.0,260.0,70.0`;
      
      const file = createTestFile(testData, 'special_symbols.dat');
      const result = await parser.parse(file, 'test-file-id');
      
      // 验证特殊符号被清理
      result.points.forEach(point => {
        expect(point.pointNumber).not.toContain('#');
        expect(point.pointNumber).not.toContain('@');
        expect(point.pointNumber).not.toContain('$');
      });
    });
  });

  describe('空值和空白处理', () => {
    it('应该处理空点号', async () => {
      const testData = `,,100.0,200.0,50.0
   ,,150.0,250.0,60.0`;
      
      const file = createTestFile(testData, 'empty_point_number.dat');
      const result = await parser.parse(file, 'test-file-id');
      
      // 应该成功解析
      expect(result.points.length).toBe(2);
      
      // 应该有警告
      expect(result.warnings.length).toBeGreaterThan(0);
      
      // 点号应该被自动生成
      result.points.forEach(point => {
        expect(point.pointNumber).toBeTruthy();
        expect(point.pointNumber.length).toBeGreaterThan(0);
      });
    });

    it('应该忽略空行', async () => {
      const testData = `1,,100.0,200.0,50.0


2,,150.0,250.0,60.0`;
      
      const file = createTestFile(testData, 'empty_lines.dat');
      const result = await parser.parse(file, 'test-file-id');
      
      // 应该只解析 2 个点
      expect(result.points.length).toBe(2);
    });
  });

  describe('重复点号处理', () => {
    it('应该检测并处理重复点号', async () => {
      const testData = `1,,100.0,200.0,50.0
2,,150.0,250.0,60.0
1,,110.0,210.0,55.0
1,,120.0,220.0,58.0`;
      
      const file = createTestFile(testData, 'duplicate_points.dat');
      const result = await parser.parse(file, 'test-file-id');
      
      // 应该成功解析所有点
      expect(result.points.length).toBe(4);
      
      // 应该有警告
      expect(result.warnings.length).toBeGreaterThan(0);
      
      // 重复的点号应该被重命名
      const pointNumbers = result.points.map(p => p.pointNumber);
      const uniquePointNumbers = new Set(pointNumbers);
      expect(uniquePointNumbers.size).toBe(4); // 所有点号应该唯一
      
      // 第一个点号应该是 "1"
      expect(result.points[0].pointNumber).toBe('1');
      
      // 后续重复的点号应该有 UUID 后缀
      expect(result.points[2].pointNumber).toMatch(/^1_/);
      expect(result.points[3].pointNumber).toMatch(/^1_/);
    });
  });

  describe('超长点号处理', () => {
    it('应该限制点号长度', async () => {
      const longPointNumber = 'A'.repeat(100);
      const testData = `${longPointNumber},,100.0,200.0,50.0`;
      
      const file = createTestFile(testData, 'very_long_point_number.dat');
      const result = await parser.parse(file, 'test-file-id');
      
      // 应该成功解析
      expect(result.points.length).toBe(1);
      
      // 点号长度应该被限制（最大 50 字符）
      expect(result.points[0].pointNumber.length).toBeLessThanOrEqual(50);
    });
  });

  describe('多语言字符处理', () => {
    it('应该正确处理多语言字符', async () => {
      const testData = `测量点1,,100.0,200.0,50.0
Point2,,150.0,250.0,60.0
Точка3,,160.0,260.0,70.0
ポイント4,,170.0,270.0,80.0`;
      
      const file = createTestFile(testData, 'mixed_encoding.dat');
      const result = await parser.parse(file, 'test-file-id');
      
      // 应该成功解析所有点
      expect(result.points.length).toBe(4);
      
      // 验证中文字符被保留
      expect(result.points[0].pointNumber).toContain('测量点');
      expect(result.points[1].pointNumber).toContain('Point');
      
      // 注意：sanitizePointNumber 只保留中文、英文字母、数字、下划线和连字符
      // 俄文（Точка）和日文（ポイント）字符会被移除，只保留数字
      expect(result.points[2].pointNumber).toBe('3');
      expect(result.points[3].pointNumber).toBe('4');
      
      // 应该有警告（非中文的其他语言字符被清理）
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('综合安全测试', () => {
    it('应该处理包含多种攻击向量的文件', async () => {
      const testData = `<script>alert('XSS')</script>,,100.0,200.0,50.0
../../etc/passwd,,150.0,250.0,60.0
1' OR '1'='1,,160.0,260.0,70.0
; ls -la,,170.0,270.0,80.0`;
      
      const file = createTestFile(testData, 'mixed_attacks.dat');
      const result = await parser.parse(file, 'test-file-id');
      
      // 应该成功解析所有点（不崩溃）
      expect(result.points.length).toBe(4);
      
      // 所有危险字符应该被清理
      result.points.forEach(point => {
        expect(point.pointNumber).not.toContain('<');
        expect(point.pointNumber).not.toContain('>');
        expect(point.pointNumber).not.toContain('..');
        expect(point.pointNumber).not.toContain('/');
        expect(point.pointNumber).not.toContain("'");
        expect(point.pointNumber).not.toContain(';');
      });
      
      // 应该有警告
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('应该处理包含多种边界条件的文件', async () => {
      const testData = `,,100.0,200.0,50.0
1,,NaN,200.0,50.0
2,,999999999.999,999999999.999,999999.999
${'A'.repeat(100)},,160.0,260.0,70.0
测量点#1,,170.0,270.0,80.0`;
      
      const file = createTestFile(testData, 'mixed_edge_cases.dat');
      const result = await parser.parse(file, 'test-file-id');
      
      // 应该处理所有情况（不崩溃）
      expect(result.points.length).toBeGreaterThanOrEqual(0);
      
      // 应该有错误或警告
      expect(result.errors.length + result.warnings.length).toBeGreaterThan(0);
    });
  });
});
