import { useState, useEffect, useMemo } from 'react';
import { Modal, Form, Input, InputNumber, App } from 'antd';
import { v4 as uuidv4 } from 'uuid';
import { useDataStore, useMapStore } from '../../store';
import { validatePointNumber } from '../../utils/pointValidation';
import { convertCoordinatesForFile } from '../../utils/coordinateUtils';
import { useNextPointNumber } from '../../hooks/useNextPointNumber';
import { isValidPointNumber } from '../../utils/sanitize';
import type { MeasurementPoint } from '../../types';

interface AddPointModalProps {
  open: boolean;
  onClose: () => void;
}

export function AddPointModal({ open, onClose }: AddPointModalProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  
  const currentFileId = useMapStore((state) => state.currentFileId);
  const userLocation = useMapStore((state) => state.userLocation);
  const userLocationAccuracy = useMapStore((state) => state.userLocationAccuracy);
  const setView = useMapStore((state) => state.setView);
  const setSelectedPointId = useMapStore((state) => state.setSelectedPointId);
  
  const points = useDataStore((state) => state.points);
  const files = useDataStore((state) => state.files);
  const addPoint = useDataStore((state) => state.addPoint);
  const recalculateFileStats = useDataStore((state) => state.recalculateFileStats);

  // 缓存当前文件
  const currentFile = useMemo(
    () => files.find(f => f.id === currentFileId),
    [files, currentFileId]
  );

  // 使用 Hook 生成下一个点位号
  const nextPointNumber = useNextPointNumber(currentFileId);

  // 当 Modal 打开时初始化表单
  useEffect(() => {
    if (open && currentFileId) {
      form.setFieldsValue({
        pointNumber: nextPointNumber,
        lat: userLocation?.lat,
        lng: userLocation?.lng,
        z: 0,
      });
    }
  }, [open, currentFileId, userLocation, form, nextPointNumber]);

  // 处理添加
  const handleAdd = async () => {
    if (!currentFileId) {
      message.warning('请先打开文件');
      return;
    }

    try {
      const values = await form.validateFields();
      setLoading(true);

      const currentPoints = points.get(currentFileId) || [];
      
      if (!currentFile) {
        message.error('文件不存在');
        setLoading(false);
        return;
      }

      // 验证点号格式
      if (!isValidPointNumber(values.pointNumber)) {
        message.error('点号格式不正确，只允许字母、数字、中文、下划线和连字符');
        setLoading(false);
        return;
      }

      // 检查点位号是否重复
      const validation = validatePointNumber(values.pointNumber, currentPoints);
      if (!validation.valid) {
        message.error(validation.error);
        setLoading(false);
        return;
      }

      // 判断用户是否修改了经纬度
      const isUsingCurrentLocation = 
        userLocation &&
        values.lat === userLocation.lat && 
        values.lng === userLocation.lng;

      // 将经纬度转换为投影坐标（使用文件的投影配置）
      const projected = convertCoordinatesForFile(values.lat, values.lng, currentFile);

      // 创建新点位
      const maxOrder = currentPoints.length > 0 
        ? Math.max(...currentPoints.map(p => p.order))
        : -1;

      const newPoint: MeasurementPoint = {
        id: uuidv4(),
        fileId: currentFileId,
        pointNumber: values.pointNumber,
        originalPointNumber: values.pointNumber,
        x: projected.x,
        y: projected.y,
        z: values.z,
        lat: values.lat,
        lng: values.lng,
        type: 'survey',
        order: maxOrder + 1,
        isManuallyAdded: true,
        qualityParams: isUsingCurrentLocation && userLocationAccuracy
          ? {
              hrms: userLocationAccuracy,
              vrms: undefined,
            }
          : undefined,
      };

      // 添加点位
      await addPoint(currentFileId, newPoint);

      // 重新计算文件统计
      await recalculateFileStats(currentFileId);

      message.success(`已添加点位 ${values.pointNumber}`);
      
      // 定位到新点位
      setView({ lat: values.lat, lng: values.lng }, 19);
      setSelectedPointId(newPoint.id);
      
      // 关闭 Modal
      form.resetFields();
      onClose();
    } catch (error) {
      console.error('添加点位失败:', error);
      message.error('添加点位失败');
    } finally {
      setLoading(false);
    }
  };

  // 处理取消
  const handleCancel = () => {
    form.resetFields();
    onClose();
  };

  return (
    <Modal
      title="添加碎部点"
      open={open}
      onOk={handleAdd}
      onCancel={handleCancel}
      okText="添加"
      cancelText="取消"
      confirmLoading={loading}
      centered
    >
      <Form
        form={form}
        layout="vertical"
        style={{ marginTop: 16 }}
      >
        <Form.Item
          label="点位号"
          name="pointNumber"
          rules={[{ required: true, message: '请输入点位号' }]}
        >
          <Input placeholder="请输入点位号" />
        </Form.Item>

        <Form.Item
          label="纬度"
          name="lat"
          rules={[
            { required: true, message: '请输入纬度' },
            { type: 'number', min: -90, max: 90, message: '纬度范围：-90 到 90' }
          ]}
        >
          <InputNumber
            style={{ width: '100%' }}
            placeholder="请输入纬度"
            precision={6}
          />
        </Form.Item>

        <Form.Item
          label="经度"
          name="lng"
          rules={[
            { required: true, message: '请输入经度' },
            { type: 'number', min: -180, max: 180, message: '经度范围：-180 到 180' }
          ]}
        >
          <InputNumber
            style={{ width: '100%' }}
            placeholder="请输入经度"
            precision={6}
          />
        </Form.Item>

        <Form.Item
          label="高程 (m)"
          name="z"
          rules={[{ required: true, message: '请输入高程' }]}
        >
          <InputNumber
            style={{ width: '100%' }}
            placeholder="请输入高程"
            precision={3}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
