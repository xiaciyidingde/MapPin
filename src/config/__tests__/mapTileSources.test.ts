import { describe, it, expect, vi, beforeEach } from 'vitest';

const localStorageStore = new Map<string, string>();
const localStorageMock = {
  getItem: vi.fn((key: string) => localStorageStore.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => {
    localStorageStore.set(key, value);
  }),
  removeItem: vi.fn((key: string) => {
    localStorageStore.delete(key);
  }),
};

type AppConfigStub = { map: { tianDiTuTokens: string[]; disabledTileSources: string[] } };

let stub: AppConfigStub = { map: { tianDiTuTokens: [], disabledTileSources: [] } };

vi.mock('../appConfig', () => ({
  appConfig: new Proxy({} as Record<string, unknown>, {
    get(_, prop) {
      if (prop === 'map') return { ...stub.map };
      return undefined;
    },
  }),
}));

describe('mapTileSources', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorageStore.clear();
    stub = { map: { tianDiTuTokens: [], disabledTileSources: [] } };
    vi.stubGlobal('localStorage', localStorageMock);
    vi.stubGlobal('console', {
      ...console,
      warn: vi.fn(),
      error: vi.fn(),
      log: vi.fn(),
    });
  });

  describe('MAP_TILE_SOURCES', () => {
    it('应该包含 OSM 和三种天地图瓦片源', async () => {
      const { MAP_TILE_SOURCES } = await import('../mapTileSources');
      expect(MAP_TILE_SOURCES).toHaveProperty('osm');
      expect(MAP_TILE_SOURCES).toHaveProperty('tianditu-vec');
      expect(MAP_TILE_SOURCES).toHaveProperty('tianditu-img');
      expect(MAP_TILE_SOURCES).toHaveProperty('tianditu-ter');
    });
  });

  describe('getMapTileUrl', () => {
    it('应该返回 OSM 底图 URL', async () => {
      const { getMapTileUrl } = await import('../mapTileSources');
      const url = getMapTileUrl('osm');
      expect(url).toContain('tile.openstreetmap.org');
    });

    it('应该在底图源未知时回退到 OSM', async () => {
      const { getMapTileUrl } = await import('../mapTileSources');
      const url = getMapTileUrl('nonexistent');
      expect(url).toContain('tile.openstreetmap.org');
    });

    it('在无 Token 时应该替换 {token} 为空', async () => {
      const { getMapTileUrl } = await import('../mapTileSources');
      const url = getMapTileUrl('tianditu-vec');
      expect(url).toContain('tk=');
      expect(url).not.toContain('{token}');
    });

    it('应该在有用户 Token 时替换 {token} 占位符', async () => {
      const { getMapTileUrl } = await import('../mapTileSources');
      const url = getMapTileUrl('tianditu-vec', 'user-token-123');
      expect(url).toContain('user-token-123');
    });

    it('应该在有公共 Token 池时使用池中 Token', async () => {
      stub.map.tianDiTuTokens = ['pool-token-1', 'pool-token-2'];
      const { getMapTileUrl } = await import('../mapTileSources');
      const url = getMapTileUrl('tianditu-vec');
      expect(url).toMatch(/pool-token-[12]/);
    });
  });

  describe('getAnnotationLayerUrl', () => {
    it('应该对于没有标注图层的底图源返回 undefined', async () => {
      const { getAnnotationLayerUrl } = await import('../mapTileSources');
      expect(getAnnotationLayerUrl('osm')).toBeUndefined();
    });

    it('应该在底图源不存在时返回 undefined', async () => {
      const { getAnnotationLayerUrl } = await import('../mapTileSources');
      expect(getAnnotationLayerUrl('nonexistent')).toBeUndefined();
    });

    it('应该返回天地图标注图层 URL', async () => {
      const { getAnnotationLayerUrl } = await import('../mapTileSources');
      const url = getAnnotationLayerUrl('tianditu-vec');
      expect(url).toContain('cva_w');
      // 无 Token 时 {token} 被替换为空
      expect(url).not.toContain('{token}');
    });

    it('应该在有用户 Token 时替换标注图层中的 Token 占位符', async () => {
      const { getAnnotationLayerUrl } = await import('../mapTileSources');
      const url = getAnnotationLayerUrl('tianditu-vec', 'user-token-456');
      expect(url).toContain('user-token-456');
    });
  });

  describe('getMapTileSourceList', () => {
    it('应该在不设置禁用源时返回全部来源', async () => {
      const { getMapTileSourceList } = await import('../mapTileSources');
      expect(getMapTileSourceList()).toHaveLength(4);
    });

    it('应该过滤掉已禁用的底图源', async () => {
      stub.map.disabledTileSources = ['tianditu-img', 'tianditu-ter'];
      const { getMapTileSourceList } = await import('../mapTileSources');
      const list = getMapTileSourceList();
      const ids = list.map((s) => s.id);
      expect(ids).toContain('osm');
      expect(ids).toContain('tianditu-vec');
      expect(ids).not.toContain('tianditu-img');
      expect(ids).not.toContain('tianditu-ter');
    });

    it('应该在全部禁用时返回空数组', async () => {
      stub.map.disabledTileSources = ['osm', 'tianditu-vec', 'tianditu-img', 'tianditu-ter'];
      const { getMapTileSourceList } = await import('../mapTileSources');
      expect(getMapTileSourceList()).toHaveLength(0);
    });
  });

  describe('getTiandituToken', () => {
    it('应该在提供用户 Token 时返回用户 Token', async () => {
      stub.map.tianDiTuTokens = ['pool-token'];
      const { getTiandituToken } = await import('../mapTileSources');
      expect(getTiandituToken('my-custom-token')).toBe('my-custom-token');
    });

    it('应该在用户 Token 为空字符串时使用公共 Token 池', async () => {
      stub.map.tianDiTuTokens = ['pool-token-1'];
      const { getTiandituToken } = await import('../mapTileSources');
      expect(getTiandituToken('')).toBe('pool-token-1');
    });

    it('应该在无公共 Token 且无用户 Token 时返回空字符串并警告', async () => {
      const { getTiandituToken } = await import('../mapTileSources');
      expect(getTiandituToken()).toBe('');
      expect(getTiandituToken(undefined)).toBe('');
      expect(console.warn).toHaveBeenCalled();
    });

    it('应该为同一用户始终返回相同 Token（固定分配）', async () => {
      stub.map.tianDiTuTokens = ['a', 'b', 'c', 'd', 'e'];
      const { getTiandituToken } = await import('../mapTileSources');
      const first = getTiandituToken();
      expect(getTiandituToken()).toBe(first);
    });
  });

  describe('Token 轮换', () => {
    it('switchToNextToken 应该切换到下一个 Token', async () => {
      stub.map.tianDiTuTokens = ['token-a', 'token-b', 'token-c'];
      const { switchToNextToken, getTiandituToken } = await import('../mapTileSources');
      const first = getTiandituToken();
      const result = switchToNextToken();
      expect(result).toBe(true);
      const second = getTiandituToken();
      expect(second).not.toBe(first);
    });

    it('switchToNextToken 应该跳过黑名单中的 Token', async () => {
      stub.map.tianDiTuTokens = ['token-a', 'token-b', 'token-c'];
      const { switchToNextToken, getTiandituToken } = await import('../mapTileSources');
      const first = getTiandituToken();
      switchToNextToken();
      const second = getTiandituToken();
      switchToNextToken();
      const third = getTiandituToken();
      expect(second).not.toBe(first);
      expect(third).not.toBe(first);
      expect(third).not.toBe(second);
    });

    it('应该在所有 Token 都失败后返回 false', async () => {
      stub.map.tianDiTuTokens = ['token-a', 'token-b'];
      const { switchToNextToken } = await import('../mapTileSources');
      expect(switchToNextToken()).toBe(true);
      expect(switchToNextToken()).toBe(false);
      expect(console.error).toHaveBeenCalled();
    });

    it('不应该使用已被黑名单的 Token', async () => {
      stub.map.tianDiTuTokens = ['token-a', 'token-b'];
      const { switchToNextToken, getTiandituToken } = await import('../mapTileSources');
      const first = getTiandituToken();
      switchToNextToken();
      const result = getTiandituToken();
      expect(result).not.toBe(first);
    });
  });

  describe('Token 状态查询', () => {
    it('areAllTokensFailed 应该在无公共 Token 时返回 true', async () => {
      const { areAllTokensFailed } = await import('../mapTileSources');
      expect(areAllTokensFailed()).toBe(true);
    });

    it('areAllTokensFailed 应该在有可用 Token 时返回 false', async () => {
      stub.map.tianDiTuTokens = ['token-a', 'token-b'];
      const { areAllTokensFailed } = await import('../mapTileSources');
      expect(areAllTokensFailed()).toBe(false);
    });

    it('should track warning state', async () => {
      const { hasShownTokenWarning, markWarningAsShown } =
        await import('../mapTileSources');
      expect(hasShownTokenWarning()).toBe(false);
      markWarningAsShown();
      expect(hasShownTokenWarning()).toBe(true);
    });
  });
});
