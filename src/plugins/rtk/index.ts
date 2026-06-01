/**
 * RTK 插件入口
 */

import { registerPlugin } from '@capacitor/core';
import type { RTKPlugin } from './definitions';

const RTK = registerPlugin<RTKPlugin>('RTK', {
  web: () => import('./web').then((m) => new m.RTKWeb()),
});

export * from './definitions';
export { RTK };
