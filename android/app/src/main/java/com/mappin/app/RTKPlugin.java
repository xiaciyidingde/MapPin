package com.mappin.app;

import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * RTK 插件
 * 提供 CORS 连接、GPS 原始数据访问、RTK 解算等功能
 */
@CapacitorPlugin(name = "RTK")
public class RTKPlugin extends Plugin {

    private NTRIPClient ntripClient;
    private RTKProcessor rtkProcessor;
    private OfflineDebugCollectorPlugin debugCollector;
    private boolean isPositioning = false;

    @Override
    public void load() {
        super.load();
        ntripClient = new NTRIPClient(getContext());
        debugCollector = new OfflineDebugCollectorPlugin(getContext());
        rtkProcessor = new RTKProcessor(getContext(), debugCollector);
        
        // 设置 RTCM 数据监听器，将数据传递给 RTK 处理器
        ntripClient.setDataListener(new NTRIPClient.RTCMDataListener() {
            @Override
            public void onRTCMData(byte[] data) {
                if (rtkProcessor != null) {
                    rtkProcessor.processRTCMData(data);
                }
                // 同时传递给调试收集器
                if (debugCollector != null) {
                    debugCollector.recordRTCM(data, data.length);
                }
            }
        });
        
        // 设置星历状态监听器
        rtkProcessor.setEphemerisStatusListener(new RTKProcessor.EphemerisStatusListener() {
            @Override
            public void onEphemerisLoading(boolean loading) {
                JSObject ret = new JSObject();
                ret.put("loading", loading);
                notifyListeners("ephemerisLoadingStatus", ret);
            }

            @Override
            public void onEphemerisFailed(boolean failed) {
                JSObject ret = new JSObject();
                ret.put("failed", failed);
                notifyListeners("ephemerisFailedStatus", ret);
            }
        });
        
        // 设置 RTK 状态更新监听器
        rtkProcessor.setRTKStatusUpdateListener(new RTKProcessor.RTKStatusUpdateListener() {
            @Override
            public void onRTKStatusUpdate(JSObject status) {
                notifyListeners("rtkStatusUpdate", status);
            }
        });
    }

    /**
     * 连接 CORS 基站
     */
    @PluginMethod
    public void connect(PluginCall call) {
        String host = call.getString("host");
        Integer port = call.getInt("port");
        String mountpoint = call.getString("mountpoint");
        String username = call.getString("username");
        String password = call.getString("password");

        if (host == null || port == null || mountpoint == null || username == null || password == null) {
            call.reject("缺少必需参数");
            return;
        }

        // 在后台线程执行连接
        new Thread(() -> {
            try {
                boolean success = ntripClient.connect(host, port, mountpoint, username, password);
                
                JSObject ret = new JSObject();
                ret.put("success", success);
                if (success) {
                    ret.put("message", "连接成功");
                } else {
                    ret.put("message", "连接失败");
                }
                call.resolve(ret);
            } catch (Exception e) {
                JSObject ret = new JSObject();
                ret.put("success", false);
                ret.put("message", "连接异常: " + e.getMessage());
                call.resolve(ret);
            }
        }, "RTKPlugin-Connect").start();
    }

    /**
     * 断开 CORS 连接
     */
    @PluginMethod
    public void disconnect(PluginCall call) {
        try {
            ntripClient.disconnect();
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            isPositioning = false;
            isPositioning = false;
            call.reject("断开连接失败: " + e.getMessage());
        }
    }

    /**
     * 获取连接状态
     */
    @PluginMethod
    public void getConnectionStatus(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("status", ntripClient.getStatus());
        ret.put("message", ntripClient.getStatusMessage());
        if (ntripClient.isConnected()) {
            ret.put("connectedAt", ntripClient.getConnectedTime());
        }
        call.resolve(ret);
    }

    /**
     * 获取 RTK 状态
     */
    @PluginMethod
    public void getRTKStatus(PluginCall call) {
        JSObject ret = rtkProcessor.getStatus();
        call.resolve(ret);
    }

    /**
     * 开始 RTK 定位
     */
    @PluginMethod
    public void startRTKPositioning(PluginCall call) {
        Integer updateInterval = call.getInt("updateInterval", 1000);
        
        if (!ntripClient.isConnected()) {
            call.reject("请先连接 CORS 基站");
            return;
        }

        try {
            boolean started = rtkProcessor.start(updateInterval, position -> {
                // 发送位置更新事件
                notifyListeners("rtkPositionUpdate", position);
            });

            JSObject ret = new JSObject();
            ret.put("success", started);
            isPositioning = started;
            call.resolve(ret);
        } catch (Exception e) {
            isPositioning = false;
            call.reject("启动定位失败: " + e.getMessage());
        }
    }

    /**
     * 停止 RTK 定位
     */
    @PluginMethod
    public void stopRTKPositioning(PluginCall call) {
        try {
            isPositioning = false;
            rtkProcessor.stop();
            
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("停止定位失败: " + e.getMessage());
        }
    }

    @Override
    protected void handleOnDestroy() {
        if (rtkProcessor != null) {
            rtkProcessor.destroy();
            isPositioning = false;
        }
        if (ntripClient.isConnected()) {
            ntripClient.disconnect();
        }
        if (debugCollector != null) {
            debugCollector.release();
        }
        super.handleOnDestroy();
    }

    /**
     * 开始收集离线调试数据
     */
    @PluginMethod
    public void startDebugCollection(PluginCall call) {
        if (debugCollector == null) {
            call.reject("调试收集器未初始化");
            return;
        }
        try {
            JSObject result = debugCollector.startCollection();
            call.resolve(result);
        } catch (IllegalStateException e) {
            call.reject(e.getMessage());
        } catch (Exception e) {
            Log.e("RTKPlugin", "startDebugCollection 失败", e);
            call.reject("开始收集失败: " + e.getMessage());
        }
    }

    /**
     * 停止收集并分享数据
     */
    @PluginMethod
    public void stopDebugCollectionAndShare(PluginCall call) {
        if (debugCollector == null) {
            call.reject("调试收集器未初始化");
            return;
        }
        try {
            JSObject result = debugCollector.stopAndShare();
            call.resolve(result);
        } catch (IllegalStateException e) {
            call.reject(e.getMessage());
        } catch (Exception e) {
            Log.e("RTKPlugin", "stopDebugCollectionAndShare 失败", e);
            call.reject("停止收集失败: " + e.getMessage());
        }
    }

    /**
     * 获取调试收集状态
     */
    @PluginMethod
    public void getDebugCollectionStatus(PluginCall call) {
        if (debugCollector == null) {
            call.reject("调试收集器未初始化");
            return;
        }
        try {
            JSObject result = debugCollector.getStatus();
            call.resolve(result);
        } catch (Exception e) {
            Log.e("RTKPlugin", "getDebugCollectionStatus 失败", e);
            call.reject("获取状态失败: " + e.getMessage());
        }
    }
}
