import { describe, it, expect } from 'vitest';
import { DatFileParser } from './fileParser';

describe('fileParser - 文件解析集成测试', () => {
  const parser = new DatFileParser();

  // 辅助函数：创建 File 对象
  function createTestFile(content: string, fileName: string): File {
    return new File([content], fileName, { type: 'text/plain' });
  }

  describe('DatFileParser.parse', () => {
    it('应该正确解析简单格式的 .dat 文件', async () => {
      // 创建测试数据（前 10 行）
      const testData = `1,,4743.416,1913.812,153.260
2,,1651.044,3176.615,0.000
3,,806.633,1161.072,610.191
4,,1498.704,2976.454,0.000
5,,1545.550,3239.038,125.962
6,,2689.719,491.518,425.728
7,,932.783,1406.856,497.077
8,,0.000,4249.841,910.723
9,,1595.041,2467.486,308.471
10,,1624.466,3162.278,129.304`;
      
      const file = createTestFile(testData, 'test.dat');
      const result = await parser.parse(file, 'test-file-id');
      
      // 验证解析结果
      expect(result.points).toBeDefined();
      expect(result.points.length).toBe(10);
      
      // 验证第一个点的数据
      const firstPoint = result.points[0];
      expect(firstPoint.pointNumber).toBe('1');
      expect(firstPoint.x).toBeCloseTo(4743.416, 3);
      expect(firstPoint.y).toBeCloseTo(1913.812, 3);
      expect(firstPoint.z).toBeCloseTo(153.260, 3);
      expect(firstPoint.type).toBe('survey'); // 点类型
      
      // 验证没有错误
      expect(result.errors).toHaveLength(0);
    });

    it('应该正确识别控制点和测量点', async () => {
      // 创建包含控制点和测量点的测试数据
      const testData = `GNSS_1,,2855684.044,589207.101,118.040
k15,,-6504.442,365381.400,-0.077
1,,2855684.331,589189.736,118.164
2,,2855678.057,589189.929,118.085`;
      
      const file = createTestFile(testData, 'test_mixed.dat');
      const result = await parser.parse(file, 'test-file-id');
      
      expect(result.points.length).toBe(4);
      
      // 验证所有点都被解析
      expect(result.points[0].pointNumber).toBe('GNSS_1');
      expect(result.points[1].pointNumber).toBe('k15');
      expect(result.points[2].pointNumber).toBe('1');
      expect(result.points[3].pointNumber).toBe('2');
      
      // 验证所有点都有类型
      result.points.forEach(point => {
        expect(point.type).toBeDefined();
      });
    });

    it('应该处理重复的点号', async () => {
      const testData = `1,,100.0,200.0,50.0
2,,150.0,250.0,60.0
1,,110.0,210.0,55.0`;
      
      const file = createTestFile(testData, 'test_duplicate.dat');
      const result = await parser.parse(file, 'test-file-id');
      
      expect(result.points.length).toBe(3);
      
      // 应该有警告
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0].message).toContain('重复');
      
      // 第三个点应该被重命名（使用 UUID 后缀）
      expect(result.points[0].pointNumber).toBe('1');
      expect(result.points[1].pointNumber).toBe('2');
      expect(result.points[2].pointNumber).toMatch(/^1_/); // 重复点号自动重命名，使用 UUID 后缀
    });

    it('应该处理空行', async () => {
      const testData = `1,,100.0,200.0,50.0

2,,150.0,250.0,60.0

3,,160.0,260.0,70.0`;
      
      const file = createTestFile(testData, 'test_empty_lines.dat');
      const result = await parser.parse(file, 'test-file-id');
      
      expect(result.points.length).toBe(3);
    });

    it('应该检测无效的坐标值', async () => {
      const testData = `1,,abc,200.0,50.0
2,,150.0,def,60.0
3,,160.0,260.0,ghi`;
      
      const file = createTestFile(testData, 'test_invalid.dat');
      const result = await parser.parse(file, 'test-file-id');
      
      // 应该有错误
      expect(result.errors.length).toBeGreaterThan(0);
      
      // 验证错误信息
      expect(result.errors[0].message).toContain('坐标值无效');
    });

    it('应该处理超出范围的坐标', async () => {
      const testData = `1,,20000000,200.0,50.0
2,,150.0,20000000,60.0
3,,160.0,260.0,20000`;
      
      const file = createTestFile(testData, 'test_out_of_range.dat');
      const result = await parser.parse(file, 'test-file-id');
      
      // 应该有警告
      expect(result.warnings.length).toBeGreaterThan(0);
      
      // 验证警告信息
      expect(result.warnings.some(w => w.message.includes('坐标值超出合理范围'))).toBe(true);
    });

    it('应该处理详细格式（包含质量参数）', async () => {
      const testData = `1,,100.0,200.0,50.0,HRMS:0.004,VRMS:0.009,STATUS:FIXED
2,,150.0,250.0,60.0,HRMS:0.005,VRMS:0.010,STATUS:FIXED`;
      
      const file = createTestFile(testData, 'test_detailed.dat');
      const result = await parser.parse(file, 'test-file-id');
      
      expect(result.points.length).toBe(2);
      
      // 验证质量参数（键名会被转换为小写）
      const firstPoint = result.points[0];
      expect(firstPoint.qualityParams).toBeDefined();
      expect(firstPoint.qualityParams?.hrms).toBeCloseTo(0.004, 3);
      expect(firstPoint.qualityParams?.vrms).toBeCloseTo(0.009, 3);
      expect(firstPoint.qualityParams?.status).toBe('FIXED');
    });

    it('应该正确清理点号中的特殊字符', async () => {
      const testData = `J1<script>,,100.0,200.0,50.0
K2/../,,150.0,250.0,60.0`;
      
      const file = createTestFile(testData, 'test_sanitize.dat');
      const result = await parser.parse(file, 'test-file-id');
      
      expect(result.points.length).toBe(2);
      
      // 验证特殊字符已被清理（sanitize 只移除特殊字符，保留字母和数字）
      expect(result.points[0].pointNumber).not.toContain('<');
      expect(result.points[0].pointNumber).not.toContain('>');
      expect(result.points[0].pointNumber).toContain('J1'); // 字母和数字保留
      expect(result.points[0].pointNumber).toContain('script'); // 普通字母保留
      
      expect(result.points[1].pointNumber).not.toContain('..');
      expect(result.points[1].pointNumber).not.toContain('/');
      expect(result.points[1].pointNumber).toContain('K2'); // 字母和数字保留
    });

    it('应该处理空文件', async () => {
      const testData = '';
      
      const file = createTestFile(testData, 'test_empty.dat');
      const result = await parser.parse(file, 'test-file-id');
      
      expect(result.points.length).toBe(0);
    });

    it('应该处理只有空行的文件', async () => {
      const testData = '\n\n\n';
      
      const file = createTestFile(testData, 'test_only_empty_lines.dat');
      const result = await parser.parse(file, 'test-file-id');
      
      expect(result.points.length).toBe(0);
    });

    it('应该处理大量数据（性能测试）', async () => {
      // 生成 1000 个点的测试数据
      const lines: string[] = [];
      for (let i = 1; i <= 1000; i++) {
        const x = Math.random() * 5000;
        const y = Math.random() * 5000;
        const z = Math.random() * 1000;
        lines.push(`${i},,${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`);
      }
      const testData = lines.join('\n');
      
      const file = createTestFile(testData, 'test_1000points.dat');
      
      const startTime = Date.now();
      const result = await parser.parse(file, 'test-file-id');
      const endTime = Date.now();
      
      const parseTime = endTime - startTime;
      
      expect(result.points.length).toBe(1000);
      
      // 解析 1000 个点应该在 1 秒内完成
      expect(parseTime).toBeLessThan(1000);
      
      console.log(`解析 1000 个点耗时: ${parseTime}ms`);
    });
  });
});
