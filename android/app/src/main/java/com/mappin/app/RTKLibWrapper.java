package com.mappin.app;

import android.util.Log;

import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.RejectedExecutionException;

/**
 * JNI wrapper for RTKLIB.
 *
 * RTKLIB keeps mutable state in one native context. Android callbacks can arrive
 * from different threads, so every native call is serialized through this queue.
 */
public class RTKLibWrapper {
    private static final String TAG = "RTKLibWrapper";

    static {
        try {
            System.loadLibrary("rtklib");
            Log.i(TAG, "RTKLIB native library loaded");
        } catch (UnsatisfiedLinkError e) {
            Log.e(TAG, "Failed to load RTKLIB native library", e);
        }
    }

    private final ExecutorService nativeExecutor = Executors.newSingleThreadExecutor(r -> {
        Thread thread = new Thread(r, "RTKLib-Native");
        thread.setDaemon(true);
        return thread;
    });

    private long nativeHandle = 0;
    private volatile boolean released = false;

    public boolean init() {
        return callNative("init", false, () -> {
            if (nativeHandle != 0) {
                nativeDestroy(nativeHandle);
                nativeHandle = 0;
            }
            nativeHandle = nativeInit();
            return nativeHandle != 0;
        });
    }

    public void destroy() {
        callNative("destroy", null, () -> {
            if (nativeHandle != 0) {
                nativeDestroy(nativeHandle);
                nativeHandle = 0;
            }
            return null;
        });
    }

    public void release() {
        destroy();
        released = true;
        nativeExecutor.shutdown();
    }

    public int decodeRTCM(byte[] data, int length) {
        return callNative("decodeRTCM", -1, () -> {
            if (nativeHandle == 0) {
                Log.e(TAG, "RTKLIB is not initialized");
                return -1;
            }
            return nativeDecodeRTCM(nativeHandle, data, length);
        });
    }

    public int decodeNavigationMessage(byte[] data, int length) {
        return callNative("decodeNavigationMessage", -1, () -> {
            if (nativeHandle == 0) {
                Log.e(TAG, "RTKLIB is not initialized");
                return -1;
            }
            return nativeDecodeNavMessage(nativeHandle, data, length);
        });
    }

    public int loadRinexNav(byte[] data, int length) {
        return callNative("loadRinexNav", -1, () -> {
            if (nativeHandle == 0) {
                Log.e(TAG, "RTKLIB is not initialized");
                return -1;
            }
            return nativeLoadRinexNav(nativeHandle, data, length);
        });
    }

    public int loadSp3(byte[] data, int length) {
        return callNative("loadSp3", -1, () -> {
            if (nativeHandle == 0) {
                Log.e(TAG, "RTKLIB is not initialized");
                return -1;
            }
            return nativeLoadSp3(nativeHandle, data, length);
        });
    }

    public int processObs(GNSSObservation obs) {
        return callNative("processObs", -1, () -> {
            if (nativeHandle == 0) {
                Log.e(TAG, "RTKLIB is not initialized");
                return -1;
            }
            return nativeProcessObs(nativeHandle, obs);
        });
    }

    public int processObsBatch(GNSSObservation[] observations) {
        if (observations == null || observations.length == 0) {
            Log.w(TAG, "Observation batch is empty");
            return -1;
        }
        return callNative("processObsBatch", -1, () -> {
            if (nativeHandle == 0) {
                Log.e(TAG, "RTKLIB is not initialized");
                return -1;
            }
            return nativeProcessObsBatch(nativeHandle, observations);
        });
    }

    public RTKSolution getSolution() {
        return callNative("getSolution", (RTKSolution) null, () -> {
            if (nativeHandle == 0) {
                Log.e(TAG, "RTKLIB is not initialized");
                return null;
            }
            return nativeGetSolution(nativeHandle);
        });
    }

    public int getEphemerisCount() {
        return callNative("getEphemerisCount", 0, () -> {
            if (nativeHandle == 0) {
                Log.e(TAG, "RTKLIB is not initialized");
                return 0;
            }
            return nativeGetEphemerisCount(nativeHandle);
        });
    }

    private <T> T callNative(String operation, T fallback, Callable<T> task) {
        if (released) {
            Log.w(TAG, "Ignoring native call after release: " + operation);
            return fallback;
        }

        try {
            return nativeExecutor.submit(task).get();
        } catch (RejectedExecutionException e) {
            Log.w(TAG, "Native queue rejected operation: " + operation, e);
            return fallback;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            Log.w(TAG, "Native operation interrupted: " + operation, e);
            return fallback;
        } catch (Exception e) {
            Log.e(TAG, "Native operation failed: " + operation, e);
            return fallback;
        }
    }

    private native long nativeInit();
    private native void nativeDestroy(long handle);
    private native int nativeDecodeRTCM(long handle, byte[] data, int length);
    private native int nativeDecodeNavMessage(long handle, byte[] data, int length);
    private native int nativeLoadRinexNav(long handle, byte[] data, int length);
    private native int nativeLoadSp3(long handle, byte[] data, int length);
    private native int nativeProcessObs(long handle, GNSSObservation obs);
    private native int nativeProcessObsBatch(long handle, GNSSObservation[] observations);
    private native RTKSolution nativeGetSolution(long handle);
    private native int nativeGetEphemerisCount(long handle);

    public static class GNSSObservation {
        public long time;
        public int constellationType;
        public int satelliteId;
        public double pseudorange;
        public double carrierPhase;
        public double doppler;
        public float cn0;
    }

    public static class RTKSolution {
        public double latitude;
        public double longitude;
        public double altitude;
        public int fixType;
        public int satelliteCount;
        public float age;
        public float hdop;
        public float vdop;
        public float accuracy;
    }
}
