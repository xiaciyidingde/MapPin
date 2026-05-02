import { Drawer, Button, Input, Select, Empty, Spin, message, Modal, Flex, Card, Collapse, Tag } from 'antd';
import { SearchOutlined, DeleteOutlined, RollbackOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { useState, useEffect, useCallback } from 'react';
import { useDataStore } from '../../store/useDataStore';
import { dataService } from '../../services/dataService';
import type { RecycleBinItem, MeasurementFile, MeasurementPoint } from '../../types';

interface RecycleBinDrawerProps {
  open: boolean;
  onClose: () => void;
}

interface RecycleBinGroup {
  fileId: string;
  fileName: string;
  fileExists: boolean;
  deletedFile?: {
    item: RecycleBinItem;
    file: MeasurementFile;
  };
  deletedPoints: Array<{
    item: RecycleBinItem;
    point: MeasurementPoint;
  }>;
}

export function RecycleBinDrawer({ open, onClose }: RecycleBinDrawerProps) {
  const { loadRecycleBin, restoreFromRecycleBin, deleteFromRecycleBin, clearRecycleBin } = useDataStore();
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<RecycleBinGroup[]>([]);
  const [filterType, setFilterType] = useState<'all' | 'file' | 'point'>('all');
  const [searchText, setSearchText] = useState('');

  // 按文件分组
  const groupByFile = useCallback(async (items: RecycleBinItem[]): Promise<RecycleBinGroup[]> => {
    const groupMap = new Map<string, RecycleBinGroup>();

    for (const item of items) {
      if (item.type === 'file') {
        const file = item.data as MeasurementFile;
        groupMap.set(file.id, {
          fileId: file.id,
          fileName: file.name,
          fileExists: false,
          deletedFile: { item, file },
          deletedPoints: [],
        });
      } else {
        const point = item.data as MeasurementPoint;
        const fileId = item.sourceFileId;

        if (!groupMap.has(fileId)) {
          // 查询原文件是否还存在
          const originalFile = await dataService.getFile(fileId);
          
          groupMap.set(fileId, {
            fileId,
            fileName: originalFile?.name || '未知文件',
            fileExists: !!originalFile,
            deletedPoints: [],
          });
        }

        groupMap.get(fileId)!.deletedPoints.push({ item, point });
      }
    }

    return Array.from(groupMap.values()).sort((a, b) => {
      const aTime = a.deletedFile?.item.deletedTime || Math.max(...a.deletedPoints.map(p => p.item.deletedTime));
      const bTime = b.deletedFile?.item.deletedTime || Math.max(...b.deletedPoints.map(p => p.item.deletedTime));
      return bTime - aTime;
    });
  }, []);

  // 加载回收站数据
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const items = await loadRecycleBin();
      const groupedData = await groupByFile(items);
      setGroups(groupedData);
    } catch {
      message.error('加载回收站失败');
    } finally {
      setLoading(false);
    }
  }, [loadRecycleBin, groupByFile]);

  // 恢复选中项
  const handleRestore = async (itemIds: string[]) => {
    if (itemIds.length === 0) {
      message.warning('请选择要恢复的项目');
      return;
    }

    // 检查冲突
    const allItems = groups.flatMap(g => [
      ...(g.deletedFile ? [g.deletedFile.item] : []),
      ...g.deletedPoints.map(p => p.item)
    ]).filter(item => itemIds.includes(item.id));

    const pointsToRestore = allItems.filter(item => item.type === 'point');
    
    if (pointsToRestore.length > 0) {
      // 预检查冲突
      const conflicts = await checkConflicts(pointsToRestore);
      
      if (conflicts.length > 0) {
        // 显示冲突预警
        Modal.confirm({
          title: `准备恢复 ${itemIds.length} 个项目`,
          icon: <ExclamationCircleOutlined />,
          content: (
            <div>
              <p style={{ color: '#faad14', marginBottom: 8 }}>
                ⚠️ 检测到 {conflicts.length} 个点号冲突:
              </p>
              <ul style={{ marginLeft: 20, marginBottom: 8 }}>
                {conflicts.map((c, i) => (
                  <li key={i}>
                    {c.pointNumber} (将重命名为 {c.newPointNumber})
                  </li>
                ))}
              </ul>
              <p>其他 {itemIds.length - conflicts.length} 个项目可以直接恢复</p>
            </div>
          ),
          okText: '继续恢复',
          cancelText: '取消',
          centered: true,
          onOk: async () => {
            await performRestore(itemIds);
          },
        });
      } else {
        await performRestore(itemIds);
      }
    } else {
      await performRestore(itemIds);
    }
  };

  // 检查冲突
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const checkConflicts = async (_pointsToRestore: RecycleBinItem[]): Promise<Array<{ pointNumber: string; newPointNumber: string }>> => {
    const conflicts: Array<{ pointNumber: string; newPointNumber: string }> = [];
    
    // 这里简化处理，实际冲突检查在 restoreFromRecycleBin 中进行
    // 这里只是预估，用于显示警告
    return conflicts;
  };

  // 执行恢复
  const performRestore = async (itemIds: string[]) => {
    setLoading(true);
    try {
      const result = await restoreFromRecycleBin(itemIds);
      
      if (result.conflicts.length > 0) {
        Modal.success({
          title: '恢复完成',
          content: (
            <div>
              <p>成功恢复 {result.success} 个项目</p>
              <p style={{ marginTop: 8 }}>其中 {result.conflicts.length} 个点位因冲突已重命名:</p>
              <ul style={{ marginLeft: 20 }}>
                {result.conflicts.map((c, i) => (
                  <li key={i}>
                    {c.pointNumber} → {c.newPointNumber}
                  </li>
                ))}
              </ul>
              <p style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
                你可以在点位设置中修改点号
              </p>
            </div>
          ),
          centered: true,
        });
      } else {
        message.success(`成功恢复 ${result.success} 个项目`);
      }
      
      await loadData();
    } catch (error) {
      message.error('恢复失败：' + (error instanceof Error ? error.message : '未知错误'));
    } finally {
      setLoading(false);
    }
  };

  // 永久删除
  const handleDelete = async (itemId: string) => {
    Modal.confirm({
      title: '确认永久删除',
      content: '此操作无法恢复，确定要永久删除吗？',
      okText: '确认删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      centered: true,
      onOk: async () => {
        try {
          await deleteFromRecycleBin(itemId);
          message.success('已永久删除');
          await loadData();
        } catch {
          message.error('删除失败');
        }
      },
    });
  };

  // 清空回收站
  const handleClear = () => {
    Modal.confirm({
      title: '确认清空回收站',
      content: '此操作将永久删除回收站中的所有项目，无法恢复。确定要继续吗？',
      okText: '确认清空',
      cancelText: '取消',
      okButtonProps: { danger: true },
      centered: true,
      onOk: async () => {
        try {
          await clearRecycleBin();
          message.success('回收站已清空');
          await loadData();
        } catch {
          message.error('清空失败');
        }
      },
    });
  };

  // 过滤数据
  const filteredGroups = groups.filter(group => {
    // 类型筛选
    if (filterType === 'file' && !group.deletedFile) return false;
    if (filterType === 'point' && group.deletedPoints.length === 0) return false;

    // 搜索筛选
    if (searchText) {
      const searchLower = searchText.toLowerCase();
      const fileNameMatch = group.fileName.toLowerCase().includes(searchLower);
      const pointMatch = group.deletedPoints.some(p => 
        p.point.pointNumber.toLowerCase().includes(searchLower)
      );
      return fileNameMatch || pointMatch;
    }

    return true;
  });

  const totalItems = groups.reduce((sum, g) => 
    sum + (g.deletedFile ? 1 : 0) + g.deletedPoints.length, 0
  );

  // 当抽屉打开时加载数据
  useEffect(() => {
    let mounted = true;
    if (open && mounted) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void loadData();
    }
    return () => {
      mounted = false;
    };
  }, [open, loadData]);

  return (
    <Drawer
      title={
        <Flex justify="space-between" align="center" style={{ width: '100%' }}>
          <span>回收站</span>
          <span style={{ fontSize: 14, fontWeight: 'normal', color: '#666', marginRight: 24 }}>
            {totalItems} / 10,000
          </span>
        </Flex>
      }
      placement="bottom"
      onClose={onClose}
      open={open}
      styles={{ wrapper: { height: '80%' } }}
      extra={
        <Button danger size="small" onClick={handleClear} disabled={totalItems === 0}>
          清空回收站
        </Button>
      }
    >
      <Flex vertical gap={16} style={{ height: '100%' }}>
        {/* 筛选栏 */}
        <Flex gap={8}>
          <Input
            placeholder="搜索文件名或点号"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
          />
          <Select
            value={filterType}
            onChange={setFilterType}
            style={{ width: 120 }}
            options={[
              { label: '全部', value: 'all' },
              { label: '文件', value: 'file' },
              { label: '点位', value: 'point' },
            ]}
          />
        </Flex>

        {/* 列表 */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Spin />
            </div>
          ) : filteredGroups.length === 0 ? (
            <Empty description="回收站为空" />
          ) : (
            <Collapse
              defaultActiveKey={filteredGroups.slice(0, 3).map(g => g.fileId)}
              items={filteredGroups.map(group => ({
                key: group.fileId,
                label: (
                  <Flex justify="space-between" align="center">
                    <span>📄 {group.fileName}</span>
                    <Tag color={group.deletedFile ? 'red' : 'blue'}>
                      {group.deletedFile ? '文件已删除' : `${group.deletedPoints.length} 个点位`}
                    </Tag>
                  </Flex>
                ),
                children: (
                  <Flex vertical gap={8}>
                    {/* 文件本身 */}
                    {group.deletedFile && (
                      <Card size="small">
                        <Flex vertical gap={8}>
                          <div>
                            <strong>文件: {group.deletedFile.file.name}</strong>
                          </div>
                          <div className="text-sm text-gray-600">
                            包含 {group.deletedFile.file.pointCount} 个点位
                          </div>
                          <div className="text-xs text-gray-500">
                            删除时间: {new Date(group.deletedFile.item.deletedTime).toLocaleString('zh-CN')}
                          </div>
                          <Flex gap={8}>
                            <Button
                              size="small"
                              icon={<RollbackOutlined />}
                              onClick={() => handleRestore([group.deletedFile!.item.id])}
                            >
                              恢复文件
                            </Button>
                            <Button
                              size="small"
                              danger
                              icon={<DeleteOutlined />}
                              onClick={() => handleDelete(group.deletedFile!.item.id)}
                            >
                              永久删除
                            </Button>
                          </Flex>
                        </Flex>
                      </Card>
                    )}

                    {/* 点位列表 */}
                    {group.deletedPoints.length > 0 && (
                      <div>
                        <Flex justify="space-between" align="center" style={{ marginBottom: 8 }}>
                          <div className="text-sm text-gray-600">
                            已删除的点位 ({group.deletedPoints.length}个)
                            {!group.fileExists && !group.deletedFile && (
                              <Tag color="red" style={{ marginLeft: 8 }}>原文件已删除</Tag>
                            )}
                          </div>
                          <Flex gap={8}>
                            <Button
                              size="small"
                              icon={<RollbackOutlined />}
                              onClick={() => handleRestore(group.deletedPoints.map(p => p.item.id))}
                              disabled={!group.fileExists && !group.deletedFile}
                              title={!group.fileExists && !group.deletedFile ? '原文件已删除，无法恢复' : ''}
                            >
                              恢复全部
                            </Button>
                            <Button
                              size="small"
                              danger
                              icon={<DeleteOutlined />}
                              onClick={() => {
                                Modal.confirm({
                                  title: '确认删除全部点位',
                                  content: `此操作将永久删除该文件下的 ${group.deletedPoints.length} 个点位，无法恢复。确定要继续吗？`,
                                  okText: '确认删除',
                                  cancelText: '取消',
                                  okButtonProps: { danger: true },
                                  centered: true,
                                  onOk: async () => {
                                    setLoading(true);
                                    try {
                                      for (const { item } of group.deletedPoints) {
                                        await deleteFromRecycleBin(item.id);
                                      }
                                      message.success('已永久删除所有点位');
                                      await loadData();
                                    } catch {
                                      message.error('删除失败');
                                    } finally {
                                      setLoading(false);
                                    }
                                  },
                                });
                              }}
                            >
                              删除全部
                            </Button>
                          </Flex>
                        </Flex>
                        {group.deletedPoints.map(({ item, point }) => (
                          <Card key={item.id} size="small" style={{ marginBottom: 8 }}>
                            <Flex vertical gap={4}>
                              <div>
                                <strong>点号: {point.pointNumber}</strong>
                                <Tag color={point.type === 'control' ? 'blue' : 'green'} style={{ marginLeft: 8 }}>
                                  {point.type === 'control' ? '控制点' : '碎部点'}
                                </Tag>
                              </div>
                              <div className="text-sm text-gray-600">
                                坐标: {point.x.toFixed(3)}, {point.y.toFixed(3)}, {point.z.toFixed(3)}
                              </div>
                              {!group.fileExists && !group.deletedFile && (
                                <div className="text-xs" style={{ color: '#ff4d4f' }}>
                                  ⚠️ 原文件已删除，无法恢复
                                </div>
                              )}
                              <div className="text-xs text-gray-500">
                                删除时间: {new Date(item.deletedTime).toLocaleString('zh-CN')}
                              </div>
                              <Flex gap={8}>
                                <Button
                                  size="small"
                                  icon={<RollbackOutlined />}
                                  onClick={() => handleRestore([item.id])}
                                  disabled={!group.fileExists && !group.deletedFile}
                                  title={!group.fileExists && !group.deletedFile ? '原文件已删除，无法恢复' : ''}
                                >
                                  恢复
                                </Button>
                                <Button
                                  size="small"
                                  danger
                                  icon={<DeleteOutlined />}
                                  onClick={() => handleDelete(item.id)}
                                >
                                  删除
                                </Button>
                              </Flex>
                            </Flex>
                          </Card>
                        ))}
                      </div>
                    )}
                  </Flex>
                ),
              }))}
            />
          )}
        </div>
      </Flex>
    </Drawer>
  );
}
