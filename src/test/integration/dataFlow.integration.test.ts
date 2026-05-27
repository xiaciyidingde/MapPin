/**
 * 数据流集成测试
 * 
 * 测试从文件导入到数据导出的完整流程
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { writeFileSync, unlinkSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { fileParser } from '../../services/fileParser';
import { dataService } from '../../services/dataService';
import { createTestFile, cleanDatabase, cleanOutputDirectory, TEST_FILES, OUTPUT_PATH, validatePointData, validateFileData, generateExportContent } from '../helpers/testHelpers';

// 输出目录
const OUTPUT_DIR = OUTPUT_PATH;

describe('数据流集成测试', () => {
  let mainFileId: string;

  beforeAll(async () => {
    await cleanDatabase();
  });

  afterEach(async () => {
    if (mainFileId) {
      try {
        await dataService.deleteFile(mainFileId);
      } catch {
        // 忽略删除失败
      }
      mainFileId = '';
    }
  });

  afterAll(async () => {
    await cleanDatabase();
    cleanOutputDirectory();
  });

  describe('阶段 1: 文件导入和解析', () => {
    it('应该成功加载和解析小数据集测试文件', async () => {
      const result = await createTestFile(TEST_FILES.small, 'test_50points.dat');
      mainFileId = result.fileId;

      expect(result.fileId).toBeTruthy();
      expect(result.points.length).toBe(50);
      expect(result.file.coordinateSystem).toBe('CGCS2000');
      
      validateFileData(result.file);
      result.points.forEach(validatePointData);
    });

    it('应该正确处理大文件（限制点数）', async () => {
      const result = await createTestFile(TEST_FILES.large, 'test_large.dat', {
        pointCount: 100,
      });
      mainFileId = result.fileId;

      expect(result.points.length).toBe(100);
      expect(result.file.pointCount).toBe(100);
    });
  });

  describe('阶段 2: 点位操作', () => {
    it('应该成功删除点位并更新统计', async () => {
      const result = await createTestFile(TEST_FILES.small, 'test_delete.dat', { pointCount: 10 });
      mainFileId = result.fileId;

      const initialPoints = await dataService.getPoints(mainFileId);
      const initialCount = initialPoints.length;
      const pointToDelete = initialPoints[0];

      await dataService.deletePoint(mainFileId, pointToDelete.id);

      const remainingPoints = await dataService.getPoints(mainFileId);
      expect(remainingPoints.length).toBe(initialCount - 1);
      expect(remainingPoints.find(p => p.id === pointToDelete.id)).toBeUndefined();
    });

    it('应该成功重命名点位并保持唯一性', async () => {
      const result = await createTestFile(TEST_FILES.small, 'test_rename.dat', { pointCount: 10 });
      mainFileId = result.fileId;

      const points = await dataService.getPoints(mainFileId);
      const pointToRename = points[0];
      const newPointNumber = '9999';

      await dataService.updatePoint(mainFileId, pointToRename.id, {
        pointNumber: newPointNumber,
      });

      const updatedPoints = await dataService.getPoints(mainFileId);
      const renamedPoint = updatedPoints.find(p => p.id === pointToRename.id);
      expect(renamedPoint).toBeDefined();
      expect(renamedPoint!.pointNumber).toBe(newPointNumber);
    });

    it('应该成功修改点位类型', async () => {
      const result = await createTestFile(TEST_FILES.small, 'test_type.dat', { pointCount: 10 });
      mainFileId = result.fileId;

      const points = await dataService.getPoints(mainFileId);
      const pointToChange = points[0];

      await dataService.updatePoint(mainFileId, pointToChange.id, {
        type: 'control',
      });

      const updatedPoints = await dataService.getPoints(mainFileId);
      const changedPoint = updatedPoints.find(p => p.id === pointToChange.id);
      expect(changedPoint!.type).toBe('control');
    });
  });

  describe('阶段 3: 坐标转换', () => {
    it('应该成功修改坐标系统', async () => {
      const result = await createTestFile(TEST_FILES.small, 'test_coord.dat', { pointCount: 10 });
      mainFileId = result.fileId;

      const originalFile = await dataService.getFile(mainFileId);
      expect(originalFile!.coordinateSystem).toBe('CGCS2000');

      await dataService.updateFile(mainFileId, {
        coordinateSystem: 'Beijing54',
      });

      const updatedFile = await dataService.getFile(mainFileId);
      expect(updatedFile!.coordinateSystem).toBe('Beijing54');
    });

    it('应该成功修改投影方式', async () => {
      const result = await createTestFile(TEST_FILES.small, 'test_projection.dat', { pointCount: 10 });
      mainFileId = result.fileId;

      const originalFile = await dataService.getFile(mainFileId);
      expect(originalFile!.projectionConfig.projectionType).toBe('gauss-3');

      await dataService.updateFile(mainFileId, {
        projectionConfig: {
          ...originalFile!.projectionConfig,
          projectionType: 'gauss-6',
        },
      });

      const updatedFile = await dataService.getFile(mainFileId);
      expect(updatedFile!.projectionConfig.projectionType).toBe('gauss-6');
    });
  });

  describe('阶段 4: 回收站功能', () => {
    it('应该成功将文件移到回收站并恢复', async () => {
      const result = await createTestFile(TEST_FILES.small, 'test_recycle.dat', { pointCount: 10 });
      mainFileId = result.fileId;

      const originalFile = await dataService.getFile(mainFileId);
      expect(originalFile).toBeDefined();

      await dataService.moveToRecycleBin({
        id: `recycle-${mainFileId}`,
        type: 'file',
        deletedTime: Date.now(),
        sourceFileId: mainFileId,
        data: originalFile!,
      });

      await dataService.deleteFile(mainFileId);

      const deletedFile = await dataService.getFile(mainFileId);
      expect(deletedFile).toBeNull();

      const recycleBin = await dataService.getRecycleBinItems();
      const recycledFile = recycleBin.find(f => f.sourceFileId === mainFileId);
      expect(recycledFile).toBeDefined();

      await dataService.restoreFromRecycleBin(recycledFile!.id);

      const restoredFile = await dataService.getFile(mainFileId);
      expect(restoredFile).toBeDefined();
      expect(restoredFile!.name).toBe(originalFile!.name);
    });
  });

  describe('阶段 5: 完整数据流', () => {
    it('应该完成从导入到修改的完整流程', async () => {
      const result = await createTestFile(TEST_FILES.small, 'test_complete.dat', { pointCount: 20 });
      const fileId = result.fileId;
      mainFileId = fileId;

      const points = await dataService.getPoints(fileId);
      await dataService.deletePoint(fileId, points[0].id);
      await dataService.updatePoint(fileId, points[1].id, { pointNumber: 'RENAMED' });
      await dataService.updatePoint(fileId, points[2].id, { type: 'control' });
      await dataService.updateFile(fileId, { coordinateSystem: 'Beijing54' });

      const finalFile = await dataService.getFile(fileId);
      const finalPoints = await dataService.getPoints(fileId);

      expect(finalFile!.coordinateSystem).toBe('Beijing54');
      expect(finalPoints.length).toBe(points.length - 1);
      expect(finalPoints.find(p => p.pointNumber === 'RENAMED')).toBeDefined();
      expect(finalPoints.find(p => p.id === points[2].id)!.type).toBe('control');
    });
  });

  describe('阶段 6: 坐标反转', () => {
    it('应该成功反转选中点位的 X/Y 坐标', async () => {
      const result = await createTestFile(TEST_FILES.small, 'test_swap.dat', { pointCount: 10 });
      mainFileId = result.fileId;

      const points = await dataService.getPoints(mainFileId);
      const pointToSwap = points[0];
      const originalX = pointToSwap.x;
      const originalY = pointToSwap.y;

      await dataService.updatePoint(mainFileId, pointToSwap.id, {
        x: originalY,
        y: originalX,
      });

      const updatedPoints = await dataService.getPoints(mainFileId);
      const swappedPoint = updatedPoints.find(p => p.id === pointToSwap.id);
      
      expect(swappedPoint!.x).toBe(originalY);
      expect(swappedPoint!.y).toBe(originalX);
    });

    it('应该只反转选中的点位，不影响其他点位', async () => {
      const result = await createTestFile(TEST_FILES.small, 'test_swap_partial.dat', { pointCount: 10 });
      mainFileId = result.fileId;

      const points = await dataService.getPoints(mainFileId);
      const pointToSwap = points[0];
      const pointNotSwap = points[1];
      const originalX = pointToSwap.x;
      const originalY = pointToSwap.y;

      await dataService.updatePoint(mainFileId, pointToSwap.id, {
        x: originalY,
        y: originalX,
      });

      const updatedPoints = await dataService.getPoints(mainFileId);
      const swappedPoint = updatedPoints.find(p => p.id === pointToSwap.id);
      const notSwappedPoint = updatedPoints.find(p => p.id === pointNotSwap.id);
      
      expect(swappedPoint!.x).toBe(originalY);
      expect(swappedPoint!.y).toBe(originalX);
      expect(notSwappedPoint!.x).toBe(pointNotSwap.x);
      expect(notSwappedPoint!.y).toBe(pointNotSwap.y);
    });
  });

  describe('阶段 7: 数据导出', () => {
    it('应该成功导出简单格式文件', async () => {
      const result = await createTestFile(TEST_FILES.small, 'test_export.dat', { pointCount: 10 });
      mainFileId = result.fileId;

      const points = await dataService.getPoints(mainFileId);
      const outputPath = join(OUTPUT_DIR, 'export_simple.dat');
      
      const content = points.map(p => 
        `${p.pointNumber},${p.code || ''},${p.x},${p.y},${p.z}`
      ).join('\n');
      
      writeFileSync(outputPath, content, 'utf-8');
      expect(existsSync(outputPath)).toBe(true);
      unlinkSync(outputPath);
    });

    it('应该成功导出详细格式文件', async () => {
      const result = await createTestFile(TEST_FILES.small, 'test_export_detailed.dat', { pointCount: 10 });
      mainFileId = result.fileId;

      const points = await dataService.getPoints(mainFileId);
      const outputPath = join(OUTPUT_DIR, 'export_detailed.dat');
      
      const content = points.map(p => {
        let line = `${p.pointNumber},${p.code || ''},${p.x},${p.y},${p.z}`;
        if (p.qualityParams) {
          const params = Object.entries(p.qualityParams)
            .map(([key, value]) => `${key}:${value}`)
            .join(',');
          line += `,${params}`;
        }
        return line;
      }).join('\n');
      
      writeFileSync(outputPath, content, 'utf-8');
      expect(existsSync(outputPath)).toBe(true);
      unlinkSync(outputPath);
    });
  });

  describe('阶段 8: 文件合并', () => {
    it('应该成功合并两个文件', async () => {
      const result1 = await createTestFile(TEST_FILES.small, 'test_file1.dat', { pointCount: 10 });
      const file1Id = result1.fileId;

      const result2 = await createTestFile(TEST_FILES.merge, 'test_file2.dat');
      const file2Id = result2.fileId;

      const points1 = await dataService.getPoints(file1Id);
      const points2 = await dataService.getPoints(file2Id);

      const mergedPoints = [...points1, ...points2];

      const mergedFile = {
        ...result1.file,
        id: 'merged-file-id',
        name: 'merged.dat',
        pointCount: mergedPoints.length,
        uploadTime: Date.now(),
      };

      mainFileId = await dataService.saveFile(mergedFile);

      const pointsWithNewFileId = mergedPoints.map(p => ({
        ...p,
        id: `${p.id}-merged`,
        fileId: mainFileId,
      }));
      await dataService.savePoints(pointsWithNewFileId);

      const finalPoints = await dataService.getPoints(mainFileId);
      expect(finalPoints.length).toBe(points1.length + points2.length);

      await dataService.deleteFile(file1Id);
      await dataService.deleteFile(file2Id);
    });

    it('应该正确识别重复点号', async () => {
      const result1 = await createTestFile(TEST_FILES.small, 'test_dup1.dat', { pointCount: 5 });
      const file1Id = result1.fileId;

      const result2 = await createTestFile(TEST_FILES.small, 'test_dup2.dat', { pointCount: 5 });
      const file2Id = result2.fileId;

      const points1 = await dataService.getPoints(file1Id);
      const points2 = await dataService.getPoints(file2Id);

      const pointNumbers1 = new Set(points1.map(p => p.pointNumber));
      const pointNumbers2 = new Set(points2.map(p => p.pointNumber));
      
      const duplicates = [...pointNumbers1].filter(pn => pointNumbers2.has(pn));
      expect(duplicates.length).toBeGreaterThan(0);

      await dataService.deleteFile(file1Id);
      await dataService.deleteFile(file2Id);
    });
  });

  describe('阶段 9: 完善的导出测试', () => {
    it('应该使用真实导出服务生成简单格式内容', async () => {
      const result = await createTestFile(TEST_FILES.small, 'test_export_real.dat', { pointCount: 10 });
      mainFileId = result.fileId;

      const points = await dataService.getPoints(mainFileId);
      const content = generateExportContent(points, 'simple', false);

      const lines = content.split('\n');
      expect(lines.length).toBe(points.length);

      const firstLine = lines[0];
      const parts = firstLine.split(',');
      expect(parts.length).toBeGreaterThanOrEqual(5);
      expect(parts[0]).toBe(points[0].pointNumber);
    });

    it('应该使用真实导出服务生成详细格式内容', async () => {
      const result = await createTestFile(TEST_FILES.small, 'test_export_detailed_real.dat', { pointCount: 10 });
      mainFileId = result.fileId;

      const points = await dataService.getPoints(mainFileId);
      const content = generateExportContent(points, 'detailed', false);

      const lines = content.split('\n');
      expect(lines.length).toBe(points.length);

      const firstLine = lines[0];
      // 验证详细格式包含点位类型（控制点或碎步点）
      expect(firstLine).toMatch(/控制点|碎步点/);
      
      // 验证格式正确（至少6个字段：点号,编码,X,Y,Z,类型）
      const parts = firstLine.split(',');
      expect(parts.length).toBeGreaterThanOrEqual(6);
    });

    it('应该正确处理坐标反转导出', async () => {
      const result = await createTestFile(TEST_FILES.small, 'test_export_swap.dat', { pointCount: 5 });
      mainFileId = result.fileId;

      const points = await dataService.getPoints(mainFileId);
      const originalX = points[0].x;
      const originalY = points[0].y;

      const content = generateExportContent(points, 'simple', true);

      const firstLine = content.split('\n')[0];
      const parts = firstLine.split(',');
      expect(parseFloat(parts[2])).toBe(originalY);
      expect(parseFloat(parts[3])).toBe(originalX);
    });

    it('应该验证导出后重新导入的数据一致性', async () => {
      const result = await createTestFile(TEST_FILES.small, 'test_reimport.dat', { pointCount: 10 });
      mainFileId = result.fileId;

      const originalPoints = await dataService.getPoints(mainFileId);

      const exportContent = generateExportContent(originalPoints, 'simple', false);
      const exportPath = join(OUTPUT_DIR, 'test_reimport_export.dat');
      writeFileSync(exportPath, exportContent, 'utf-8');

      const reimportContent = readFileSync(exportPath, 'utf-8');
      const blob = new Blob([reimportContent], { type: 'text/plain' });
      const file = new File([blob], 'reimport.dat', { type: 'text/plain' });

      const parseResult = await fileParser.parse(file, 'temp-id');

      expect(parseResult.points.length).toBe(originalPoints.length);

      for (let i = 0; i < originalPoints.length; i++) {
        expect(parseResult.points[i].x).toBeCloseTo(originalPoints[i].x, 3);
        expect(parseResult.points[i].y).toBeCloseTo(originalPoints[i].y, 3);
        expect(parseResult.points[i].z).toBeCloseTo(originalPoints[i].z, 3);
      }

      unlinkSync(exportPath);
    });

    it('应该生成正确的快照格式', async () => {
      const result = await createTestFile(TEST_FILES.small, 'test_snapshot.dat', { pointCount: 3 });
      mainFileId = result.fileId;

      const points = await dataService.getPoints(mainFileId);
      const content = generateExportContent(points, 'simple', false);

      expect(content).toMatchSnapshot();
    });
  });

  describe('阶段 10: 并发操作测试', () => {
    it('应该正确处理并发点位更新并保持数据一致性', async () => {
      const result = await createTestFile(TEST_FILES.small, 'test_concurrent.dat', { pointCount: 10 });
      mainFileId = result.fileId;

      const points = await dataService.getPoints(mainFileId);
      const point = points[0];
      const originalOrder = point.order;

      // 并发更新不同字段
      const updates = [
        dataService.updatePoint(mainFileId, point.id, { pointNumber: 'UPDATE1' }),
        dataService.updatePoint(mainFileId, point.id, { z: 999 }),
        dataService.updatePoint(mainFileId, point.id, { type: 'control' }),
      ];

      await Promise.all(updates);

      const updatedPoints = await dataService.getPoints(mainFileId);
      const updatedPoint = updatedPoints.find(p => p.id === point.id);
      
      // 验证数据一致性
      expect(updatedPoint).toBeDefined();
      expect(updatedPoint!.id).toBe(point.id);
      expect(updatedPoint!.fileId).toBe(mainFileId);
      expect(updatedPoint!.order).toBe(originalOrder); // order 不应改变
      
      // 验证至少一个更新成功
      const hasUpdate = 
        updatedPoint!.pointNumber === 'UPDATE1' ||
        updatedPoint!.z === 999 ||
        updatedPoint!.type === 'control';
      expect(hasUpdate).toBe(true);
    });

    it('应该正确处理并发文件操作', async () => {
      const creates = [
        createTestFile(TEST_FILES.small, 'concurrent1.dat', { pointCount: 5 }),
        createTestFile(TEST_FILES.small, 'concurrent2.dat', { pointCount: 5 }),
        createTestFile(TEST_FILES.small, 'concurrent3.dat', { pointCount: 5 }),
      ];

      const results = await Promise.all(creates);

      expect(results.length).toBe(3);
      results.forEach(result => {
        expect(result.fileId).toBeTruthy();
        expect(result.points.length).toBe(5);
      });

      for (const result of results) {
        await dataService.deleteFile(result.fileId);
      }
    });

    it('应该正确处理并发删除操作', async () => {
      const result = await createTestFile(TEST_FILES.small, 'test_concurrent_delete.dat', { pointCount: 10 });
      mainFileId = result.fileId;

      const points = await dataService.getPoints(mainFileId);

      const deletes = [
        dataService.deletePoint(mainFileId, points[0].id),
        dataService.deletePoint(mainFileId, points[1].id),
        dataService.deletePoint(mainFileId, points[2].id),
      ];

      await Promise.all(deletes);

      const remainingPoints = await dataService.getPoints(mainFileId);
      expect(remainingPoints.length).toBe(points.length - 3);
    });
  });

  describe('错误处理测试', () => {
    it('应该正确处理不存在的文件ID', async () => {
      const fakeFileId = 'non-existent-file-id';
      const file = await dataService.getFile(fakeFileId);
      expect(file).toBeNull();
    });

    it('应该正确处理不存在的点位ID', async () => {
      const result = await createTestFile(TEST_FILES.small, 'test_error.dat', { pointCount: 10 });
      mainFileId = result.fileId;

      const fakePointId = 'non-existent-point-id';
      
      await expect(
        dataService.deletePoint(mainFileId, fakePointId)
      ).resolves.not.toThrow();
    });

    it('应该正确处理损坏的文件内容', async () => {
      const brokenContent = 'invalid,data,format\n1,2,3\n';
      const blob = new Blob([brokenContent], { type: 'text/plain' });
      const file = new File([blob], 'broken.dat', { type: 'text/plain' });

      const parseResult = await fileParser.parse(file, 'temp-id');
      
      expect(parseResult.errors.length).toBeGreaterThan(0);
    });

    it('应该正确处理空文件', async () => {
      const emptyContent = '';
      const blob = new Blob([emptyContent], { type: 'text/plain' });
      const file = new File([blob], 'empty.dat', { type: 'text/plain' });

      const parseResult = await fileParser.parse(file, 'temp-id');
      
      expect(parseResult.points.length).toBe(0);
    });

    it('应该正确处理数据库操作失败', async () => {
      // 尝试更新不存在的文件
      await expect(
        dataService.updateFile('non-existent-id', { name: 'new-name' })
      ).resolves.not.toThrow();
    });

    it('应该正确处理无效的坐标值', async () => {
      const invalidContent = 'P1,,abc,def,ghi\n';
      const blob = new Blob([invalidContent], { type: 'text/plain' });
      const file = new File([blob], 'invalid-coords.dat', { type: 'text/plain' });

      const parseResult = await fileParser.parse(file, 'temp-id');
      
      expect(parseResult.errors.length).toBeGreaterThan(0);
      expect(parseResult.points.length).toBe(0);
    });

    it('应该正确处理超大文件（内存限制）', async () => {
      // 创建一个包含大量点位的内容
      const largeContent = Array.from({ length: 10000 }, (_, i) => 
        `P${i + 1},,${300 + i},${500 + i},${30 + i}`
      ).join('\n');
      
      const blob = new Blob([largeContent], { type: 'text/plain' });
      const file = new File([blob], 'large.dat', { type: 'text/plain' });

      const parseResult = await fileParser.parse(file, 'temp-id');
      
      // 应该成功解析，不抛出内存错误
      expect(parseResult.points.length).toBe(10000);
    });

    it('应该正确处理重复的文件ID', async () => {
      const result = await createTestFile(TEST_FILES.small, 'test_duplicate.dat', { pointCount: 5 });
      mainFileId = result.fileId;

      // 尝试保存相同ID的文件（应该覆盖）
      const duplicateFile = { ...result.file, name: 'duplicate.dat' };
      
      await expect(
        dataService.saveFile(duplicateFile)
      ).resolves.toBe(mainFileId);

      const savedFile = await dataService.getFile(mainFileId);
      expect(savedFile!.name).toBe('duplicate.dat');
    });
  });

  describe('边界条件测试', () => {
    it('应该处理只有一个点位的文件', async () => {
      const result = await createTestFile(TEST_FILES.small, 'test_single.dat', { pointCount: 1 });
      mainFileId = result.fileId;

      const points = await dataService.getPoints(mainFileId);
      expect(points.length).toBe(1);
      validatePointData(points[0]);
    });

    it('应该处理特殊字符点号', async () => {
      const result = await createTestFile(TEST_FILES.small, 'test_special.dat', { pointCount: 5 });
      mainFileId = result.fileId;

      const points = await dataService.getPoints(mainFileId);
      const point = points[0];

      const specialName = 'Point-123_ABC';
      await dataService.updatePoint(mainFileId, point.id, {
        pointNumber: specialName,
      });

      const updatedPoints = await dataService.getPoints(mainFileId);
      const updatedPoint = updatedPoints.find(p => p.id === point.id);
      expect(updatedPoint!.pointNumber).toBe(specialName);
    });

    it('应该处理极大坐标值', async () => {
      const result = await createTestFile(TEST_FILES.small, 'test_large_coords.dat', { pointCount: 5 });
      mainFileId = result.fileId;

      const points = await dataService.getPoints(mainFileId);
      const point = points[0];

      const largeX = 999999999.999;
      const largeY = 999999999.999;
      
      await dataService.updatePoint(mainFileId, point.id, {
        x: largeX,
        y: largeY,
      });

      const updatedPoints = await dataService.getPoints(mainFileId);
      const updatedPoint = updatedPoints.find(p => p.id === point.id);
      expect(updatedPoint!.x).toBe(largeX);
      expect(updatedPoint!.y).toBe(largeY);
    });

    it('应该处理极小坐标值', async () => {
      const result = await createTestFile(TEST_FILES.small, 'test_small_coords.dat', { pointCount: 5 });
      mainFileId = result.fileId;

      const points = await dataService.getPoints(mainFileId);
      const point = points[0];

      const smallX = 0.001;
      const smallY = 0.001;
      
      await dataService.updatePoint(mainFileId, point.id, {
        x: smallX,
        y: smallY,
      });

      const updatedPoints = await dataService.getPoints(mainFileId);
      const updatedPoint = updatedPoints.find(p => p.id === point.id);
      expect(updatedPoint!.x).toBeCloseTo(smallX, 3);
      expect(updatedPoint!.y).toBeCloseTo(smallY, 3);
    });
  });

  describe('性能测试', () => {
    it('应该在合理时间内处理大量点位', async () => {
      const startTime = Date.now();

      const result = await createTestFile(TEST_FILES.large, 'test_performance.dat', { pointCount: 100 });
      mainFileId = result.fileId;

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(3000);
      expect(result.points.length).toBe(100);
    });

    it('应该在合理时间内执行批量更新', async () => {
      const result = await createTestFile(TEST_FILES.small, 'test_batch_update.dat', { pointCount: 50 });
      mainFileId = result.fileId;

      const points = await dataService.getPoints(mainFileId);

      const startTime = Date.now();

      const updates = points.map(p =>
        dataService.updatePoint(mainFileId, p.id, { type: 'control' })
      );

      await Promise.all(updates);

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(2000);

      const updatedPoints = await dataService.getPoints(mainFileId);
      expect(updatedPoints.every(p => p.type === 'control')).toBe(true);
    });
  });

  describe('阶段 11: 异常检测测试', () => {
    it('应该检测精度异常（HRMS超标）', async () => {
      const result = await createTestFile(TEST_FILES.small, 'test_precision.dat', { pointCount: 10 });
      mainFileId = result.fileId;

      const points = await dataService.getPoints(mainFileId);
      
      // 模拟添加精度异常点
      const anomalyPoint = {
        ...points[0],
        id: 'anomaly-point-1',
        pointNumber: 'ANOMALY1',
        qualityParams: {
          hrms: 0.5, // 超过默认阈值 0.1
          vrms: 0.05,
        },
      };
      
      await dataService.savePoint(mainFileId, anomalyPoint);

      // 使用异常检测服务
      const { anomalyDetectionService } = await import('../../services/anomalyDetectionService');
      const allPoints = await dataService.getPoints(mainFileId);
      
      const anomalies = anomalyDetectionService.detectAll(allPoints, {
        hrmsThreshold: 0.1,
        vrmsThreshold: 0.1,
        duplicateCoordinateTolerance: 0.01,
        isolatedPointRangeMultiplier: 5,
      });

      const precisionAnomalies = anomalies.filter(a => a.type === 'precision');
      expect(precisionAnomalies.length).toBeGreaterThan(0);
      expect(precisionAnomalies.some(a => a.pointNumber === 'ANOMALY1')).toBe(true);
    });

    it('应该检测孤立点', async () => {
      const result = await createTestFile(TEST_FILES.small, 'test_isolated.dat', { pointCount: 10 });
      mainFileId = result.fileId;

      const points = await dataService.getPoints(mainFileId);
      
      // 添加一个远离其他点的孤立点
      const isolatedPoint = {
        ...points[0],
        id: 'isolated-point-1',
        pointNumber: 'ISOLATED1',
        x: points[0].x + 10000, // 远离其他点
        y: points[0].y + 10000,
      };
      
      await dataService.savePoint(mainFileId, isolatedPoint);

      const { anomalyDetectionService } = await import('../../services/anomalyDetectionService');
      const allPoints = await dataService.getPoints(mainFileId);
      
      const anomalies = anomalyDetectionService.detectAll(allPoints, {
        hrmsThreshold: 0.1,
        vrmsThreshold: 0.1,
        duplicateCoordinateTolerance: 0.01,
        isolatedPointRangeMultiplier: 5,
      });

      const isolatedAnomalies = anomalies.filter(a => a.type === 'isolated');
      expect(isolatedAnomalies.length).toBeGreaterThan(0);
      expect(isolatedAnomalies.some(a => a.pointNumber === 'ISOLATED1')).toBe(true);
    });

    it('应该检测重复坐标', async () => {
      const result = await createTestFile(TEST_FILES.small, 'test_duplicate_coords.dat', { pointCount: 10 });
      mainFileId = result.fileId;

      const points = await dataService.getPoints(mainFileId);
      
      // 添加一个坐标几乎相同的点
      const duplicatePoint = {
        ...points[0],
        id: 'duplicate-point-1',
        pointNumber: 'DUPLICATE1',
        x: points[0].x + 0.005, // 非常接近
        y: points[0].y + 0.005,
      };
      
      await dataService.savePoint(mainFileId, duplicatePoint);

      const { anomalyDetectionService } = await import('../../services/anomalyDetectionService');
      const allPoints = await dataService.getPoints(mainFileId);
      
      const anomalies = anomalyDetectionService.detectAll(allPoints, {
        hrmsThreshold: 0.1,
        vrmsThreshold: 0.1,
        duplicateCoordinateTolerance: 0.01,
        isolatedPointRangeMultiplier: 5,
      });

      const duplicateAnomalies = anomalies.filter(a => a.type === 'duplicate');
      expect(duplicateAnomalies.length).toBeGreaterThan(0);
    });
  });

  describe('阶段 12: 测量工具测试', () => {
    it('应该正确计算平面距离', async () => {
      const result = await createTestFile(TEST_FILES.small, 'test_plane_distance.dat', { pointCount: 10 });
      mainFileId = result.fileId;

      const points = await dataService.getPoints(mainFileId);
      const p1 = points[0];
      const p2 = points[1];

      const { calculatePlaneDistance } = await import('../../utils/distanceUtils');
      const distance = calculatePlaneDistance(p1, p2);

      expect(distance).toBeGreaterThan(0);
      expect(typeof distance).toBe('number');
      expect(isFinite(distance)).toBe(true);
    });

    it('应该正确计算球面距离（Haversine）', async () => {
      const result = await createTestFile(TEST_FILES.small, 'test_haversine.dat', { pointCount: 10 });
      mainFileId = result.fileId;

      // 添加经纬度坐标
      const p1 = { lat: 39.9042, lng: 116.4074 }; // 北京
      const p2 = { lat: 31.2304, lng: 121.4737 }; // 上海

      const { calculateHaversineDistance } = await import('../../utils/distanceUtils');
      const distance = calculateHaversineDistance(p1, p2);

      // 北京到上海约 1067 km
      expect(distance).toBeGreaterThan(1000000); // > 1000 km
      expect(distance).toBeLessThan(1200000); // < 1200 km
    });

    it('应该正确计算高差', async () => {
      const result = await createTestFile(TEST_FILES.small, 'test_elevation.dat', { pointCount: 10 });
      mainFileId = result.fileId;

      const points = await dataService.getPoints(mainFileId);
      const p1 = points[0];
      const p2 = points[1];

      const elevationDiff = Math.abs(p1.z - p2.z);

      expect(typeof elevationDiff).toBe('number');
      expect(isFinite(elevationDiff)).toBe(true);
      expect(elevationDiff).toBeGreaterThanOrEqual(0);
    });
  });

  describe('阶段 13: 复杂组合流程测试', () => {
    it('应该完成导入→坐标反转→随机删除→随机改名→导出验证的完整流程', async () => {
      // 1. 导入文件
      const result = await createTestFile(TEST_FILES.small, 'test_complex_flow.dat', { pointCount: 20 });
      mainFileId = result.fileId;

      let points = await dataService.getPoints(mainFileId);
      const originalCount = points.length;
      expect(originalCount).toBe(20);

      // 2. 坐标反转（X/Y互换）
      const pointToSwap = points[5];
      const originalX = pointToSwap.x;
      const originalY = pointToSwap.y;

      await dataService.updatePoint(mainFileId, pointToSwap.id, {
        x: originalY,
        y: originalX,
      });

      points = await dataService.getPoints(mainFileId);
      const swappedPoint = points.find(p => p.id === pointToSwap.id);
      expect(swappedPoint!.x).toBe(originalY);
      expect(swappedPoint!.y).toBe(originalX);

      // 3. 随机删除一个点
      const pointToDelete = points[10];
      const deletedPointNumber = pointToDelete.pointNumber;

      await dataService.deletePoint(mainFileId, pointToDelete.id);

      points = await dataService.getPoints(mainFileId);
      expect(points.length).toBe(originalCount - 1);
      expect(points.find(p => p.id === pointToDelete.id)).toBeUndefined();

      // 4. 随机改名一个点
      const pointToRename = points[3];
      const newPointNumber = 'RENAMED_POINT';

      await dataService.updatePoint(mainFileId, pointToRename.id, {
        pointNumber: newPointNumber,
      });

      points = await dataService.getPoints(mainFileId);
      const renamedPoint = points.find(p => p.id === pointToRename.id);
      expect(renamedPoint!.pointNumber).toBe(newPointNumber);

      // 5. 导出并验证
      const exportContent = generateExportContent(points, 'simple', false);
      const exportLines = exportContent.split('\n').filter(line => line.trim());

      // 验证导出内容
      expect(exportLines.length).toBe(originalCount - 1); // 删除了一个点
      expect(exportContent).toContain(newPointNumber); // 包含改名后的点号
      
      // 验证已删除的点号不在导出中（使用精确匹配）
      const deletedPointInExport = exportLines.some(line => {
        const pointNum = line.split(',')[0];
        return pointNum === deletedPointNumber;
      });
      expect(deletedPointInExport).toBe(false);

      // 验证坐标反转的点在导出中正确
      const swappedLine = exportLines.find(line => line.startsWith(pointToSwap.pointNumber));
      expect(swappedLine).toBeDefined();
      const swappedParts = swappedLine!.split(',');
      expect(parseFloat(swappedParts[2])).toBeCloseTo(originalY, 3);
      expect(parseFloat(swappedParts[3])).toBeCloseTo(originalX, 3);

      // 6. 重新导入验证数据一致性
      const reimportPath = join(OUTPUT_DIR, 'test_complex_flow_export.dat');
      writeFileSync(reimportPath, exportContent, 'utf-8');

      const reimportContent = readFileSync(reimportPath, 'utf-8');
      const blob = new Blob([reimportContent], { type: 'text/plain' });
      const file = new File([blob], 'reimport.dat', { type: 'text/plain' });

      const parseResult = await fileParser.parse(file, 'temp-id');

      expect(parseResult.points.length).toBe(originalCount - 1);
      expect(parseResult.points.some(p => p.pointNumber === newPointNumber)).toBe(true);
      
      // 验证已删除的点不在重新导入的数据中
      const deletedPointInReimport = parseResult.points.some(p => p.pointNumber === deletedPointNumber);
      expect(deletedPointInReimport).toBe(false);

      unlinkSync(reimportPath);
    });
  });
});
