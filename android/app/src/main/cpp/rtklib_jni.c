/**
 * RTKLIB JNI 包装层
 * 提供 Java 和 RTKLIB C 代码之间的桥接
 */

#include <jni.h>
#include <android/log.h>
#include <stdlib.h>
#include <string.h>
#include <errno.h>
#include "rtklib/rtklib.h"

#define LOG_TAG "RTKLIB_JNI"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOGW(...) __android_log_print(ANDROID_LOG_WARN, LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)
#define LOGD(...) __android_log_print(ANDROID_LOG_DEBUG, LOG_TAG, __VA_ARGS__)

/**
 * RTK 上下文结构
 */
typedef struct {
    rtk_t rtk;          // RTK 解算器
    nav_t nav;          // 导航数据
    obs_t obs;          // 观测数据
    rtcm_t rtcm;        // RTCM 解码器
    sol_t sol;          // 解算结果
    prcopt_t prcopt;    // 处理选项
    solopt_t solopt;    // 输出选项
    
    // 消息统计
    int msg_count[4096]; // RTCM消息类型计数
    
    // GPS 子帧缓冲（用于累积导航消息）
    unsigned char subframe_buff[5][30]; // 5个子帧，每个30字节
    int subframe_flags;                  // 已接收的子帧标志（bit 0-4）

    // RTCM 1005/1006 base station position. rtkinit() clears rtk.rb, so keep
    // a copy and restore it after every mode reinitialization.
    double base_pos[3];
    int has_base_pos;

    // 上一次 rtkinit 时使用的处理模式，用于判断是否需要重新初始化滤波器
    // 0 = 未初始化，PMODE_DGPS / PMODE_SINGLE 等
    int last_mode;
} rtk_context_t;

/**
 * Android 常量定义（来自 GnssStatus.java）：
 *   CONSTELLATION_GPS      = 1
 *   CONSTELLATION_SBAS     = 2
 *   CONSTELLATION_GLONASS  = 3
 *   CONSTELLATION_QZSS     = 4
 *   CONSTELLATION_BEIDOU   = 5
 *   CONSTELLATION_GALILEO  = 6
 *   CONSTELLATION_IRNSS    = 7
 * 
 * RTKLIB 系统编号定义（来自 rtklib.h）：
 *   SYS_GPS = 0x01
 *   SYS_SBS = 0x02
 *   SYS_GLO = 0x04
 *   SYS_GAL = 0x08
 *   SYS_QZS = 0x10
 *   SYS_CMP = 0x20
 *   SYS_IRN = 0x40
 */
static int android_constellation_to_rtklib_sys(int constellation_type) {
    switch (constellation_type) {
        case 1: return SYS_GPS;  // GPS
        case 2: return SYS_SBS;  // SBAS
        case 3: return SYS_GLO;  // GLONASS
        case 4: return SYS_QZS;  // QZSS
        case 5: return SYS_CMP;  // BeiDou
        case 6: return SYS_GAL;  // Galileo
        case 7: return SYS_IRN;  // IRNSS
        default: return 0;       // 未知系统
    }
}

/**
 * Android 卫星 ID 转 RTKLIB 卫星编号
 * 注意：Android 的 svid 是各系统独立编号的，
 * RTKLIB 的 satno() 函数会根据系统类型和 PRN 号生成统一编号。
 *
 * @param constellation_type Android GnssStatus.CONSTELLATION_*
 * @param svid Android 卫星 ID（各系统独立编号）
 * @return RTKLIB 卫星编号（1-MAXSAT），失败返回 0
 */
static int android_svid_to_rtklib_sat(int constellation_type, int svid) {
    int sys = android_constellation_to_rtklib_sys(constellation_type);
    if (sys == 0) {
        return 0;  // 未知系统
    }
    
    // QZSS 特殊处理：Android svid 范围是 193-202，但 RTKLIB satno 期望 1-10
    int prn = svid;
    if (sys == SYS_QZS && svid >= 193) {
        prn = svid - 192;  // 193 → 1, 194 → 2, ..., 202 → 10
    }
    
    // 使用 RTKLIB 的 satno() 函数转换
    int sat = satno(sys, prn);
    
    // 验证范围
    if (sat < 1 || sat > MAXSAT) {
        LOGW("卫星编号超出范围: constellation=%d, svid=%d → sat=%d (MAXSAT=%d)",
             constellation_type, svid, sat, MAXSAT);
        return 0;
    }
    
    return sat;
}

/**
 * 按 (sat, iode) 去重添加 GPS/GAL/CMP 星历
 * 已存在则替换为新的（保证使用最新版本），不存在则追加
 * 防止 CORS RTCM 持续注入和导航消息解码导致 nav.eph[] 单调膨胀
 */
static void add_or_replace_eph(nav_t *nav, const eph_t *eph) {
    if (eph->sat <= 0) return;

    for (int i = 0; i < nav->n; i++) {
        if (nav->eph[i].sat == eph->sat && nav->eph[i].iode == eph->iode) {
            nav->eph[i] = *eph;
            return;
        }
    }

    /* 不存在 → 追加，必要时扩容 */
    if (nav->n >= nav->nmax) {
        int new_max = nav->nmax == 0 ? 128 : nav->nmax * 2;
        eph_t *new_eph = (eph_t *)realloc(nav->eph, sizeof(eph_t) * new_max);
        if (!new_eph) {
            LOGE("扩展星历数组失败");
            return;
        }
        nav->eph = new_eph;
        nav->nmax = new_max;
    }
    nav->eph[nav->n++] = *eph;
}

static void restore_base_position(rtk_context_t *ctx) {
    if (!ctx || !ctx->has_base_pos) {
        return;
    }

    ctx->prcopt.refpos = POSOPT_POS;
    for (int i = 0; i < 3; i++) {
        ctx->prcopt.rb[i] = ctx->base_pos[i];
        ctx->rtk.rb[i] = ctx->base_pos[i];
    }
}

static void reinit_rtk(rtk_context_t *ctx) {
    rtkinit(&ctx->rtk, &ctx->prcopt);
    restore_base_position(ctx);
}

/**
 * 初始化 RTK
 * 
 * @return RTK 上下文句柄（long 类型）
 */
JNIEXPORT jlong JNICALL
Java_com_mappin_app_RTKLibWrapper_nativeInit(JNIEnv *env, jobject obj) {
    LOGI("初始化 RTKLIB");
    
    // 分配上下文
    rtk_context_t *ctx = (rtk_context_t *)calloc(1, sizeof(rtk_context_t));
    if (!ctx) {
        LOGE("分配内存失败");
        return 0;
    }
    
    // 初始化导航数据
    ctx->nav.n = 0;
    ctx->nav.nmax = 0;
    ctx->nav.eph = NULL;
    
    // 初始化观测数据
    ctx->obs.n = 0;
    ctx->obs.nmax = 0;
    ctx->obs.data = NULL;
    
    // 初始化 RTCM 解码器
    init_rtcm(&ctx->rtcm);
    
    // 设置默认处理选项
    // 使用 DGPS 模式（差分定位，只需要伪距，不需要载波相位）
    // 因为设备不支持载波相位测量，无法使用 RTK 模式
    ctx->prcopt.mode = PMODE_DGPS;        // DGPS 差分模式（米级精度）
    ctx->prcopt.soltype = 0;              // 前向解
    ctx->prcopt.nf = 1;                   // 单频（L1）
    ctx->prcopt.navsys = SYS_GPS | SYS_GLO | SYS_GAL | SYS_CMP;  // 多系统
    ctx->prcopt.elmin = 15.0 * D2R;       // 最小高度角 15 度
    ctx->prcopt.ionoopt = IONOOPT_BRDC;   // 广播星历电离层改正
    ctx->prcopt.tropopt = TROPOPT_SAAS;   // Saastamoinen 对流层模型

    // 在 prcopt 配置完成后再初始化 RTK 滤波器
    // rtkinit 必须在 prcopt.mode 被设置之后调用，否则滤波器按默认模式初始化
    reinit_rtk(ctx);
    ctx->last_mode = ctx->prcopt.mode;

    LOGI("使用 DGPS 模式（设备不支持载波相位，无法使用 RTK），DGPS 失败时自动降级到 SPP");
    
    LOGI("RTKLIB 初始化成功，句柄: %p", ctx);
    return (jlong)ctx;
}

/**
 * 释放 RTK 资源
 * 
 * @param handle RTK 上下文句柄
 */
JNIEXPORT void JNICALL
Java_com_mappin_app_RTKLibWrapper_nativeDestroy(JNIEnv *env, jobject obj, jlong handle) {
    rtk_context_t *ctx = (rtk_context_t *)handle;
    if (!ctx) return;
    
    LOGI("释放 RTKLIB 资源");
    
    // 释放 RTK
    rtkfree(&ctx->rtk);
    
    // 释放导航数据
    if (ctx->nav.eph) free(ctx->nav.eph);
    
    // 释放观测数据
    if (ctx->obs.data) free(ctx->obs.data);
    
    // 释放 RTCM 解码器
    free_rtcm(&ctx->rtcm);
    
    // 释放上下文
    free(ctx);
    
    LOGI("RTKLIB 资源已释放");
}

/**
 * 解码 RTCM 数据
 * 
 * @param handle RTK 上下文句柄
 * @param data RTCM 数据字节数组
 * @param length 数据长度
 * @return 解码的消息数量
 */
JNIEXPORT jint JNICALL
Java_com_mappin_app_RTKLibWrapper_nativeDecodeRTCM(
    JNIEnv *env, jobject obj, jlong handle, jbyteArray data, jint length) {
    
    rtk_context_t *ctx = (rtk_context_t *)handle;
    if (!ctx) {
        LOGE("无效的句柄");
        return -1;
    }
    
    // 获取字节数组
    jbyte *bytes = (*env)->GetByteArrayElements(env, data, NULL);
    if (!bytes) {
        LOGE("获取字节数组失败");
        return -1;
    }
    
    int msg_count = 0;
    
    // 逐字节解码
    for (int i = 0; i < length; i++) {
        int ret = input_rtcm3(&ctx->rtcm, (unsigned char)bytes[i]);
        if (ret > 0) {
            // 解码成功一条消息
            msg_count++;
            
            // 记录消息类型
            int msg_type = getbitu(ctx->rtcm.buff, 24, 12);
            ctx->msg_count[msg_type]++;
            
            // 每10条消息输出一次统计
            if (msg_count % 10 == 0) {
                LOGI("RTCM消息统计: 1004=%d, 1012=%d, 1019=%d, 1020=%d, 1042=%d, 1044=%d",
                     ctx->msg_count[1004], ctx->msg_count[1012],
                     ctx->msg_count[1019], ctx->msg_count[1020],
                     ctx->msg_count[1042], ctx->msg_count[1044]);
            }
            
            LOGI("收到 RTCM 消息: 类型=%d", msg_type);
            
            // 更新导航数据（星历）
            if (ctx->rtcm.ephsat > 0 && ctx->rtcm.nav.n > 0) {
                // 按 (sat, iode) 去重添加，避免 nav.eph[] 单调膨胀
                int added = 0;
                int before = ctx->nav.n;
                for (int j = 0; j < ctx->rtcm.nav.n; j++) {
                    add_or_replace_eph(&ctx->nav, &ctx->rtcm.nav.eph[j]);
                }
                added = ctx->nav.n - before;
                LOGI("更新星历数据: 卫星 %d, 新增=%d, 总星历数=%d", 
                     ctx->rtcm.ephsat, added, ctx->nav.n);
            } else if (ret > 0) {
                // 收到消息但没有星历
                int msg_type = getbitu(ctx->rtcm.buff, 24, 12);
                if (msg_type == 1019 || msg_type == 1020 || msg_type == 1042 || msg_type == 1044) {
                    LOGW("收到星历消息 %d 但未解析: ephsat=%d, nav.n=%d", 
                         msg_type, ctx->rtcm.ephsat, ctx->rtcm.nav.n);
                }
            }
            
            // 更新观测数据（基站观测值）
            if (ctx->rtcm.obs.n > 0) {
                // 保存基站观测数据用于 RTK 解算
                // 每次收到新的观测数据时，替换旧数据（而不是累积）
                if (ctx->rtcm.obs.n > ctx->obs.nmax) {
                    ctx->obs.nmax = ctx->rtcm.obs.n + 128;
                    obsd_t *new_data = (obsd_t *)realloc(ctx->obs.data, sizeof(obsd_t) * ctx->obs.nmax);
                    if (!new_data) {
                        LOGE("分配观测数据内存失败");
                    } else {
                        ctx->obs.data = new_data;
                    }
                }
                
                // 替换为最新的观测数据，同时过滤无效观测
                ctx->obs.n = 0;
                int filtered = 0;
                for (int j = 0; j < ctx->rtcm.obs.n; j++) {
                    obsd_t *obs = &ctx->rtcm.obs.data[j];
                    
                    // P2 修复：过滤伪距=0或非法卫星号的观测
                    if (obs->sat == 0) {
                        filtered++;
                        continue;
                    }
                    if (obs->P[0] <= 0.0) {
                        filtered++;
                        continue;
                    }
                    
                    ctx->obs.data[ctx->obs.n++] = *obs;
                }
                
                if (filtered > 0) {
                    LOGW("过滤了 %d 个无效基站观测（sat=0 或 P=0）", filtered);
                }
                LOGI("更新基站观测数据: %d 个观测值, 总观测数=%d", 
                     ctx->rtcm.obs.n, ctx->obs.n);
            }
            
            // 更新基站位置（从RTCM 1005/1006消息）
            if (msg_type == 1005 || msg_type == 1006) {
                // 检查基站位置是否有效
                double pos_norm = norm(ctx->rtcm.sta.pos, 3);
                if (pos_norm > 0.0) {
                    // 设置基站位置到RTK上下文
                    for (int j = 0; j < 3; j++) {
                        ctx->base_pos[j] = ctx->rtcm.sta.pos[j];
                        ctx->prcopt.rb[j] = ctx->rtcm.sta.pos[j];
                        ctx->rtk.rb[j] = ctx->rtcm.sta.pos[j];
                    }
                    ctx->has_base_pos = 1;
                    ctx->prcopt.refpos = POSOPT_POS;
                    LOGI("更新基站位置: X=%.3f, Y=%.3f, Z=%.3f (站点ID=%s)", 
                         ctx->rtk.rb[0], ctx->rtk.rb[1], ctx->rtk.rb[2], ctx->rtcm.sta.name);
                }
            }
        }
    }
    
    // 释放字节数组
    (*env)->ReleaseByteArrayElements(env, data, bytes, JNI_ABORT);
    
    if (msg_count > 0) {
        LOGI("解码 RTCM 消息: %d 条, 当前星历数=%d, 基站观测数=%d", 
             msg_count, ctx->nav.n, ctx->obs.n);
    }
    
    return msg_count;
}

/**
 * 解码导航消息（广播星历）
 * 
 * @param handle RTK 上下文句柄
 * @param data 导航消息数据
 * @param length 数据长度
 * @return 解码的星历数量
 */
JNIEXPORT jint JNICALL
Java_com_mappin_app_RTKLibWrapper_nativeDecodeNavMessage(
    JNIEnv *env, jobject obj, jlong handle, jbyteArray data, jint length) {
    
    rtk_context_t *ctx = (rtk_context_t *)handle;
    if (!ctx) {
        LOGE("无效的句柄");
        return -1;
    }
    
    // 获取字节数组
    jbyte *bytes = (*env)->GetByteArrayElements(env, data, NULL);
    if (!bytes) {
        LOGE("获取字节数组失败");
        return -1;
    }
    
    int old_eph_count = ctx->nav.n;
    
    // 初始化星历数组（如果还没有）
    if (ctx->nav.eph == NULL) {
        ctx->nav.nmax = 128;
        ctx->nav.eph = (eph_t *)calloc(ctx->nav.nmax, sizeof(eph_t));
        if (!ctx->nav.eph) {
            LOGE("分配星历内存失败");
            (*env)->ReleaseByteArrayElements(env, data, bytes, JNI_ABORT);
            return -1;
        }
    }
    
    // Android 导航消息通常是 GPS 子帧格式（30字节）
    // 尝试使用 RTKLIB 的 decode_frame 函数解码
    if (length >= 30) {
        unsigned char buff[30];
        for (int i = 0; i < 30 && i < length; i++) {
            buff[i] = (unsigned char)bytes[i];
        }
        
        eph_t eph = {0};
        alm_t alm = {0};
        double ion[8] = {0};
        double utc[8] = {0};
        
        // decode_frame 返回子帧ID (1-5)
        int subfrm_id = decode_frame(buff, &eph, &alm, ion, utc);
        
        if (subfrm_id >= 1 && subfrm_id <= 5) {
            LOGI("解码 GPS 子帧 %d", subfrm_id);
            
            // 保存子帧到缓冲区
            memcpy(ctx->subframe_buff[subfrm_id - 1], buff, 30);
            ctx->subframe_flags |= (1 << (subfrm_id - 1));
            
            // 检查是否收集齐了子帧 1/2/3（星历数据）
            if ((ctx->subframe_flags & 0x07) == 0x07) {
                // 已收集齐子帧 1/2/3，尝试解码完整星历
                eph_t complete_eph = {0};
                
                // 重新解码子帧 1/2/3
                decode_frame(ctx->subframe_buff[0], &complete_eph, NULL, NULL, NULL);
                decode_frame(ctx->subframe_buff[1], &complete_eph, NULL, NULL, NULL);
                decode_frame(ctx->subframe_buff[2], &complete_eph, NULL, NULL, NULL);
                
                // 检查星历是否有效
                if (complete_eph.sat > 0) {
                    // 按 (sat, iode) 去重添加
                    int before = ctx->nav.n;
                    add_or_replace_eph(&ctx->nav, &complete_eph);
                    int added = ctx->nav.n - before;

                    LOGI("解码 GPS 星历: 卫星 %d, %s, 总星历数=%d",
                         complete_eph.sat,
                         added > 0 ? "新增" : "替换",
                         ctx->nav.n);
                    
                    // 清除子帧标志，准备接收下一颗卫星的星历
                    ctx->subframe_flags = 0;
                }
            }
        } else {
            LOGW("导航消息解码失败: subfrm_id=%d, length=%d", subfrm_id, length);
        }
    } else {
        LOGW("导航消息长度不足: length=%d (需要至少30字节)", length);
    }
    
    // 释放字节数组
    (*env)->ReleaseByteArrayElements(env, data, bytes, JNI_ABORT);
    
    int eph_count = ctx->nav.n - old_eph_count;
    return eph_count;
}

/**
 * 处理 GNSS 观测值
 * 
 * @param handle RTK 上下文句柄
 * @param obsData 观测数据对象（Java）
 * @return 处理结果（0: 成功，-1: 失败）
 */
JNIEXPORT jint JNICALL
Java_com_mappin_app_RTKLibWrapper_nativeProcessObs(
    JNIEnv *env, jobject obj, jlong handle, jobject obsData) {
    
    rtk_context_t *ctx = (rtk_context_t *)handle;
    if (!ctx) {
        LOGE("无效的句柄");
        return -1;
    }
    
    // 获取 GNSSObservation 类
    jclass obsClass = (*env)->GetObjectClass(env, obsData);
    if (!obsClass) {
        LOGE("获取 GNSSObservation 类失败");
        return -1;
    }
    
    // 获取字段 ID
    jfieldID timeField = (*env)->GetFieldID(env, obsClass, "time", "J");
    jfieldID satIdField = (*env)->GetFieldID(env, obsClass, "satelliteId", "I");
    jfieldID pseudorangeField = (*env)->GetFieldID(env, obsClass, "pseudorange", "D");
    jfieldID carrierPhaseField = (*env)->GetFieldID(env, obsClass, "carrierPhase", "D");
    jfieldID dopplerField = (*env)->GetFieldID(env, obsClass, "doppler", "D");
    jfieldID cn0Field = (*env)->GetFieldID(env, obsClass, "cn0", "F");
    
    if (!timeField || !satIdField || !pseudorangeField || 
        !carrierPhaseField || !dopplerField || !cn0Field) {
        LOGE("获取字段 ID 失败");
        return -1;
    }
    
    // 提取观测数据
    jlong time = (*env)->GetLongField(env, obsData, timeField);
    jint satId = (*env)->GetIntField(env, obsData, satIdField);
    jdouble pseudorange = (*env)->GetDoubleField(env, obsData, pseudorangeField);
    jdouble carrierPhase = (*env)->GetDoubleField(env, obsData, carrierPhaseField);
    jdouble doppler = (*env)->GetDoubleField(env, obsData, dopplerField);
    jfloat cn0 = (*env)->GetFloatField(env, obsData, cn0Field);
    
    // 创建 RTKLIB 观测数据
    obsd_t obs_rover = {0};
    
    // 设置时间（GPS 时间）
    obs_rover.time.time = (time_t)(time / 1000);
    obs_rover.time.sec = (time % 1000) / 1000.0;
    
    // 设置卫星号
    obs_rover.sat = (uint8_t)satId;
    obs_rover.rcv = 1; // 流动站
    
    // 设置观测值（L1 频率）
    obs_rover.P[0] = pseudorange;           // 伪距
    obs_rover.L[0] = carrierPhase;          // 载波相位
    obs_rover.D[0] = (float)doppler;        // 多普勒
    obs_rover.SNR[0] = (uint16_t)(cn0 * 1000); // 载噪比（转换为 0.001 dBHz）
    obs_rover.code[0] = CODE_L1C;           // L1C/A 码
    obs_rover.LLI[0] = 0;                   // 无周跳
    
    // 执行 RTK 解算
    // 需要流动站观测值 + 基站观测值（来自 RTCM）+ 星历
    if (ctx->obs.n > 0 && ctx->nav.n > 0) {
        // 准备观测数据数组
        obs_t obs_all = {0};
        obs_all.n = 1 + ctx->obs.n; // 流动站 + 基站
        obs_all.data = (obsd_t *)malloc(sizeof(obsd_t) * obs_all.n);
        if (!obs_all.data) {
            LOGE("分配观测数据内存失败");
            return -1;
        }
        
        // 第一个是流动站观测值
        obs_all.data[0] = obs_rover;
        
        // 后面是基站观测值
        for (int i = 0; i < ctx->obs.n; i++) {
            obs_all.data[i + 1] = ctx->obs.data[i];
        }
        
        // 执行 RTK 定位解算
        int result = rtkpos(&ctx->rtk, obs_all.data, obs_all.n, &ctx->nav);
        
        // 保存解算结果
        if (result) {
            ctx->sol = ctx->rtk.sol;
            LOGI("RTK 解算成功: 状态=%d, 卫星数=%d", ctx->sol.stat, ctx->sol.ns);
        } else {
            LOGE("RTK 解算失败");
        }
        
        // 释放临时内存
        free(obs_all.data);
        
        // 清空基站观测数据（已使用）
        ctx->obs.n = 0;
        
        return result ? 0 : -1;
    } else {
        LOGI("等待基站数据或星历: 基站观测=%d, 星历=%d", ctx->obs.n, ctx->nav.n);
        return -1;
    }
}

/**
 * 批量处理 GNSS 观测数据
 * 
 * 策略：每帧双尝试降级
 *   1. 若有基站观测 + 基站位置有效 → 优先尝试 DGPS 解算
 *   2. DGPS 失败或无基站数据 → 自动降级到 SPP 单点定位
 *   3. 两种模式都成功返回 0；都失败返回 -1
 * 
 * @param handle RTK 上下文句柄
 * @param observationsArray 观测数据数组（Java）
 * @return 处理结果（0: 成功，-1: 失败）
 */
JNIEXPORT jint JNICALL
Java_com_mappin_app_RTKLibWrapper_nativeProcessObsBatch(
    JNIEnv *env, jobject obj, jlong handle, jobjectArray observationsArray) {
    
    rtk_context_t *ctx = (rtk_context_t *)handle;
    if (!ctx) {
        LOGE("无效的句柄");
        return -1;
    }
    
    // 获取数组长度
    jsize arrayLen = (*env)->GetArrayLength(env, observationsArray);
    if (arrayLen == 0) {
        LOGW("观测数据数组为空");
        return -1;
    }
    
    // P5 修复：检查是否有可用星历（广播或精密）
    int total_eph_early = ctx->nav.n + ctx->nav.ne;
    if (total_eph_early == 0) {
        LOGI("等待星历数据: 广播星历=%d, 精密星历=%d", ctx->nav.n, ctx->nav.ne);
        return -1;
    }
    
    // 获取第一个非空元素以获取类信息
    jobject firstObs = NULL;
    for (int i = 0; i < arrayLen; i++) {
        firstObs = (*env)->GetObjectArrayElement(env, observationsArray, i);
        if (firstObs) break;
    }
    if (!firstObs) {
        LOGE("观测数据数组全为空");
        return -1;
    }
    
    jclass obsClass = (*env)->GetObjectClass(env, firstObs);
    if (!obsClass) {
        LOGE("获取 GNSSObservation 类失败");
        (*env)->DeleteLocalRef(env, firstObs);
        return -1;
    }
    
    jfieldID timeField = (*env)->GetFieldID(env, obsClass, "time", "J");
    jfieldID constellationTypeField = (*env)->GetFieldID(env, obsClass, "constellationType", "I");  // P3 修复
    jfieldID satIdField = (*env)->GetFieldID(env, obsClass, "satelliteId", "I");
    jfieldID pseudorangeField = (*env)->GetFieldID(env, obsClass, "pseudorange", "D");
    jfieldID carrierPhaseField = (*env)->GetFieldID(env, obsClass, "carrierPhase", "D");
    jfieldID dopplerField = (*env)->GetFieldID(env, obsClass, "doppler", "D");
    jfieldID cn0Field = (*env)->GetFieldID(env, obsClass, "cn0", "F");
    (*env)->DeleteLocalRef(env, firstObs);
    
    if (!timeField || !constellationTypeField || !satIdField || !pseudorangeField || 
        !carrierPhaseField || !dopplerField || !cn0Field) {
        LOGE("获取字段 ID 失败");
        return -1;
    }
    
    // 提取移动站观测值（紧凑数组，跳过 null 槽位）
    obsd_t *rover_obs = (obsd_t *)calloc(arrayLen, sizeof(obsd_t));
    if (!rover_obs) {
        LOGE("分配移动站观测数据内存失败");
        return -1;
    }
    
    int rover_n = 0;
    for (int i = 0; i < arrayLen; i++) {
        jobject obsData = (*env)->GetObjectArrayElement(env, observationsArray, i);
        if (!obsData) continue;
        
        jlong time = (*env)->GetLongField(env, obsData, timeField);
        jint constellationType = (*env)->GetIntField(env, obsData, constellationTypeField);  // P3 修复
        jint satId = (*env)->GetIntField(env, obsData, satIdField);
        jdouble pseudorange = (*env)->GetDoubleField(env, obsData, pseudorangeField);
        jdouble carrierPhase = (*env)->GetDoubleField(env, obsData, carrierPhaseField);
        jdouble doppler = (*env)->GetDoubleField(env, obsData, dopplerField);
        jfloat cn0 = (*env)->GetFloatField(env, obsData, cn0Field);
        
        // 使用正确的卫星编号映射
        int rtklib_sat = android_svid_to_rtklib_sat(constellationType, satId);
        if (rtklib_sat == 0) {
            // 映射失败，跳过这个观测
            (*env)->DeleteLocalRef(env, obsData);
            continue;
        }
        
        // 过滤无效伪距
        if (pseudorange <= 0.0 || pseudorange < 20000000.0 || pseudorange > 30000000.0) {
            (*env)->DeleteLocalRef(env, obsData);
            continue;
        }
        
        obsd_t *obs_rover = &rover_obs[rover_n];
        obs_rover->time.time = (time_t)(time / 1000);
        obs_rover->time.sec = (time % 1000) / 1000.0;
        obs_rover->sat = (uint8_t)rtklib_sat;  // 使用映射后的卫星编号
        obs_rover->rcv = 1;
        obs_rover->P[0] = pseudorange;
        obs_rover->L[0] = carrierPhase;
        obs_rover->D[0] = (float)doppler;
        obs_rover->SNR[0] = (uint16_t)(cn0 * 1000);
        obs_rover->code[0] = CODE_L1C;
        obs_rover->LLI[0] = 0;
        
        (*env)->DeleteLocalRef(env, obsData);
        rover_n++;
    }
    
    // 检查广播星历和精密星历
    int total_eph = ctx->nav.n + ctx->nav.ne;
    LOGI("有效移动站观测值: %d / %d, 广播星历=%d, 精密星历=%d, 总星历=%d, 基站观测=%d", 
         rover_n, arrayLen, ctx->nav.n, ctx->nav.ne, total_eph, ctx->obs.n);
    
    // 单点定位至少需要 4 颗卫星
    if (rover_n < 4) {
        LOGW("移动站有效观测不足（%d < 4），跳过解算", rover_n);
        free(rover_obs);
        return -1;
    }
    
    // 检查是否有可用星历（广播或精密）
    if (total_eph == 0) {
        LOGI("等待星历数据: 广播星历=%d, 精密星历=%d", ctx->nav.n, ctx->nav.ne);
        free(rover_obs);
        return -1;
    }
    
    // 判断 DGPS 是否可行
    double base_norm = norm(ctx->rtk.rb, 3);
    int has_base = (ctx->obs.n > 0 && base_norm > 1000.0);
    
    // ============================================================
    // 第一尝试：DGPS
    // ============================================================
    if (has_base) {
        // 如果上次不是 DGPS 模式，重置滤波器
        if (ctx->last_mode != PMODE_DGPS) {
            ctx->prcopt.mode = PMODE_DGPS;
            reinit_rtk(ctx);
            ctx->last_mode = PMODE_DGPS;
            LOGI("切换到 DGPS 模式（重置滤波器）");
        }
        
        // 拼接 obs_all = 移动站 + 基站
        int total = rover_n + ctx->obs.n;
        obsd_t *obs_all_data = (obsd_t *)malloc(sizeof(obsd_t) * total);
        if (!obs_all_data) {
            LOGE("分配 DGPS 观测数据内存失败");
            free(rover_obs);
            return -1;
        }
        memcpy(obs_all_data, rover_obs, sizeof(obsd_t) * rover_n);
        memcpy(obs_all_data + rover_n, ctx->obs.data, sizeof(obsd_t) * ctx->obs.n);
        
        LOGI("DGPS 解算: 移动站=%d, 基站=%d, 基站位置范数=%.1f m",
             rover_n, ctx->obs.n, base_norm);
        
        int result = rtkpos(&ctx->rtk, obs_all_data, total, &ctx->nav);
        free(obs_all_data);
        
        if (result && ctx->rtk.sol.stat != SOLQ_NONE) {
            ctx->sol = ctx->rtk.sol;
            LOGI("DGPS 解算成功: 状态=%d, 卫星数=%d, 纬度=%.8f, 经度=%.8f",
                 ctx->sol.stat, ctx->sol.ns,
                 ctx->sol.rr[0] * R2D, ctx->sol.rr[1] * R2D);
            free(rover_obs);
            return 0;
        }
        
        LOGW("DGPS 解算失败（状态=%d, 卫星数=%d），降级到 SPP",
             ctx->rtk.sol.stat, ctx->rtk.sol.ns);
    } else {
        LOGI("无可用基站数据（obs.n=%d, base_norm=%.1f），直接走 SPP",
             ctx->obs.n, base_norm);
    }
    
    // ============================================================
    // 第二尝试 / 兜底：SPP 单点定位
    // ============================================================
    if (ctx->last_mode != PMODE_SINGLE) {
        ctx->prcopt.mode = PMODE_SINGLE;
        reinit_rtk(ctx);
        ctx->last_mode = PMODE_SINGLE;
        LOGI("切换到 SPP 模式（重置滤波器）");
    }
    
    int result = rtkpos(&ctx->rtk, rover_obs, rover_n, &ctx->nav);
    
    if (result && ctx->rtk.sol.stat != SOLQ_NONE) {
        ctx->sol = ctx->rtk.sol;
        LOGI("SPP 解算成功: 状态=%d, 卫星数=%d, 纬度=%.8f, 经度=%.8f",
             ctx->sol.stat, ctx->sol.ns,
             ctx->sol.rr[0] * R2D, ctx->sol.rr[1] * R2D);
        free(rover_obs);
        return 0;
    }
    
    LOGW("SPP 解算也失败: 状态=%d, 卫星数=%d", 
         ctx->rtk.sol.stat, ctx->rtk.sol.ns);
    free(rover_obs);
    return -1;
}

/**
 * 获取 RTK 解算结果
 * 
 * @param handle RTK 上下文句柄
 * @return RTK 解算结果对象（Java）
 */
JNIEXPORT jobject JNICALL
Java_com_mappin_app_RTKLibWrapper_nativeGetSolution(
    JNIEnv *env, jobject obj, jlong handle) {
    
    rtk_context_t *ctx = (rtk_context_t *)handle;
    if (!ctx) {
        LOGE("无效的句柄");
        return NULL;
    }
    
    // 获取 RTKSolution 类
    jclass solutionClass = (*env)->FindClass(env, "com/mappin/app/RTKLibWrapper$RTKSolution");
    if (!solutionClass) {
        LOGE("找不到 RTKSolution 类");
        return NULL;
    }
    
    // 获取构造函数
    jmethodID constructor = (*env)->GetMethodID(env, solutionClass, "<init>", "()V");
    if (!constructor) {
        LOGE("找不到 RTKSolution 构造函数");
        return NULL;
    }
    
    // 创建 RTKSolution 对象
    jobject solution = (*env)->NewObject(env, solutionClass, constructor);
    if (!solution) {
        LOGE("创建 RTKSolution 对象失败");
        return NULL;
    }
    
    // 获取字段 ID
    jfieldID latField = (*env)->GetFieldID(env, solutionClass, "latitude", "D");
    jfieldID lonField = (*env)->GetFieldID(env, solutionClass, "longitude", "D");
    jfieldID altField = (*env)->GetFieldID(env, solutionClass, "altitude", "D");
    jfieldID fixTypeField = (*env)->GetFieldID(env, solutionClass, "fixType", "I");
    jfieldID satCountField = (*env)->GetFieldID(env, solutionClass, "satelliteCount", "I");
    jfieldID ageField = (*env)->GetFieldID(env, solutionClass, "age", "F");
    jfieldID hdopField = (*env)->GetFieldID(env, solutionClass, "hdop", "F");
    jfieldID vdopField = (*env)->GetFieldID(env, solutionClass, "vdop", "F");
    jfieldID accuracyField = (*env)->GetFieldID(env, solutionClass, "accuracy", "F");
    
    if (!latField || !lonField || !altField || !fixTypeField || 
        !satCountField || !ageField || !hdopField || !vdopField || !accuracyField) {
        LOGE("获取字段 ID 失败");
        return NULL;
    }
    
    // 将 ECEF 坐标转换为 LLH（纬度/经度/高程）
    double pos[3] = {0};
    if (ctx->sol.stat != SOLQ_NONE) {
        ecef2pos(ctx->sol.rr, pos);
    }
    
    // 计算精度（使用协方差矩阵）
    float accuracy = 0.0f;
    if (ctx->sol.stat != SOLQ_NONE) {
        // 水平精度 = sqrt(qr[0]^2 + qr[1]^2)
        accuracy = (float)sqrt(ctx->sol.qr[0] * ctx->sol.qr[0] + 
                              ctx->sol.qr[1] * ctx->sol.qr[1]);
    }
    
    // 计算真实的 DOP 值
    float hdop = 99.9f;
    float vdop = 99.9f;
    if (ctx->sol.ns >= 4 && ctx->obs.n > 0) {
        // 准备卫星方位角和仰角数据
        double azel[MAXOBS * 2];
        int ns = 0;
        
        // 从观测数据中提取卫星方位角和仰角
        for (int i = 0; i < ctx->obs.n && i < MAXOBS; i++) {
            obsd_t *obs = &ctx->obs.data[i];
            if (obs->sat == 0) continue;
            
            // 计算卫星位置和方位角/仰角
            double rs[6], dts[2], var;
            int svh;
            
            if (!satpos(obs->time, obs->time, obs->sat, EPHOPT_BRDC, 
                       &ctx->nav, rs, dts, &var, &svh)) {
                continue;
            }
            
            // 计算方位角和仰角
            double e[3], r;
            geodist(rs, ctx->sol.rr, e);
            satazel(pos, e, &azel[ns * 2]);
            
            ns++;
        }
        
        // 使用 RTKLIB 的 dops() 函数计算真实的 DOP 值
        if (ns >= 4) {
            double dop[4] = {0}; // GDOP, PDOP, HDOP, VDOP
            dops(ns, azel, 0.0, dop);
            
            if (dop[2] > 0.0 && dop[2] < 50.0) {
                hdop = (float)dop[2]; // HDOP
            }
            if (dop[3] > 0.0 && dop[3] < 50.0) {
                vdop = (float)dop[3]; // VDOP
            }
            
            LOGI("DOP 计算: GDOP=%.2f, PDOP=%.2f, HDOP=%.2f, VDOP=%.2f (卫星数=%d)", 
                 dop[0], dop[1], dop[2], dop[3], ns);
        }
    }
    
    // 设置字段值
    (*env)->SetDoubleField(env, solution, latField, pos[0] * R2D); // 转换为度
    (*env)->SetDoubleField(env, solution, lonField, pos[1] * R2D); // 转换为度
    (*env)->SetDoubleField(env, solution, altField, pos[2]);
    (*env)->SetIntField(env, solution, fixTypeField, (jint)ctx->sol.stat);
    (*env)->SetIntField(env, solution, satCountField, (jint)ctx->sol.ns);
    (*env)->SetFloatField(env, solution, ageField, ctx->sol.age);
    (*env)->SetFloatField(env, solution, hdopField, hdop);
    (*env)->SetFloatField(env, solution, vdopField, vdop);
    (*env)->SetFloatField(env, solution, accuracyField, accuracy);
    
    LOGI("返回 RTK 解算结果: 状态=%d, 纬度=%.8f, 经度=%.8f, 精度=%.2fm, HDOP=%.2f, VDOP=%.2f", 
         ctx->sol.stat, pos[0] * R2D, pos[1] * R2D, accuracy, hdop, vdop);
    
    return solution;
}

/**
 * 加载 RINEX 导航文件（从网络下载的星历）
 * 
 * @param handle RTK 上下文句柄
 * @param data RINEX 导航文件数据
 * @param length 数据长度
 * @return 加载的星历数量
 */
JNIEXPORT jint JNICALL
Java_com_mappin_app_RTKLibWrapper_nativeLoadRinexNav(JNIEnv *env, jobject obj, 
                                                      jlong handle, jbyteArray data, jint length) {
    rtk_context_t *ctx = (rtk_context_t *)handle;
    if (!ctx) {
        LOGE("无效的句柄");
        return -1;
    }
    
    if (!data || length <= 0) {
        LOGE("无效的数据");
        return -1;
    }
    
    LOGI("========================================");
    LOGI("开始加载 RINEX 导航文件...");
    LOGI("数据大小: %d 字节", length);
    
    // 获取 Java 字节数组
    jbyte *bytes = (*env)->GetByteArrayElements(env, data, NULL);
    if (!bytes) {
        LOGE("获取数据失败");
        return -1;
    }
    
    // 将数据写入临时文件（RTKLIB 的 readrnxnav 需要文件路径）
    // Android 应用的私有目录
    const char *temp_file = "/data/data/com.mappin.app/cache/temp_nav.rnx";
    
    LOGI("尝试创建临时文件: %s", temp_file);
    FILE *fp = fopen(temp_file, "wb");
    if (!fp) {
        LOGW("第一个路径失败，尝试备用路径...");
        // 尝试使用应用的文件目录
        temp_file = "/data/user/0/com.mappin.app/cache/temp_nav.rnx";
        LOGI("尝试备用路径: %s", temp_file);
        fp = fopen(temp_file, "wb");
        if (!fp) {
            LOGE("创建临时文件失败: %s", temp_file);
            LOGE("错误代码: %d (%s)", errno, strerror(errno));
            (*env)->ReleaseByteArrayElements(env, data, bytes, JNI_ABORT);
            return -1;
        }
    }
    
    LOGI("临时文件创建成功: %s", temp_file);
    LOGI("开始写入 %d 字节数据...", length);
    LOGI("临时文件创建成功: %s", temp_file);
    LOGI("开始写入 %d 字节数据...", length);
    
    size_t written = fwrite(bytes, 1, length, fp);
    fclose(fp);
    
    if (written != length) {
        LOGE("写入文件失败: 期望 %d 字节，实际写入 %zu 字节", length, written);
        (*env)->ReleaseByteArrayElements(env, data, bytes, JNI_ABORT);
        remove(temp_file);
        return -1;
    }
    
    LOGI("数据写入成功: %zu 字节", written);
    
    (*env)->ReleaseByteArrayElements(env, data, bytes, JNI_ABORT);
    
    // 记录加载前的星历数量
    int old_eph_count = ctx->nav.n;
    int old_geph_count = ctx->nav.ng;
    
    // 使用 RTKLIB 的 readrnx 函数读取 RINEX 导航文件
    // readrnx 是通用函数，可以自动识别文件类型（观测文件或导航文件）
    LOGI("开始解析 RINEX 导航文件: %s", temp_file);
    int result = readrnx(temp_file, 0, "", NULL, &ctx->nav, NULL);
    
    LOGI("readrnx 返回值: %d", result);
    
    // 删除临时文件
    remove(temp_file);
    
    if (result == 0) {
        LOGE("读取 RINEX 导航文件失败");
        return 0;
    }
    
    // 计算新增的星历数量
    int new_gps_eph = ctx->nav.n - old_eph_count;
    int new_glo_eph = ctx->nav.ng - old_geph_count;
    int total_new = new_gps_eph + new_glo_eph;
    
    LOGI("成功加载 RINEX 导航文件");
    LOGI("GPS 星历: %d 个 (新增 %d)", ctx->nav.n, new_gps_eph);
    LOGI("GLONASS 星历: %d 个 (新增 %d)", ctx->nav.ng, new_glo_eph);
    LOGI("总计新增: %d 个星历", total_new);
    LOGI("========================================");
    
    return (jint)total_new;
}

/**
 * 加载 SP3 精密星历文件（CAS Ultra-rapid 等）
 * 与 RINEX 广播星历不同，SP3 加载到 nav.peph[]，需要切换 sateph = EPHOPT_PREC
 *
 * @param handle RTK 上下文句柄
 * @param data SP3 文件数据
 * @param length 数据长度
 * @return 加载的精密星历记录数（>0 成功，0/负值失败）
 */
JNIEXPORT jint JNICALL
Java_com_mappin_app_RTKLibWrapper_nativeLoadSp3(JNIEnv *env, jobject obj,
                                                  jlong handle, jbyteArray data, jint length) {
    rtk_context_t *ctx = (rtk_context_t *)handle;
    if (!ctx) {
        LOGE("无效的句柄");
        return -1;
    }

    if (!data || length <= 0) {
        LOGE("无效的数据");
        return -1;
    }

    LOGI("========================================");
    LOGI("开始加载 SP3 精密星历文件...");
    LOGI("数据大小: %d 字节", length);

    jbyte *bytes = (*env)->GetByteArrayElements(env, data, NULL);
    if (!bytes) {
        LOGE("获取数据失败");
        return -1;
    }

    /* 写入临时文件（readsp3 需要文件路径） */
    const char *temp_file = "/data/data/com.mappin.app/cache/temp_orb.sp3";
    FILE *fp = fopen(temp_file, "wb");
    if (!fp) {
        temp_file = "/data/user/0/com.mappin.app/cache/temp_orb.sp3";
        fp = fopen(temp_file, "wb");
        if (!fp) {
            LOGE("创建 SP3 临时文件失败: %s (%s)", temp_file, strerror(errno));
            (*env)->ReleaseByteArrayElements(env, data, bytes, JNI_ABORT);
            return -1;
        }
    }

    size_t written = fwrite(bytes, 1, length, fp);
    fclose(fp);
    (*env)->ReleaseByteArrayElements(env, data, bytes, JNI_ABORT);

    if (written != (size_t)length) {
        LOGE("写入 SP3 文件失败: 期望 %d, 实际 %zu", length, written);
        remove(temp_file);
        return -1;
    }

    int old_ne = ctx->nav.ne;

    /* readsp3 第三个参数 opt：0=不去重，1=按时间去重 */
    readsp3(temp_file, &ctx->nav, 1);
    remove(temp_file);

    int new_ne = ctx->nav.ne - old_ne;
    if (new_ne <= 0) {
        LOGE("SP3 文件解析失败，未加载任何精密星历");
        return 0;
    }

    /* 切换到精密星历模式 */
    ctx->prcopt.sateph = EPHOPT_PREC;

    /* 强制下次解算时重新 rtkinit
     * 因为 ctx->rtk.opt.sateph 是在 rtkinit 时从 prcopt.sateph 复制的，
     * 单纯改 prcopt.sateph 不会影响已经初始化的 rtk.opt.sateph。
     * 把 last_mode 设为 -1（无效值），强制 nativeProcessObsBatch 中重新 rtkinit。
     */
    ctx->last_mode = -1;

    LOGI("成功加载 SP3 精密星历: 新增 %d 条记录, 总数=%d", new_ne, ctx->nav.ne);
    LOGI("已切换到 EPHOPT_PREC 模式（精密星历优先），下次解算将重新 rtkinit");
    LOGI("========================================");

    return (jint)new_ne;
}

/**
 * 获取星历数量
 * 
 * @param handle RTK 上下文句柄
 * @return 星历总数（GPS + GLONASS + Galileo + BeiDou）
 */
JNIEXPORT jint JNICALL
Java_com_mappin_app_RTKLibWrapper_nativeGetEphemerisCount(
    JNIEnv *env, jobject obj, jlong handle) {
    
    rtk_context_t *ctx = (rtk_context_t *)handle;
    if (!ctx) {
        LOGE("无效的句柄");
        return 0;
    }
    
    // 计算总星历数量
    // n = 广播星历（GPS/QZS/GAL/BDS/IRN）
    // ng = GLONASS 星历
    // ns = SBAS 星历
    // ne = 精密星历（Precise Ephemeris，来自 SP3 文件）
    int total = ctx->nav.n + ctx->nav.ng + ctx->nav.ns + ctx->nav.ne;
    
    LOGD("星历统计: 广播=%d, GLONASS=%d, SBAS=%d, 精密=%d, 总计=%d",
         ctx->nav.n, ctx->nav.ng, ctx->nav.ns, ctx->nav.ne, total);
    
    return (jint)total;
}
