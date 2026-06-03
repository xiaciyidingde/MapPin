package com.mappin.app;

import android.util.Log;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.util.HashMap;
import java.util.Map;

/**
 * RTCM数据分析插件
 * 分析保存的RTCM数据文件，统计消息类型
 */
@CapacitorPlugin(name = "RTCMAnalyzer")
public class RTCMAnalyzerPlugin extends Plugin {
    private static final String TAG = "RTCMAnalyzer";
    
    /**
     * 分析最新的RTCM数据文件
     */
    @PluginMethod
    public void analyzeLatestFile(PluginCall call) {
        try {
            // 查找最新的RTCM文件
            File filesDir = getContext().getExternalFilesDir(null);
            if (filesDir == null) {
                call.reject("无法访问文件目录");
                return;
            }
            
            File[] files = filesDir.listFiles((dir, name) -> name.startsWith("rtcm_") && name.endsWith(".bin"));
            if (files == null || files.length == 0) {
                call.reject("未找到RTCM数据文件，请先连接CORS");
                return;
            }
            
            // 找到最新的文件
            File latestFile = files[0];
            for (File file : files) {
                if (file.lastModified() > latestFile.lastModified()) {
                    latestFile = file;
                }
            }
            
            Log.i(TAG, "分析RTCM文件: " + latestFile.getName() + " (" + latestFile.length() + " 字节)");
            
            // 分析文件
            Map<Integer, Integer> msgTypes = analyzeRTCMFile(latestFile);
            
            // 构建结果
            JSObject result = new JSObject();
            result.put("fileName", latestFile.getName());
            result.put("fileSize", latestFile.length());
            result.put("lastModified", latestFile.lastModified());
            
            JSObject messages = new JSObject();
            int totalMessages = 0;
            boolean hasEphemeris = false;
            
            for (Map.Entry<Integer, Integer> entry : msgTypes.entrySet()) {
                int msgType = entry.getKey();
                int count = entry.getValue();
                messages.put(String.valueOf(msgType), count);
                totalMessages += count;
                
                // 检查是否有星历消息
                if (msgType == 1019 || msgType == 1020 || msgType == 1042 || msgType == 1044) {
                    hasEphemeris = true;
                }
            }
            
            result.put("messages", messages);
            result.put("totalMessages", totalMessages);
            result.put("hasEphemeris", hasEphemeris);
            
            call.resolve(result);
            
        } catch (Exception e) {
            Log.e(TAG, "分析RTCM文件失败", e);
            call.reject("分析失败: " + e.getMessage());
        }
    }
    
    /**
     * 分析RTCM文件，统计消息类型
     */
    private Map<Integer, Integer> analyzeRTCMFile(File file) throws Exception {
        Map<Integer, Integer> msgTypes = new HashMap<>();
        
        try (FileInputStream fis = new FileInputStream(file)) {
            byte[] buffer = new byte[4096];
            int bytesRead;
            byte[] dataBuffer = new byte[0];
            
            while ((bytesRead = fis.read(buffer)) > 0) {
                // 合并数据
                byte[] newBuffer = new byte[dataBuffer.length + bytesRead];
                System.arraycopy(dataBuffer, 0, newBuffer, 0, dataBuffer.length);
                System.arraycopy(buffer, 0, newBuffer, dataBuffer.length, bytesRead);
                dataBuffer = newBuffer;
                
                // 解析RTCM消息
                int i = 0;
                while (i < dataBuffer.length - 6) {
                    // 查找RTCM3消息头（0xD3）
                    if ((dataBuffer[i] & 0xFF) == 0xD3) {
                        // 读取消息长度（10 bits）
                        int length = (((dataBuffer[i + 1] & 0x03) << 8) | (dataBuffer[i + 2] & 0xFF));
                        
                        if (i + length + 6 <= dataBuffer.length) {
                            // 读取消息类型（12 bits）
                            int msgType = (((dataBuffer[i + 3] & 0xFF) << 4) | ((dataBuffer[i + 4] & 0xFF) >> 4));
                            
                            // 统计
                            msgTypes.put(msgType, msgTypes.getOrDefault(msgType, 0) + 1);
                            
                            // 跳过整个消息
                            i += length + 6;
                        } else {
                            // 消息不完整，保留到下次处理
                            byte[] remaining = new byte[dataBuffer.length - i];
                            System.arraycopy(dataBuffer, i, remaining, 0, remaining.length);
                            dataBuffer = remaining;
                            break;
                        }
                    } else {
                        i++;
                    }
                }
                
                // 如果处理完了所有数据，清空缓冲区
                if (i >= dataBuffer.length) {
                    dataBuffer = new byte[0];
                }
            }
        }
        
        return msgTypes;
    }
}
