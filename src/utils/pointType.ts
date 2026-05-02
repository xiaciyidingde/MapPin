import type { PointType } from '../types';

/**
 * 根据点号判断点类型
 * 默认所有点都是测量点 (survey)
 * 用户可以后续手动标记为控制点
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function identifyPointType(_pointNumber: string): PointType {
  // 默认全部为测量点
  return 'survey';
}
