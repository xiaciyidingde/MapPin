package com.mappin.app;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.location.GnssMeasurementsEvent;
import android.location.GnssMeasurement;
import android.location.GnssNavigationMessage;
import android.location.GnssStatus;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.net.ConnectivityManager;
import android.net.NetworkCapabilities;
import android.os.Build;
import android.os.Handler;
import android.util.Log;

import androidx.core.app.ActivityCompat;

import com.getcapacitor.JSObject;

/**
 * RTK 处理器
 * 
 * 星历获取方案：
 * - 主方案：CORS RTCM 数据
 * - 备用方案 1：从 IGS 服务器下载广播星历
 * - 备用方案 2：导航消息（如果设备支持）
 */
public class RTKProcessor {
    private static final String TAG = "RTKProcessor";
    
    // 星历检测超时时间（秒）
    private static final int EPHEMERIS_CHECK_TIMEOUT = 30;

    private Context context;
    private LocationManager locationManager;
    private GnssStatus.Callback gnssStatusCallback;
    private GnssMeasurementsEvent.Callback gnssMeasurementsCallback;
    private GnssNavigationMessage.Callback gnssNavigationCallback;
    private LocationListener locationListener;
    
    private RTKLibWrapper rtkLibWrapper;
    private EphemerisDownloader ephemerisDownloader;
    private OfflineDebugCollectorPlugin debugCollector;
    
    private boolean isRunning = false;
    private int satelliteCount = 0;
    private PositionUpdateListener positionListener;
    private EphemerisStatusListener ephemerisStatusListener;
    private RTKStatusUpdateListener rtkStatusUpdateListener;
    private boolean navigationMessageReceived = false;
    private boolean ephemerisDownloadTriggered = false;
    private boolean firstMeasurementReceived = false;  // 标记是否首次收到测量数据
    private long startTime = 0;
    private Handler handler = new Handler();
    private Runnable statusUpdateRunnable;

    public RTKProcessor(Context context) {
        this.context = context;
        this.locationManager = (LocationManager) context.getSystemService(Context.LOCATION_SERVICE);
        this.rtkLibWrapper = new RTKLibWrapper();
        this.ephemerisDownloader = new EphemerisDownloader(context, rtkLibWrapper);
        this.debugCollector = null;
    }

    public RTKProcessor(Context context, OfflineDebugCollectorPlugin debugCollector) {
        this.context = context;
        this.locationManager = (LocationManager) context.getSystemService(Context.LOCATION_SERVICE);
        this.rtkLibWrapper = new RTKLibWrapper();
        this.ephemerisDownloader = new EphemerisDownloader(context, rtkLibWrapper);
        this.debugCollector = debugCollector;
    }

    /**
     * 开始 RTK 定位
     */
    public boolean start(int updateInterval, PositionUpdateListener listener) {
        if (isRunning) {
            return true;
        }

        this.positionListener = listener;
        navigationMessageReceived = false;
        ephemerisDownloadTriggered = false;
        firstMeasurementReceived = false;
        satelliteCount = 0;
        startTime = 0;
        if (ephemerisStatusListener != null) {
            ephemerisStatusListener.onEphemerisFailed(false);
        }

        // 检查权限
        if (ActivityCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) 
                != PackageManager.PERMISSION_GRANTED) {
            Log.e(TAG, "缺少定位权限");
            return false;
        }

        // 初始化 RTKLIB
        if (!rtkLibWrapper.init()) {
            Log.e(TAG, "RTKLIB 初始化失败");
            return false;
        }

        // 注册 GNSS 状态回调（获取卫星信息）
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            gnssStatusCallback = new GnssStatus.Callback() {
                @Override
                public void onSatelliteStatusChanged(GnssStatus status) {
                    satelliteCount = status.getSatelliteCount();
                    
                    // 每10秒输出一次卫星状态
                    if (System.currentTimeMillis() % 10000 < 1000) {
                        int gpsCount = 0, glonassCount = 0, galileoCount = 0, beidouCount = 0;
                        
                        for (int i = 0; i < status.getSatelliteCount(); i++) {
                            int constType = status.getConstellationType(i);
                            if (status.getCn0DbHz(i) > 20.0) { // 只统计信号强度足够的卫星
                                switch (constType) {
                                    case GnssStatus.CONSTELLATION_GPS:
                                        gpsCount++;
                                        break;
                                    case GnssStatus.CONSTELLATION_GLONASS:
                                        glonassCount++;
                                        break;
                                    case GnssStatus.CONSTELLATION_GALILEO:
                                        galileoCount++;
                                        break;
                                    case GnssStatus.CONSTELLATION_BEIDOU:
                                        beidouCount++;
                                        break;
                                }
                            }
                        }
                        
                        Log.i(TAG, String.format("卫星状态: GPS=%d, GLONASS=%d, Galileo=%d, BeiDou=%d, 总计=%d",
                            gpsCount, glonassCount, galileoCount, beidouCount, satelliteCount));
                    }
                }
            };
            boolean statusRegistered = locationManager.registerGnssStatusCallback(gnssStatusCallback);
            if (!statusRegistered) {
                Log.e(TAG, "注册 GNSS 状态回调失败");
                cleanupAfterStartFailure();
                return false;
            }
        }

        // 注册 GNSS 原始测量数据回调（Android 7.0+）
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            // 检查设备是否支持 GNSS 原始测量（Android 12+ 才有 API）
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                // Android 12+ 使用 GnssCapabilities API
                try {
                    android.location.GnssCapabilities capabilities = locationManager.getGnssCapabilities();
                    // 使用反射调用 hasGnssMeasurementSupport()，避免编译错误
                    java.lang.reflect.Method method = capabilities.getClass().getMethod("hasGnssMeasurementSupport");
                    Boolean supported = (Boolean) method.invoke(capabilities);
                    if (Boolean.TRUE.equals(supported)) {
                        Log.i(TAG, "设备支持 GNSS 原始测量（GnssCapabilities）");
                    } else {
                        Log.e(TAG, "设备不支持 GNSS 原始测量（hasGnssMeasurementSupport = false）");
                        Log.e(TAG, "离线数据收集将无法获取观测数据");
                    }
                } catch (Exception e) {
                    Log.w(TAG, "无法检测 GNSS 能力: " + e.getMessage());
                }
            } else {
                Log.i(TAG, "Android < 12，无法预检测设备能力");
            }
            
            gnssMeasurementsCallback = new GnssMeasurementsEvent.Callback() {
                @Override
                public void onGnssMeasurementsReceived(GnssMeasurementsEvent event) {
                    processGnssMeasurements(event);
                }
                
                @Override
                public void onStatusChanged(int status) {
                    switch (status) {
                        case GnssMeasurementsEvent.Callback.STATUS_NOT_SUPPORTED:
                            Log.e(TAG, "GNSS 原始测量状态: NOT_SUPPORTED");
                            break;
                        case GnssMeasurementsEvent.Callback.STATUS_READY:
                            Log.i(TAG, "GNSS 原始测量状态: READY");
                            break;
                        case GnssMeasurementsEvent.Callback.STATUS_LOCATION_DISABLED:
                            Log.w(TAG, "GNSS 原始测量状态: LOCATION_DISABLED");
                            break;
                        default:
                            Log.w(TAG, "GNSS 原始测量状态: UNKNOWN(" + status + ")");
                            break;
                    }
                }
            };
            
            boolean registered = locationManager.registerGnssMeasurementsCallback(gnssMeasurementsCallback);
            if (registered) {
                Log.i(TAG, "已注册 GNSS 原始测量回调");
            } else {
                Log.e(TAG, "注册 GNSS 原始测量回调失败");
                cleanupAfterStartFailure();
                return false;
            }
        } else {
            Log.w(TAG, "设备不支持 GNSS 原始测量（需要 Android 7.0+）");
            cleanupAfterStartFailure();
            return false;
        }

        // 注册位置监听器（作为备用）
        locationListener = new LocationListener() {
            @Override
            public void onLocationChanged(Location location) {
                // 备用定位（当 RTK 不可用时）
                if (positionListener != null) {
                    JSObject position = new JSObject();
                    position.put("latitude", location.getLatitude());
                    position.put("longitude", location.getLongitude());
                    position.put("altitude", location.getAltitude());
                    position.put("accuracy", location.getAccuracy());
                    position.put("fixType", "SPP");
                    position.put("timestamp", location.getTime());
                    
                    positionListener.onPositionUpdate(position);
                }
            }

            @Override
            public void onProviderEnabled(String provider) {}

            @Override
            public void onProviderDisabled(String provider) {}

            @Override
            public void onStatusChanged(String provider, int status, android.os.Bundle extras) {}
        };

        try {
            locationManager.requestLocationUpdates(
                LocationManager.GPS_PROVIDER,
                updateInterval,
                0,
                locationListener
            );
        } catch (SecurityException e) {
            Log.e(TAG, "注册位置监听失败: 缺少定位权限", e);
            cleanupAfterStartFailure();
            return false;
        } catch (Exception e) {
            Log.e(TAG, "注册位置监听失败", e);
            cleanupAfterStartFailure();
            return false;
        }

        isRunning = true;
        startTime = System.currentTimeMillis();

        Log.i(TAG, "========================================");
        Log.i(TAG, "MapPin RTK 系统启动");
        Log.i(TAG, "========================================");
        
        // 通知前端开始等待星历
        if (ephemerisStatusListener != null) {
            ephemerisStatusListener.onEphemerisLoading(true);
        }
        
        // 尝试注册导航消息回调（额外的星历来源）
        tryRegisterNavigationMessageCallback();
        
        // 启动期星历策略：有网络则立即下载，后续 CORS 入站星历自动覆盖
        if (isNetworkAvailable()) {
            Log.i(TAG, "网络可用，立即开始下载星历");
            downloadEphemeris();
        } else {
            Log.w(TAG, "网络不可用，跳过星历下载，等待 CORS 数据或网络恢复");
            if (ephemerisStatusListener != null) {
                ephemerisStatusListener.onEphemerisLoading(false);
            }
        }
        
        // 启动定期状态更新（每2秒更新一次）
        startPeriodicStatusUpdate();
        return true;
    }

    private void cleanupAfterStartFailure() {
        isRunning = false;
        positionListener = null;

        if (statusUpdateRunnable != null) {
            handler.removeCallbacks(statusUpdateRunnable);
            statusUpdateRunnable = null;
        }

        if (gnssStatusCallback != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            try {
                locationManager.unregisterGnssStatusCallback(gnssStatusCallback);
            } catch (Exception e) {
                Log.w(TAG, "清理 GNSS 状态回调失败", e);
            }
            gnssStatusCallback = null;
        }

        if (gnssMeasurementsCallback != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            try {
                locationManager.unregisterGnssMeasurementsCallback(gnssMeasurementsCallback);
            } catch (Exception e) {
                Log.w(TAG, "清理 GNSS 原始测量回调失败", e);
            }
            gnssMeasurementsCallback = null;
        }

        if (gnssNavigationCallback != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            try {
                locationManager.unregisterGnssNavigationMessageCallback(gnssNavigationCallback);
            } catch (Exception e) {
                Log.w(TAG, "清理导航消息回调失败", e);
            }
            gnssNavigationCallback = null;
        }

        if (locationListener != null) {
            try {
                locationManager.removeUpdates(locationListener);
            } catch (Exception e) {
                Log.w(TAG, "清理位置监听失败", e);
            }
            locationListener = null;
        }

        if (rtkLibWrapper != null) {
            rtkLibWrapper.destroy();
        }
    }
    
    /**
     * 启动定期状态更新
     * 每2秒向前端推送一次 RTK 状态（包括卫星数量）
     */
    private void startPeriodicStatusUpdate() {
        statusUpdateRunnable = new Runnable() {
            @Override
            public void run() {
                if (!isRunning) {
                    return;
                }
                
                // 通知前端更新 RTK 状态
                if (rtkStatusUpdateListener != null) {
                    rtkStatusUpdateListener.onRTKStatusUpdate(getStatus());
                }
                
                // 2秒后再次执行
                handler.postDelayed(this, 2000);
            }
        };
        
        // 首次延迟1秒执行（等待初始化完成）
        handler.postDelayed(statusUpdateRunnable, 1000);
    }

    /**
     * 启动星历监控
     * 30秒后检测 CORS 是否提供星历，如果没有则启用备用方案
     */
    private void startEphemerisMonitoring() {
        handler.postDelayed(() -> {
            if (!isRunning) {
                return;
            }
            
            // 检查 RTKLIB 的星历数量
            int ephemerisCount = rtkLibWrapper.getEphemerisCount();
            
            Log.i(TAG, "========================================");
            Log.i(TAG, "星历状态检测（" + EPHEMERIS_CHECK_TIMEOUT + "秒后）");
            Log.i(TAG, "   RTKLIB 星历数: " + ephemerisCount);
            
            if (ephemerisCount == 0) {
                Log.w(TAG, "CORS 未提供星历数据");
                Log.i(TAG, "自动启用备用方案 1：下载广播星历");
                Log.i(TAG, "========================================");
                downloadEphemeris();
            } else {
                Log.i(TAG, "CORS 提供了星历数据");
                Log.i(TAG, "   继续使用主方案");
                Log.i(TAG, "========================================");
                
                // CORS 提供了星历，停止加载动画
                if (ephemerisStatusListener != null) {
                    ephemerisStatusListener.onEphemerisLoading(false);
                }
                
                // 通知前端更新 RTK 状态（包含星历数量）
                if (rtkStatusUpdateListener != null) {
                    rtkStatusUpdateListener.onRTKStatusUpdate(getStatus());
                }
            }
        }, EPHEMERIS_CHECK_TIMEOUT * 1000);
    }

    /**
     * 检查网络是否可用
     */
    private boolean isNetworkAvailable() {
        try {
            ConnectivityManager cm = (ConnectivityManager) 
                context.getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm == null) return true; // 容错：无法获取服务时默认放行
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                NetworkCapabilities caps = cm.getNetworkCapabilities(cm.getActiveNetwork());
                return caps != null && (
                    caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) ||
                    caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) ||
                    caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)
                );
            } else {
                // Android 6.0 以下使用旧 API
                android.net.NetworkInfo info = cm.getActiveNetworkInfo();
                return info != null && info.isConnected();
            }
        } catch (Exception e) {
            Log.w(TAG, "网络检查失败，默认认为有网络: " + e.getMessage());
            return true;
        }
    }

    /**
     * 下载广播星历（备用方案 1）
     */
    private void downloadEphemeris() {
        if (ephemerisDownloadTriggered) {
            return;
        }
        
        ephemerisDownloadTriggered = true;
        
        // 加载动画已经在 start() 时开启，这里不需要再次开启
        
        ephemerisDownloader.downloadTodayEphemeris(new EphemerisDownloader.DownloadCallback() {
            @Override
            public void onSuccess(int ephemerisCount) {
                // 通知前端加载成功，停止动画
                if (ephemerisStatusListener != null) {
                    ephemerisStatusListener.onEphemerisLoading(false);
                }
                
                // 通知前端更新 RTK 状态（包含星历数量）
                if (rtkStatusUpdateListener != null) {
                    rtkStatusUpdateListener.onRTKStatusUpdate(getStatus());
                }
            }

            @Override
            public void onError(String error) {
                // 通知前端加载失败
                if (ephemerisStatusListener != null) {
                    ephemerisStatusListener.onEphemerisLoading(false);
                    ephemerisStatusListener.onEphemerisFailed(true);
                }
                
                Log.e(TAG, "========================================");
                Log.e(TAG, "备用方案 1 失败");
                Log.e(TAG, "   错误: " + error);
                Log.w(TAG, "   建议：");
                Log.w(TAG, "   1. 检查网络连接");
                Log.w(TAG, "   2. 联系 CORS 提供商添加星历消息");
                Log.w(TAG, "   3. 稍后重试");
                Log.i(TAG, "========================================");
            }
        });
    }

    /**
     * 尝试注册导航消息回调
     * 作为额外的星历来源（如果设备支持）
     */
    private void tryRegisterNavigationMessageCallback() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) {
            Log.d(TAG, "Android 版本 < 7.0，不支持导航消息 API");
            return;
        }
        
        try {
            gnssNavigationCallback = new GnssNavigationMessage.Callback() {
                @Override
                public void onStatusChanged(int status) {
                    String statusStr = status == GnssNavigationMessage.Callback.STATUS_READY ? "READY" : 
                                     status == GnssNavigationMessage.Callback.STATUS_NOT_SUPPORTED ? "NOT_SUPPORTED" :
                                     status == GnssNavigationMessage.Callback.STATUS_LOCATION_DISABLED ? "LOCATION_DISABLED" : "UNKNOWN";
                    
                    if (status == GnssNavigationMessage.Callback.STATUS_NOT_SUPPORTED) {
                        Log.d(TAG, "导航消息状态: " + statusStr + " (设备不支持，这是正常的)");
                    } else {
                        Log.i(TAG, "导航消息状态: " + statusStr);
                    }
                }
                
                @Override
                public void onGnssNavigationMessageReceived(GnssNavigationMessage message) {
                    if (!navigationMessageReceived) {
                        navigationMessageReceived = true;
                        Log.i(TAG, "========================================");
                        Log.i(TAG, "设备支持导航消息！");
                        Log.i(TAG, "   这是额外的星历来源");
                        Log.i(TAG, "========================================");
                    }
                    processNavigationMessage(message);
                }
            };
            
            if (ActivityCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) 
                    == PackageManager.PERMISSION_GRANTED) {
                boolean registered = locationManager.registerGnssNavigationMessageCallback(gnssNavigationCallback);
                Log.d(TAG, "尝试注册导航消息回调: " + (registered ? "成功" : "失败"));
                
                // 30秒后检测是否收到数据
                handler.postDelayed(() -> {
                    if (!navigationMessageReceived) {
                        Log.d(TAG, "30秒内未收到导航消息（设备可能不支持）");
                        Log.d(TAG, "这是正常的，请确保 CORS 提供星历数据");
                    }
                }, 30000);
            }
        } catch (Exception e) {
            Log.d(TAG, "注册导航消息回调失败: " + e.getMessage());
        }
    }

    /**
     * 处理导航消息（额外的星历来源）
     */
    private void processNavigationMessage(GnssNavigationMessage message) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) {
            return;
        }

        byte[] data = message.getData();
        if (data == null || data.length == 0) {
            return;
        }

        // 传递给 RTKLIB 解析
        int result = rtkLibWrapper.decodeNavigationMessage(data, data.length);
        
        if (result > 0) {
            Log.d(TAG, "从导航消息获取星历: " + result + " 个");
        }
    }

    /**
     * 停止 RTK 定位
     */
    public void stop() {
        if (!isRunning) {
            return;
        }

        isRunning = false;
        
        // 停止定期状态更新
        if (statusUpdateRunnable != null) {
            handler.removeCallbacks(statusUpdateRunnable);
            statusUpdateRunnable = null;
        }

        if (gnssStatusCallback != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            locationManager.unregisterGnssStatusCallback(gnssStatusCallback);
            gnssStatusCallback = null;
        }

        if (gnssMeasurementsCallback != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            locationManager.unregisterGnssMeasurementsCallback(gnssMeasurementsCallback);
            gnssMeasurementsCallback = null;
        }

        if (gnssNavigationCallback != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            locationManager.unregisterGnssNavigationMessageCallback(gnssNavigationCallback);
            gnssNavigationCallback = null;
        }

        if (locationListener != null) {
            locationManager.removeUpdates(locationListener);
            locationListener = null;
        }

        // 释放 RTKLIB 资源
        if (rtkLibWrapper != null) {
            rtkLibWrapper.destroy();
        }

        positionListener = null;

        Log.i(TAG, "RTK 定位已停止");
    }

    public void destroy() {
        stop();
        if (ephemerisDownloader != null) {
            ephemerisDownloader.destroy();
            ephemerisDownloader = null;
        }
        if (rtkLibWrapper != null) {
            rtkLibWrapper.release();
            rtkLibWrapper = null;
        }
    }

    /**
     * 处理 GNSS 原始测量数据
     */
    private void processGnssMeasurements(GnssMeasurementsEvent event) {
        if (!isRunning) {
            return;
        }
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) {
            return;
        }

        // 记录观测数据到离线调试收集器
        if (debugCollector != null) {
            debugCollector.recordObservation(event);
        }

        int measurementCount = event.getMeasurements().size();
        
        // 首次收到数据时输出详细信息
        if (!firstMeasurementReceived && measurementCount > 0) {
            firstMeasurementReceived = true;
            Log.i(TAG, "========================================");
            Log.i(TAG, "首次收到 GNSS 原始测量数据");
            Log.i(TAG, "测量值数量: " + measurementCount);
            Log.i(TAG, "========================================");
        }
        
        // 每10秒输出一次测量数据统计
        if (System.currentTimeMillis() % 10000 < 1000) {
            if (measurementCount == 0) {
                Log.w(TAG, "收到 GNSS 测量数据: 0 个（室内或信号弱）");
            } else {
                Log.d(TAG, "收到 GNSS 测量数据: " + measurementCount + " 个");
            }
            
            // 添加详细过滤统计
            if (measurementCount > 0) {
                int filteredByState = 0;
                int filteredByCn0 = 0;
                int filteredByUncertainty = 0;
                int validCount = 0;
                
                for (android.location.GnssMeasurement m : event.getMeasurements()) {
                    int state = m.getState();
                    boolean towDecoded = (state & GnssMeasurement.STATE_TOW_DECODED) != 0;
                    boolean codeLock = (state & GnssMeasurement.STATE_CODE_LOCK) != 0;
                    
                    if (!towDecoded || !codeLock) {
                        filteredByState++;
                        continue;
                    }
                    
                    if (m.getCn0DbHz() < 20.0) {
                        filteredByCn0++;
                        continue;
                    }
                    
                    if (m.getReceivedSvTimeUncertaintyNanos() > 500) {
                        filteredByUncertainty++;
                        continue;
                    }
                    
                    validCount++;
                }
                
                Log.d(TAG, String.format("过滤统计: 总数=%d, 状态过滤=%d, 信号过滤=%d, 不确定性过滤=%d, 有效=%d",
                    measurementCount, filteredByState, filteredByCn0, filteredByUncertainty, validCount));
            }
        }

        // 收集所有观测值到数组中（批量处理）
        RTKLibWrapper.GNSSObservation[] observations = new RTKLibWrapper.GNSSObservation[measurementCount];
        int index = 0;
        
        // 遍历所有测量值
        for (android.location.GnssMeasurement measurement : event.getMeasurements()) {
            // P4 修复：检查 GnssClock 状态位
            int state = measurement.getState();
            boolean towDecoded = (state & GnssMeasurement.STATE_TOW_DECODED) != 0;
            boolean codeLock = (state & GnssMeasurement.STATE_CODE_LOCK) != 0;
            
            // TOW 未解码或码锁未捕获 → 时间不可信，跳过
            if (!towDecoded || !codeLock) {
                continue;
            }
            
            // 信号太弱的卫星跳过
            if (measurement.getCn0DbHz() < 20.0) {
                continue;
            }
            
            // 时间不确定性太大的跳过
            if (measurement.getReceivedSvTimeUncertaintyNanos() > 500) {
                continue;
            }
            
            // 创建观测数据对象
            RTKLibWrapper.GNSSObservation obs = new RTKLibWrapper.GNSSObservation();
            
            // P3 修复：设置卫星系统类型
            obs.constellationType = measurement.getConstellationType();
            
            // 计算接收机GPS时间（纳秒）
            // 参考Google官方文档：https://github.com/google/gps-measurement-tools
            long fullBiasNanos = event.getClock().getFullBiasNanos();
            double biasNanos = event.getClock().getBiasNanos();
            double timeNanos = event.getClock().getTimeNanos();
            double tRxGpsNanos = timeNanos - (fullBiasNanos + biasNanos);
            
            // 将GPS时间转换为Unix时间戳（RTKLIB使用Unix时间）
            // GPS时间起点：1980年1月6日00:00:00
            // Unix时间起点：1970年1月1日00:00:00
            // 差值：315964800秒 = 315964800000毫秒
            long GPS_TO_UNIX_OFFSET_MS = 315964800000L;
            obs.time = (long)(tRxGpsNanos / 1000000.0) + GPS_TO_UNIX_OFFSET_MS;
            
            // 设置卫星 ID（svid，各系统独立编号）
            obs.satelliteId = measurement.getSvid();
            
            // 设置伪距
            // 伪距 = (接收机GPS时间 - 卫星发射GPS时间) × 光速
            
            // 卫星发射GPS时间（纳秒）
            double tTxGpsNanos = measurement.getReceivedSvTimeNanos();
            
            // 传播时间（纳秒）
            double travelTimeNanos = tRxGpsNanos - tTxGpsNanos;
            
            // 处理GPS周跳转（1周 = 604800秒 = 604800000000000纳秒）
            double weekNanos = 604800.0e9;
            
            // 确保传播时间在合理范围内（0到半周）
            // 如果是负数或超过半周，进行周跳转修正
            travelTimeNanos = ((travelTimeNanos % weekNanos) + weekNanos) % weekNanos;
            if (travelTimeNanos > weekNanos / 2) {
                travelTimeNanos -= weekNanos;
            }
            
            // 伪距（米）= 传播时间（纳秒）× 光速（m/ns）
            double pseudorange = travelTimeNanos * 0.299792458;
            
            // 验证伪距是否合理（20,000km到30,000km之间）
            if (pseudorange < 20000000.0 || pseudorange > 30000000.0) {
                if (index < 3) {
                    Log.w(TAG, String.format("伪距异常，跳过卫星%d: 伪距=%.2f m", 
                        measurement.getSvid(), pseudorange));
                }
                continue; // 跳过这个观测值
            }
            
            obs.pseudorange = pseudorange;
            
            // 设置载波相位
            int adrState = measurement.getAccumulatedDeltaRangeState();
            double adrMeters = measurement.getAccumulatedDeltaRangeMeters();
            
            // 检查是否有 VALID 标志 (bit 0)
            boolean hasValid = (adrState & GnssMeasurement.ADR_STATE_VALID) != 0;
            // 检查是否有 RESET 标志 (bit 4)
            boolean hasReset = (adrState & 0x10) != 0;
            
            // 如果有 VALID 标志，或者只有 RESET 标志但ADR值不为0，则尝试使用
            if (hasValid || (hasReset && Math.abs(adrMeters) > 0.1)) {
                // AccumulatedDeltaRangeMeters 是累积的载波相位距离（米）
                // 需要转换为周数：距离 / 波长
                double wavelength = 0.1903; // L1 波长（米）
                obs.carrierPhase = -adrMeters / wavelength;
                
                if (index < 3) {  // 只输出前3个卫星的详细信息
                    Log.d(TAG, String.format("载波相位: ADR=%.2f m, 周数=%.2f, 状态=0x%X (VALID=%b, RESET=%b)",
                        adrMeters, obs.carrierPhase, adrState, hasValid, hasReset));
                }
            } else {
                if (index < 3) {  // 只输出前3个卫星的详细信息
                    Log.d(TAG, String.format("载波相位跳过: ADR=%.2f m, 状态=0x%X (VALID=%b, RESET=%b)",
                        adrMeters, adrState, hasValid, hasReset));
                }
            }
            
            // 设置多普勒
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                obs.doppler = -measurement.getPseudorangeRateMetersPerSecond() / 0.1903; // 转换为 Hz
            }
            
            // 设置载噪比
            obs.cn0 = (float)measurement.getCn0DbHz();
            
            observations[index++] = obs;
        }
        
        // 修复 H6：裁剪 null 槽位，避免传给 JNI 的数组包含空元素
        RTKLibWrapper.GNSSObservation[] validObservations;
        if (index < measurementCount) {
            validObservations = new RTKLibWrapper.GNSSObservation[index];
            System.arraycopy(observations, 0, validObservations, 0, index);
        } else {
            validObservations = observations;
        }
        
        // 批量处理所有观测数据（一次性调用 RTK 解算）
        int result = rtkLibWrapper.processObsBatch(validObservations);
        
        // 如果解算成功，获取结果
        if (result == 0) {
            RTKLibWrapper.RTKSolution solution = rtkLibWrapper.getSolution();
            if (solution != null && positionListener != null) {
                JSObject position = new JSObject();
                position.put("latitude", solution.latitude);
                position.put("longitude", solution.longitude);
                position.put("altitude", solution.altitude);
                position.put("accuracy", solution.accuracy);
                position.put("fixType", getFixTypeName(solution.fixType));
                position.put("satelliteCount", solution.satelliteCount);
                position.put("age", solution.age);
                position.put("hdop", solution.hdop);
                position.put("timestamp", System.currentTimeMillis());
                
                positionListener.onPositionUpdate(position);
            }
        }
    }

    /**
     * 获取 RTK 状态
     */
    public JSObject getStatus() {
        RTKLibWrapper.RTKSolution solution = rtkLibWrapper.getSolution();
        int ephemerisCount = rtkLibWrapper.getEphemerisCount();
        
        // 调试日志：输出当前 satelliteCount 值
        Log.d(TAG, "getStatus() 调用: satelliteCount=" + satelliteCount);
        
        JSObject status = new JSObject();
        if (solution != null) {
            status.put("fixType", getFixTypeName(solution.fixType));
            status.put("satelliteCount", satelliteCount);  // 使用实时卫星数量
            status.put("age", solution.age);
            status.put("hdop", solution.hdop);
            status.put("vdop", solution.vdop);
            status.put("quality", getQuality(solution));
            status.put("satellitesWithEphemeris", ephemerisCount);
            status.put("ephemerisReady", ephemerisCount > 0);
        } else {
            status.put("fixType", "NONE");
            status.put("satelliteCount", satelliteCount);  // 使用实时卫星数量
            status.put("age", 0.0);
            status.put("hdop", 99.9);
            status.put("vdop", 99.9);
            status.put("quality", "poor");
            status.put("satellitesWithEphemeris", ephemerisCount);
            status.put("ephemerisReady", ephemerisCount > 0);
        }
        
        return status;
    }

    /**
     * 处理 RTCM 数据
     * 
     * 重要：RTCM 数据应该包含：
     * - 观测数据（1001-1004, 1009-1012 等）
     * - 星历数据（1019=GPS, 1020=GLONASS, 1042=BDS, 1044=QZSS, 1045/1046=Galileo）
     * 
     * 如果 CORS 不提供星历，RTK 将无法工作！
     */
    public void processRTCMData(byte[] data) {
        if (!isRunning) {
            return;
        }
        if (rtkLibWrapper != null) {
            int msgCount = rtkLibWrapper.decodeRTCM(data, data.length);
            if (msgCount > 0) {
                Log.d(TAG, "解码 RTCM 消息: " + msgCount + " 条");
            }
        }
    }

    /**
     * 获取固定解类型名称
     */
    private String getFixTypeName(int fixType) {
        switch (fixType) {
            case 0: return "NONE";
            case 1: return "FIXED";
            case 2: return "FLOAT";
            case 3: return "SBAS";
            case 4: return "DGPS";
            case 5: return "SPP";
            case 6: return "PPP";
            case 7: return "DR";
            default: return "UNKNOWN";
        }
    }

    /**
     * 评估定位质量（基于 HDOP 和 VDOP）
     */
    private String getQuality(RTKLibWrapper.RTKSolution solution) {
        // 使用 HDOP 和 VDOP 综合评估定位质量
        float hdop = solution.hdop;
        float vdop = solution.vdop;
        
        // 计算 PDOP（位置精度因子）的近似值
        float pdop = (float)Math.sqrt(hdop * hdop + vdop * vdop);
        
        // 固定解 + 优秀的 DOP 值
        if (solution.fixType == 1 && pdop < 2.0) {
            return "excellent";
        }
        // 固定解 + 良好的 DOP 值，或浮动解 + 优秀的 DOP 值
        else if ((solution.fixType == 1 && pdop < 4.0) || 
                 (solution.fixType == 2 && pdop < 2.0)) {
            return "good";
        }
        // 浮动解 + 可接受的 DOP 值，或单点定位 + 优秀的 DOP 值
        else if ((solution.fixType == 2 && pdop < 6.0) || 
                 (solution.fixType == 5 && pdop < 3.0)) {
            return "fair";
        }
        // 其他情况
        else {
            return "poor";
        }
    }

    /**
     * 获取 RTKLibWrapper 实例
     */
    public RTKLibWrapper getRTKLibWrapper() {
        return rtkLibWrapper;
    }

    /**
     * 设置星历状态监听器
     */
    public void setEphemerisStatusListener(EphemerisStatusListener listener) {
        this.ephemerisStatusListener = listener;
    }

    /**
     * 设置 RTK 状态更新监听器
     */
    public void setRTKStatusUpdateListener(RTKStatusUpdateListener listener) {
        this.rtkStatusUpdateListener = listener;
    }

    /**
     * 位置更新监听器接口
     */
    public interface PositionUpdateListener {
        void onPositionUpdate(JSObject position);
    }

    /**
     * 星历状态监听器接口
     */
    public interface EphemerisStatusListener {
        void onEphemerisLoading(boolean loading);
        void onEphemerisFailed(boolean failed);
    }

    /**
     * RTK 状态更新监听器接口
     */
    public interface RTKStatusUpdateListener {
        void onRTKStatusUpdate(JSObject status);
    }
}
