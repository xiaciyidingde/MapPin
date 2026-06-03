package com.mappin.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 注册插件
        registerPlugin(LogCollectorPlugin.class);
        registerPlugin(RTCMAnalyzerPlugin.class);
        registerPlugin(RTKPlugin.class);
        
        super.onCreate(savedInstanceState);
    }
}
