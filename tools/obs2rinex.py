#!/usr/bin/env python3
"""
将 MapPin observations.txt 转换为 RINEX 3.04 OBS 格式
用法: python obs2rinex.py observations.txt output.obs
"""

import sys
import re
from datetime import datetime

def parse_observations(input_file):
    """解析 observations.txt"""
    epochs = []
    current_epoch = None
    current_meas = None
    
    with open(input_file, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            
            if line.startswith('EPOCH '):
                if current_epoch:
                    epochs.append(current_epoch)
                current_epoch = {'measurements': []}
                
            elif line.startswith('TimeNanos:'):
                current_epoch['time_nanos'] = int(line.split(':')[1].strip())
                
            elif line.startswith('FullBiasNanos:'):
                current_epoch['full_bias_nanos'] = int(line.split(':')[1].strip())
                
            elif line.startswith('BiasNanos:'):
                current_epoch['bias_nanos'] = float(line.split(':')[1].strip())
                
            elif line.startswith('MEAS '):
                current_meas = {}
                
            elif line.startswith('ConstellationType:'):
                current_meas['constellation'] = int(line.split(':')[1].strip())
                
            elif line.startswith('Svid:'):
                current_meas['svid'] = int(line.split(':')[1].strip())
                
            elif line.startswith('Cn0DbHz:'):
                current_meas['cn0'] = float(line.split(':')[1].strip())
                
            elif line.startswith('ReceivedSvTimeNanos:'):
                current_meas['sv_time_nanos'] = int(line.split(':')[1].strip())
                
            elif line.startswith('PseudorangeRateMetersPerSecond:'):
                current_meas['doppler'] = float(line.split(':')[1].strip())
                
            elif line.startswith('AccumulatedDeltaRangeMeters:'):
                current_meas['adr_meters'] = float(line.split(':')[1].strip())
                
            elif line.startswith('AccumulatedDeltaRangeState:'):
                current_meas['adr_state'] = line.split(':')[1].strip()
                if current_meas:
                    current_epoch['measurements'].append(current_meas)
                current_meas = None
    
    if current_epoch:
        epochs.append(current_epoch)
    
    return epochs

def constellation_to_system(const_type):
    """Android constellation type → RINEX system"""
    mapping = {
        1: 'G',  # GPS
        3: 'R',  # GLONASS
        5: 'C',  # BeiDou
        6: 'E',  # Galileo
        4: 'J',  # QZSS
        2: 'S',  # SBAS
        7: 'I',  # IRNSS
    }
    return mapping.get(const_type, 'G')

def gps_time_to_datetime(time_nanos, full_bias_nanos, bias_nanos):
    """GPS 时间 → UTC datetime"""
    # GPS 起点：1980-01-06 00:00:00
    gps_epoch_ms = 315964800000
    
    # 接收机 GPS 时间（纳秒）
    rx_gps_nanos = time_nanos - (full_bias_nanos + bias_nanos)
    
    # 转换为毫秒
    rx_gps_ms = rx_gps_nanos / 1_000_000
    
    # Unix 时间戳
    unix_ms = rx_gps_ms + gps_epoch_ms
    
    return datetime.utcfromtimestamp(unix_ms / 1000)

def calculate_pseudorange(time_nanos, full_bias_nanos, bias_nanos, sv_time_nanos):
    """计算伪距"""
    # 接收机 GPS 时间
    rx_gps_nanos = time_nanos - (full_bias_nanos + bias_nanos)
    
    # 传播时间
    travel_time_nanos = rx_gps_nanos - sv_time_nanos
    
    # 处理周跳转
    week_nanos = 604800.0e9
    travel_time_nanos = ((travel_time_nanos % week_nanos) + week_nanos) % week_nanos
    if travel_time_nanos > week_nanos / 2:
        travel_time_nanos -= week_nanos
    
    # 伪距（米）= 传播时间（纳秒）× 光速（m/ns）
    pseudorange = travel_time_nanos * 0.299792458
    
    return pseudorange

def write_rinex_header(f, first_epoch_time, marker_name="MAPPIN"):
    """写入 RINEX 3.04 头"""
    f.write(f"     3.04           OBSERVATION DATA    M (MIXED)           RINEX VERSION / TYPE\n")
    f.write(f"obs2rinex.py        MapPin              {datetime.now().strftime('%Y%m%d %H%M%S')} UTC PGM / RUN BY / DATE\n")
    f.write(f"{marker_name:<60}MARKER NAME\n")
    f.write(f"UNKNOWN             UNKNOWN                                 MARKER TYPE\n")
    f.write(f"UNKNOWN             UNKNOWN                                 OBSERVER / AGENCY\n")
    f.write(f"UNKNOWN             UNKNOWN             UNKNOWN             REC # / TYPE / VERS\n")
    f.write(f"UNKNOWN             UNKNOWN                                 ANT # / TYPE\n")
    f.write(f"        0.0000        0.0000        0.0000                  APPROX POSITION XYZ\n")
    f.write(f"        0.0000        0.0000        0.0000                  ANTENNA: DELTA H/E/N\n")
    f.write(f"G    4 C1C L1C D1C S1C                                      SYS / # / OBS TYPES\n")
    f.write(f"R    4 C1C L1C D1C S1C                                      SYS / # / OBS TYPES\n")
    f.write(f"E    4 C1C L1C D1C S1C                                      SYS / # / OBS TYPES\n")
    f.write(f"C    4 C2I L2I D2I S2I                                      SYS / # / OBS TYPES\n")
    f.write(f"J    4 C1C L1C D1C S1C                                      SYS / # / OBS TYPES\n")
    f.write(f"  {first_epoch_time.year:04d}    {first_epoch_time.month:2d}    {first_epoch_time.day:2d}    "
            f"{first_epoch_time.hour:2d}    {first_epoch_time.minute:2d}   {first_epoch_time.second:11.7f}     GPS         "
            f"TIME OF FIRST OBS\n")
    f.write(f"                                                            END OF HEADER\n")

def write_rinex_epoch(f, epoch):
    """写入一个历元的数据"""
    # 计算时间
    dt = gps_time_to_datetime(
        epoch['time_nanos'],
        epoch['full_bias_nanos'],
        epoch['bias_nanos']
    )
    
    # 历元头
    num_sats = len(epoch['measurements'])
    f.write(f"> {dt.year:04d} {dt.month:02d} {dt.day:02d} {dt.hour:02d} {dt.minute:02d} "
            f"{dt.second:011.7f}  0{num_sats:3d}\n")
    
    # 每颗卫星的观测值
    for meas in epoch['measurements']:
        sys = constellation_to_system(meas['constellation'])
        svid = meas['svid']
        
        # 计算伪距
        pseudorange = calculate_pseudorange(
            epoch['time_nanos'],
            epoch['full_bias_nanos'],
            epoch['bias_nanos'],
            meas['sv_time_nanos']
        )
        
        # 载波相位（周）
        wavelength = 0.1903  # L1 波长
        carrier_phase = -meas.get('adr_meters', 0) / wavelength if 'adr_meters' in meas else 0
        
        # 多普勒（Hz）
        doppler = -meas.get('doppler', 0) / wavelength if 'doppler' in meas else 0
        
        # 信号强度
        cn0 = meas.get('cn0', 0)
        
        # 写入观测值（C1C L1C D1C S1C）
        f.write(f"{sys}{svid:02d}{pseudorange:14.3f}  {carrier_phase:14.3f}  "
                f"{doppler:14.3f}  {cn0:14.3f}  \n")

def convert_to_rinex(input_file, output_file):
    """主转换函数"""
    print(f"解析 {input_file}...")
    epochs = parse_observations(input_file)
    print(f"找到 {len(epochs)} 个历元")
    
    if not epochs:
        print("错误：没有找到观测数据")
        return
    
    # 计算第一个历元时间
    first_epoch_time = gps_time_to_datetime(
        epochs[0]['time_nanos'],
        epochs[0]['full_bias_nanos'],
        epochs[0]['bias_nanos']
    )
    
    print(f"写入 RINEX 文件 {output_file}...")
    with open(output_file, 'w') as f:
        write_rinex_header(f, first_epoch_time)
        
        for i, epoch in enumerate(epochs):
            write_rinex_epoch(f, epoch)
            if (i + 1) % 10 == 0:
                print(f"  已处理 {i + 1}/{len(epochs)} 历元")
    
    print(f"✓ 转换完成！")
    print(f"\n使用方法：")
    print(f"  rnx2rtkp -p 0 -m 15 -o output.pos {output_file} ephemeris/*.rnx")

if __name__ == '__main__':
    if len(sys.argv) != 3:
        print("用法: python obs2rinex.py observations.txt output.obs")
        sys.exit(1)
    
    convert_to_rinex(sys.argv[1], sys.argv[2])
