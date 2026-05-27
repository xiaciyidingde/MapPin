import { describe, it, expect } from 'vitest';
import { calculateCentralMeridian } from './projectionUtils';

describe('projectionUtils', () => {
  describe('calculateCentralMeridian', () => {
    describe('gauss-3 (3° 分带)', () => {
      it('应该正确计算中央经线 - 标准情况', () => {
        expect(calculateCentralMeridian(117, 'gauss-3')).toBe(117); // 117 / 3 = 39, 39 * 3 = 117
        expect(calculateCentralMeridian(120, 'gauss-3')).toBe(120); // 120 / 3 = 40, 40 * 3 = 120
        expect(calculateCentralMeridian(114, 'gauss-3')).toBe(114); // 114 / 3 = 38, 38 * 3 = 114
      });

      it('应该四舍五入到最近的 3° 倍数', () => {
        expect(calculateCentralMeridian(115.4, 'gauss-3')).toBe(114); // round(115.4/3) = 38, 38*3 = 114
        expect(calculateCentralMeridian(115.6, 'gauss-3')).toBe(117); // round(115.6/3) = 39, 39*3 = 117
        expect(calculateCentralMeridian(118.2, 'gauss-3')).toBe(117); // round(118.2/3) = 39, 39*3 = 117
        expect(calculateCentralMeridian(118.8, 'gauss-3')).toBe(120); // round(118.8/3) = 40, 40*3 = 120
      });

      it('应该限制在 75°-135° 范围内', () => {
        expect(calculateCentralMeridian(60, 'gauss-3')).toBe(75);   // 60 -> 60, 但限制为 75
        expect(calculateCentralMeridian(70, 'gauss-3')).toBe(75);   // 70 -> 69, 但限制为 75
        expect(calculateCentralMeridian(150, 'gauss-3')).toBe(135); // 150 -> 150, 但限制为 135
        expect(calculateCentralMeridian(140, 'gauss-3')).toBe(135); // 140 -> 141, 但限制为 135
      });

      it('应该处理边界值', () => {
        expect(calculateCentralMeridian(75, 'gauss-3')).toBe(75);   // 75 / 3 = 25, 25 * 3 = 75
        expect(calculateCentralMeridian(135, 'gauss-3')).toBe(135); // 135 / 3 = 45, 45 * 3 = 135
      });

      it('应该处理中国常用经度范围', () => {
        // 北京 116.4°
        expect(calculateCentralMeridian(116.4, 'gauss-3')).toBe(117);
        // 上海 121.5° -> round(121.5/3) = 41, 41*3 = 123
        expect(calculateCentralMeridian(121.5, 'gauss-3')).toBe(123);
        // 广州 113.3°
        expect(calculateCentralMeridian(113.3, 'gauss-3')).toBe(114);
        // 成都 104.1°
        expect(calculateCentralMeridian(104.1, 'gauss-3')).toBe(105);
      });
    });

    describe('gauss-6 (6° 分带)', () => {
      it('应该正确计算中央经线 - 标准情况', () => {
        expect(calculateCentralMeridian(117, 'gauss-6')).toBe(117); // (117+3)/6 = 20, 20*6-3 = 117
        expect(calculateCentralMeridian(120, 'gauss-6')).toBe(123); // (120+3)/6 = 20.5, round=21, 21*6-3 = 123
        expect(calculateCentralMeridian(123, 'gauss-6')).toBe(123); // (123+3)/6 = 21, 21*6-3 = 123
      });

      it('应该四舍五入到最近的 6° 分带中央经线', () => {
        expect(calculateCentralMeridian(115, 'gauss-6')).toBe(117); // (115+3)/6 = 19.67, round=20, 20*6-3 = 117
        expect(calculateCentralMeridian(119, 'gauss-6')).toBe(117); // (119+3)/6 = 20.33, round=20, 20*6-3 = 117
        expect(calculateCentralMeridian(121, 'gauss-6')).toBe(123); // (121+3)/6 = 20.67, round=21, 21*6-3 = 123
        expect(calculateCentralMeridian(125, 'gauss-6')).toBe(123); // (125+3)/6 = 21.33, round=21, 21*6-3 = 123
      });

      it('应该限制在 75°-135° 范围内', () => {
        expect(calculateCentralMeridian(60, 'gauss-6')).toBe(75);   // 计算结果 < 75, 限制为 75
        expect(calculateCentralMeridian(70, 'gauss-6')).toBe(75);   // 计算结果 < 75, 限制为 75
        expect(calculateCentralMeridian(150, 'gauss-6')).toBe(135); // 计算结果 > 135, 限制为 135
        expect(calculateCentralMeridian(140, 'gauss-6')).toBe(135); // 计算结果 > 135, 限制为 135
      });

      it('应该处理边界值', () => {
        expect(calculateCentralMeridian(75, 'gauss-6')).toBe(75);   // (75+3)/6 = 13, 13*6-3 = 75
        expect(calculateCentralMeridian(135, 'gauss-6')).toBe(135); // (135+3)/6 = 23, 23*6-3 = 135
      });

      it('应该处理中国常用经度范围', () => {
        // 北京 116.4°
        expect(calculateCentralMeridian(116.4, 'gauss-6')).toBe(117);
        // 上海 121.5°
        expect(calculateCentralMeridian(121.5, 'gauss-6')).toBe(123);
        // 广州 113.3°
        expect(calculateCentralMeridian(113.3, 'gauss-6')).toBe(111);
        // 成都 104.1°
        expect(calculateCentralMeridian(104.1, 'gauss-6')).toBe(105);
      });
    });

    describe('边缘情况', () => {
      it('应该处理负数经度', () => {
        expect(calculateCentralMeridian(-10, 'gauss-3')).toBe(75);  // 限制为最小值
        expect(calculateCentralMeridian(-10, 'gauss-6')).toBe(75);  // 限制为最小值
      });

      it('应该处理超大经度', () => {
        expect(calculateCentralMeridian(200, 'gauss-3')).toBe(135); // 限制为最大值
        expect(calculateCentralMeridian(200, 'gauss-6')).toBe(135); // 限制为最大值
      });

      it('应该处理零值', () => {
        expect(calculateCentralMeridian(0, 'gauss-3')).toBe(75);    // 0 -> 0, 但限制为 75
        expect(calculateCentralMeridian(0, 'gauss-6')).toBe(75);    // 0 -> -3, 但限制为 75
      });

      it('应该处理小数精度', () => {
        expect(calculateCentralMeridian(116.123456, 'gauss-3')).toBe(117);
        expect(calculateCentralMeridian(116.987654, 'gauss-3')).toBe(117);
        expect(calculateCentralMeridian(116.123456, 'gauss-6')).toBe(117);
        expect(calculateCentralMeridian(116.987654, 'gauss-6')).toBe(117);
      });
    });

    describe('3° 和 6° 分带对比', () => {
      it('相同经度在不同分带下可能有不同的中央经线', () => {
        const lng = 115;
        expect(calculateCentralMeridian(lng, 'gauss-3')).toBe(114);
        expect(calculateCentralMeridian(lng, 'gauss-6')).toBe(117);
      });

      it('某些经度在两种分带下中央经线相同', () => {
        const lng = 117;
        expect(calculateCentralMeridian(lng, 'gauss-3')).toBe(117);
        expect(calculateCentralMeridian(lng, 'gauss-6')).toBe(117);
      });
    });
  });
});
