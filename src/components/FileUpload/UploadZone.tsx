import { useState, useCallback } from 'react';
import { Upload, App } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import JSZip from 'jszip';
import { fileParser, createMeasurementFile } from '../../services/fileParser';
import type { ParseWarning, ParseError } from '../../services/fileParser';
import { coordinateConverter } from '../../services/coordinateConverter';
import { useDataStore, useMapStore, useSettingsStore } from '../../store';
import { ProjectionConfigModal } from './ProjectionConfigModal';
import { ZipBatchImportModal } from './ZipBatchImportModal';
import type { ProjectionConfig } from '../../types';
import { useFileNameValidation } from '../../hooks/useFileNameValidation';
import { useFileSwitch } from '../../hooks/useFileSwitch';
import { isValidFileSize, isValidFileType } from '../../utils/sanitize';

const { Dragger } = Upload;

interface UploadZoneProps {
  onFileUploaded?: () => void; // 文件上传成功后的回调
}

export function UploadZone({ onFileUploaded }: UploadZoneProps) {
  const { message, modal } = App.useApp();
  const [uploading, setUploading] = useState(false);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [zipModalOpen, setZipModalOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [zipFiles, setZipFiles] = useState<Array<{ name: string; content: string; size: number }>>([]);
  const addFile = useDataStore((state) => state.addFile);
  const loadFiles = useDataStore((state) => state.loadFiles);
  const currentFileId = useMapStore((state) => state.currentFileId);
  
  // 使用文件名验证 Hook
  const { validateFileName } = useFileNameValidation();
  
  // 使用文件切换 Hook
  const { switchToFile } = useFileSwitch();
  
  const maxPointsPerFile = useSettingsStore((state) => state.maxPointsPerFile);

  // 显示解析结果（错误和警告）
  const showParseResultModal = useCallback((errors: ParseError[], warnings: ParseWarning[]) => {
    const hasErrors = errors.length > 0;
    const hasWarnings = warnings.length > 0;
    
    if (!hasErrors && !hasWarnings) return;
    
    modal.info({
      title: '文件解析结果',
      icon: null,
      width: 600,
      centered: true,
      content: (
        <div style={{ maxHeight: 400, overflow: 'auto' }}>
          {/* 错误部分 */}
          {hasErrors && (
            <div style={{ marginBottom: hasWarnings ? 16 : 0 }}>
              <div style={{ fontWeight: 'bold', color: '#ff4d4f', marginBottom: 8, fontSize: 14 }}>
                错误 ({errors.length} 个) - 以下行已跳过
              </div>
              {errors.map((error, index) => (
                <div key={`error-${index}`} style={{ marginBottom: 12, padding: 8, background: '#fff2f0', borderRadius: 4, borderLeft: '3px solid #ff4d4f' }}>
                  <div style={{ fontWeight: 500, color: '#ff4d4f' }}>
                    第 {error.line} 行
                  </div>
                  <div style={{ marginTop: 4, fontSize: 13, color: '#595959' }}>
                    {error.message}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 12, color: '#8c8c8c', fontFamily: 'monospace', background: '#fafafa', padding: 4, borderRadius: 2 }}>
                    {error.content}
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* 警告部分 */}
          {hasWarnings && (
            <div>
              <div style={{ fontWeight: 'bold', color: '#fa8c16', marginBottom: 8, fontSize: 14 }}>
                警告 ({warnings.length} 个) - 已自动处理
              </div>
              {warnings.map((warning, index) => (
                <div key={`warning-${index}`} style={{ marginBottom: 12, padding: 8, background: '#fff7e6', borderRadius: 4, borderLeft: '3px solid #fa8c16' }}>
                  <div style={{ fontWeight: 500, color: '#fa8c16' }}>
                    第 {warning.line} 行
                  </div>
                  <div style={{ marginTop: 4, fontSize: 13 }}>
                    {warning.message}
                  </div>
                  {warning.content && (
                    <div style={{ marginTop: 4, fontSize: 12, color: '#8c8c8c', fontFamily: 'monospace', background: '#fafafa', padding: 4, borderRadius: 2 }}>
                      {warning.content}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ),
      okText: '知道了',
    });
  }, [modal]);

  // 处理文件导入（在用户确认配置后）
  const handleFileImport = async (file: File, config: ProjectionConfig, customFileName?: string) => {
    setUploading(true);
    setConfigModalOpen(false);

    try {
      // 解析文件
      const parseResult = await fileParser.parse(file, '');

      // 检查是否有编码问题（Unicode 替换字符）
      const hasEncodingIssues = parseResult.warnings.some(w => 
        w.content && w.content.includes('�')
      ) || parseResult.errors.some(e => 
        e.content && e.content.includes('�')
      );

      // 如果有错误或警告，显示统一的解析结果
      if (parseResult.errors.length > 0 || parseResult.warnings.length > 0) {
        console.warn('文件解析问题:', {
          errors: parseResult.errors,
          warnings: parseResult.warnings
        });
        
        // 如果有编码问题，额外提示
        if (hasEncodingIssues) {
          message.warning({
            content: '检测到文件编码问题，建议使用 UTF-8 编码保存文件以避免乱码',
            duration: 3,
          });
        }
        
        // 显示统一的解析结果模态框
        const hasErrors = parseResult.errors.length > 0;
        const hasWarnings = parseResult.warnings.length > 0;
        
        let summaryText = '文件解析完成';
        if (hasErrors && hasWarnings) {
          summaryText += `，有 ${parseResult.errors.length} 个错误和 ${parseResult.warnings.length} 个警告`;
        } else if (hasErrors) {
          summaryText += `，有 ${parseResult.errors.length} 个错误`;
        } else {
          summaryText += `，有 ${parseResult.warnings.length} 个警告`;
        }
        
        message.info({
          content: `${summaryText}（点击查看详情）`,
          duration: 5,
          onClick: () => showParseResultModal(parseResult.errors, parseResult.warnings),
          style: { cursor: 'pointer' },
        });
      }

      if (parseResult.points.length === 0) {
        message.error('文件中没有有效的碎部点数据');
        return;
      }

      // 检查点位数量是否超过限制
      if (parseResult.points.length > maxPointsPerFile) {
        message.error(`文件点位数量（${parseResult.points.length}）超过限制（${maxPointsPerFile}）`);
        return;
      }

      // 使用自定义文件名或原文件名，并验证清理
      const originalFileName = customFileName || file.name;
      const finalFileName = validateFileName(originalFileName);
      if (!finalFileName) return;

      // 创建文件对象（使用用户配置的投影参数）
      const measurementFile = createMeasurementFile(
        finalFileName,
        parseResult,
        config.coordinateSystem,
        config // 传入投影配置
      );

      // 转换坐标（使用文件的投影配置）
      const pointsWithLatLng = parseResult.points.map((point) => {
        const { lat, lng } = coordinateConverter.projectToWGS84(
          point.x,
          point.y,
          config.coordinateSystem,
          config.projectionType,
          config.centralMeridian
        );

        return {
          ...point,
          fileId: measurementFile.id,
          lat,
          lng,
        };
      });

      // 保存到数据库
      await addFile(measurementFile, pointsWithLatLng);
      
      // 重新加载文件列表
      await loadFiles();

      message.success(`文件上传成功！共 ${pointsWithLatLng.length} 个碎部点`);

      // 切换到新文件（如果已有打开的文件则显示确认对话框）
      switchToFile(measurementFile.id, {
        confirm: !!currentFileId,
        confirmContent: currentFileId 
          ? `当前已打开文件「${useDataStore.getState().files.find(f => f.id === currentFileId)?.name || '未知文件'}」，是否切换到「${measurementFile.name}」？`
          : undefined,
        okText: '切换到新文件',
        cancelText: '保持当前文件',
        onConfirm: () => onFileUploaded?.()
      });
    } catch (error) {
      console.error('文件上传失败:', error);
      message.error(
        `文件上传失败：${error instanceof Error ? error.message : '未知错误'}`
      );
    } finally {
      setUploading(false);
      setPendingFile(null);
    }
  };

  // 处理 ZIP 文件
  const handleZipFile = async (file: File) => {
    const hide = message.loading('正在解压文件...', 0);
    
    try {
      const zip = new JSZip();
      const zipContent = await zip.loadAsync(file);
      
      // 提取所有 .dat 文件并解析获取点数
      const datFiles: Array<{ name: string; content: string; size: number; pointCount?: number }> = [];
      
      for (const [fileName, zipEntry] of Object.entries(zipContent.files)) {
        if (!zipEntry.dir && fileName.toLowerCase().endsWith('.dat')) {
          const content = await zipEntry.async('text');
          const name = fileName.split('/').pop() || fileName; // 只保留文件名，去掉路径
          
          // 尝试解析文件获取点数
          let pointCount: number | undefined;
          try {
            const blob = new Blob([content], { type: 'text/plain' });
            const tempFile = new File([blob], name, { type: 'text/plain' });
            const parseResult = await fileParser.parse(tempFile, '');
            pointCount = parseResult.points.length;
          } catch {
            // 解析失败，不显示点数
            pointCount = undefined;
          }
          
          datFiles.push({
            name,
            content,
            size: content.length,
            pointCount,
          });
        }
      }
      
      hide();
      
      if (datFiles.length === 0) {
        message.warning('压缩包中没有找到 .dat 文件');
        return;
      }
      
      // 如果只有一个文件，直接导入
      if (datFiles.length === 1) {
        const datFile = datFiles[0];
        const blob = new Blob([datFile.content], { type: 'text/plain' });
        const singleFile = new File([blob], datFile.name, { type: 'text/plain' });
        setPendingFile(singleFile);
        setConfigModalOpen(true);
        return;
      }
      
      // 多个文件，显示批量导入对话框
      setZipFiles(datFiles);
      setZipModalOpen(true);
      
    } catch (error) {
      hide();
      console.error('解压失败:', error);
      message.error('无法解压文件，压缩包可能已损坏');
    }
  };

  // 批量导入 ZIP 中的文件
  const handleZipImport = async (selectedFileNames: string[], config: ProjectionConfig) => {
    setZipModalOpen(false);
    setUploading(true);
    
    const hide = message.loading(`正在导入 ${selectedFileNames.length} 个文件...`, 0);
    
    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];
    
    try {
      for (const fileName of selectedFileNames) {
        const zipFile = zipFiles.find(f => f.name === fileName);
        if (!zipFile) continue;
        
        try {
          // 创建 File 对象
          const blob = new Blob([zipFile.content], { type: 'text/plain' });
          const file = new File([blob], zipFile.name, { type: 'text/plain' });
          
          // 解析文件
          const parseResult = await fileParser.parse(file, '');
          
          if (parseResult.points.length === 0) {
            errors.push(`${fileName}: 没有有效数据`);
            failCount++;
            continue;
          }
          
          if (parseResult.points.length > maxPointsPerFile) {
            errors.push(`${fileName}: 点位数量超过限制`);
            failCount++;
            continue;
          }
          
          // 使用用户选择的配置
          const measurementFile = createMeasurementFile(
            zipFile.name,
            parseResult,
            config.coordinateSystem,
            config
          );
          
          // 转换坐标
          const pointsWithLatLng = parseResult.points.map((point) => {
            const { lat, lng } = coordinateConverter.projectToWGS84(
              point.x,
              point.y,
              config.coordinateSystem,
              config.projectionType,
              config.centralMeridian
            );
            
            return {
              ...point,
              fileId: measurementFile.id,
              lat,
              lng,
            };
          });
          
          // 保存到数据库
          await addFile(measurementFile, pointsWithLatLng);
          successCount++;
          
        } catch (error) {
          console.error(`导入 ${fileName} 失败:`, error);
          errors.push(`${fileName}: ${error instanceof Error ? error.message : '未知错误'}`);
          failCount++;
        }
      }
      
      hide();
      
      // 显示结果
      if (failCount === 0) {
        message.success(`成功导入 ${successCount} 个文件`);
      } else {
        modal.warning({
          title: '导入完成',
          content: (
            <div>
              <p>成功: {successCount} 个</p>
              <p>失败: {failCount} 个</p>
              {errors.length > 0 && (
                <div style={{ marginTop: 12, maxHeight: 200, overflow: 'auto' }}>
                  {errors.map((err, i) => (
                    <div key={i} style={{ fontSize: 12, color: '#ff4d4f', marginBottom: 4 }}>
                      {err}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ),
          centered: true,
        });
      }
      
      // 通知父组件
      if (successCount > 0) {
        onFileUploaded?.();
      }
      
    } catch (error) {
      hide();
      console.error('批量导入失败:', error);
      message.error('批量导入失败');
    } finally {
      setUploading(false);
      setZipFiles([]);
    }
  };

  const uploadProps: UploadProps = {
    name: 'file',
    multiple: false,
    accept: '.dat,.zip,application/octet-stream,application/zip,text/plain',
    beforeUpload: async (file) => {
      // ZIP 文件处理
      if (file.name.toLowerCase().endsWith('.zip')) {
        if (!isValidFileSize(file.size, 50)) {
          message.error('文件大小不能超过 50MB');
          return Upload.LIST_IGNORE;
        }
        
        await handleZipFile(file);
        return Upload.LIST_IGNORE;
      }
      
      // DAT 文件处理（原有逻辑）
      if (!isValidFileType(file.name, ['dat'])) {
        message.error('只支持 .dat 和 .zip 格式文件');
        return Upload.LIST_IGNORE;
      }

      // 文件大小验证（50MB）
      if (!isValidFileSize(file.size, 50)) {
        message.error('文件大小不能超过 50MB');
        return Upload.LIST_IGNORE;
      }

      // 保存文件并打开配置对话框
      setPendingFile(file);
      setConfigModalOpen(true);

      return Upload.LIST_IGNORE;
    },
  };

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', width: '100%', marginBottom: '24px' }}>
      <div className="upload-zone-wrapper">
        <Dragger {...uploadProps} disabled={uploading || configModalOpen || zipModalOpen}>
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
          <p className="ant-upload-hint">支持 .dat 文件或 .zip 压缩包，最大 50MB</p>
        </Dragger>
      </div>

      {pendingFile && (
        <ProjectionConfigModal
          open={configModalOpen}
          fileName={pendingFile.name}
          onConfirm={(config, customFileName) => handleFileImport(pendingFile, config, customFileName)}
          onCancel={() => {
            setConfigModalOpen(false);
            setPendingFile(null);
          }}
        />
      )}
      
      <ZipBatchImportModal
        key={zipModalOpen ? 'open' : 'closed'}
        open={zipModalOpen}
        files={zipFiles}
        onConfirm={handleZipImport}
        onCancel={() => {
          setZipModalOpen(false);
          setZipFiles([]);
        }}
      />
    </div>
  );
}
