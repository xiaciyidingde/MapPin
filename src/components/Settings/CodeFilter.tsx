import { useMemo, useCallback } from 'react';
import { Checkbox, Card, Empty, Space, Divider, theme } from 'antd';
import { useMapStore, useDataStore } from '../../store';

export function CodeFilter() {
  const currentFileId = useMapStore((state) => state.currentFileId);
  const codeFilter = useMapStore((state) => state.codeFilter);
  const setCodeFilter = useMapStore((state) => state.setCodeFilter);
  const points = useDataStore((state) => state.points);
  const { token } = theme.useToken();

  const currentPoints = useMemo(() => {
    return currentFileId ? points.get(currentFileId) || [] : [];
  }, [currentFileId, points]);

  // 提取所有不重复的编码，分为有编码和无编码
  const { codes, hasNoCodeCount } = useMemo(() => {
    const codeSet = new Set<string>();
    let noCodeCount = 0;
    for (const point of currentPoints) {
      if (point.code && point.code.trim()) {
        codeSet.add(point.code.trim());
      } else {
        noCodeCount++;
      }
    }
    const sorted = [...codeSet].sort((a, b) => a.localeCompare(b, 'zh'));
    return { codes: sorted, hasNoCodeCount: noCodeCount };
  }, [currentPoints]);

  // 全部选择（空数组表示全选）
  const isAllSelected = useMemo(() => {
    if (codeFilter.length === 0) return true; // 空数组表示全选
    const allOptions = [...codes, '__no_code__'];
    return allOptions.length > 0 && allOptions.every((code) => codeFilter.includes(code));
  }, [codeFilter, codes]);

  // 部分选择
  const isIndeterminate = useMemo(() => {
    if (codeFilter.length === 0) return false; // 空数组是全选，不是部分选择
    if (isAllSelected) return false;
    return codeFilter.length > 0;
  }, [isAllSelected, codeFilter.length]);

  const handleToggleAll = useCallback(() => {
    if (isAllSelected) {
      setCodeFilter([]);
    } else {
      setCodeFilter([...codes, '__no_code__']);
    }
  }, [isAllSelected, codes, setCodeFilter]);

  const handleToggleCode = useCallback(
    (code: string) => {
      if (codeFilter.includes(code)) {
        setCodeFilter(codeFilter.filter((c) => c !== code));
      } else {
        setCodeFilter([...codeFilter, code]);
      }
    },
    [codeFilter, setCodeFilter]
  );

  if (!currentFileId) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: token.colorTextQuaternary }}>
        请先选择一个文件
      </div>
    );
  }

  if (codes.length === 0 && hasNoCodeCount === 0) {
    return (
      <div style={{ padding: 24 }}>
        <Empty description="该文件没有点位数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '16px' }}>
      <div style={{ width: '100%', maxWidth: 600 }}>
        {/* 说明卡片 */}
        <Card
          size="small"
          style={{ marginBottom: 16, backgroundColor: token.colorInfoBg, borderColor: token.colorInfoBorder }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <span style={{ fontSize: 16 }}>ℹ️</span>
            <div style={{ flex: 1, fontSize: 13, color: token.colorTextSecondary }}>
              通过勾选编码来控制主界面地图中显示哪些点位。未勾选的编码对应的点位将不会在地图上显示。
            </div>
          </div>
        </Card>

        {/* 编码过滤卡片 */}
        <Card
          size="small"
          styles={{
            body: { padding: '12px 16px' },
          }}
          style={{ backgroundColor: token.colorBgContainer }}
        >
        {/* 全部 */}
        <Checkbox
          checked={isAllSelected}
          indeterminate={isIndeterminate}
          onChange={handleToggleAll}
          style={{ fontWeight: 500, fontSize: 14 }}
        >
          全部
        </Checkbox>

        <Divider style={{ margin: '10px 0' }} />

        {/* 无编码 */}
        {hasNoCodeCount > 0 && (
          <Checkbox
            checked={codeFilter.includes('__no_code__')}
            onChange={() => handleToggleCode('__no_code__')}
            style={{ marginBottom: 8 }}
          >
            无编码
            <span style={{ color: token.colorTextQuaternary, fontSize: 12, marginLeft: 4 }}>
              ({hasNoCodeCount})
            </span>
          </Checkbox>
        )}

        {/* 各编码项 */}
        {codes.length > 0 && (
          <div style={{ marginTop: hasNoCodeCount > 0 ? 0 : 0 }}>
            {hasNoCodeCount > 0 && <Divider style={{ margin: '8px 0' }} />}
            <Space orientation="vertical" style={{ width: '100%' }} size={4}>
              {codes.map((code) => {
                const count = currentPoints.filter((p) => p.code === code).length;
                return (
                  <Checkbox
                    key={code}
                    checked={codeFilter.includes(code)}
                    onChange={() => handleToggleCode(code)}
                    style={{ width: '100%' }}
                  >
                    <span>{code}</span>
                    <span style={{ color: token.colorTextQuaternary, fontSize: 12, marginLeft: 4 }}>
                      ({count})
                    </span>
                  </Checkbox>
                );
              })}
            </Space>
          </div>
        )}
      </Card>
      </div>
    </div>
  );
}