#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测量点数据生成器
"""

import random
import math
from datetime import datetime
import os

# ============================================================
# 全局配置 - 测绘参数
# ============================================================
COORDINATE_SYSTEM = "CGCS2000"
PROJECTION_TYPE = "gauss-3"
CENTRAL_MERIDIAN = 114

# 中国中部陆地
CENTER_X = 2985000  # 北坐标中心
CENTER_Y = 500000   # 东坐标中心
Z_MIN = -150
Z_MAX = 6000

# ============================================================
# 测绘编码分类（GB/T 20257.1-2017 国家基本比例尺地图图式）
# ============================================================
SURVEY_CODES = {
    'DM': {  # 地貌类
        'name': '地貌',
        'weight': 20,
        'codes': {
            'DM01': '山顶、山峰',
            'DM02': '山脊线',
            'DM03': '山谷、冲沟',
            'DM04': '陡坎、斜坡',
            'DM05': '平地',
        }
    },
    'SX': {  # 水系类
        'name': '水系',
        'weight': 10,
        'codes': {
            'SX01': '河流中心线',
            'SX02': '河流边线',
            'SX03': '湖泊、水塘',
            'SX04': '水井',
            'SX05': '水渠',
        }
    },
    'ZB': {  # 植被类
        'name': '植被',
        'weight': 10,
        'codes': {
            'ZB01': '树木（独立树）',
            'ZB02': '林地边界',
            'ZB03': '草地',
            'ZB04': '农田',
            'ZB05': '果园',
        }
    },
    'JZ': {  # 建筑类
        'name': '建筑',
        'weight': 30,
        'codes': {
            'JZ01': '房屋角点',
            'JZ02': '围墙',
            'JZ03': '大门',
            'JZ04': '台阶',
            'JZ05': '烟囱、水塔',
        }
    },
    'DL': {  # 道路类
        'name': '道路',
        'weight': 25,
        'codes': {
            'DL01': '道路中心线',
            'DL02': '道路边线',
            'DL03': '人行道',
            'DL04': '桥梁',
            'DL05': '涵洞',
        }
    },
    'GX': {  # 管线类
        'name': '管线',
        'weight': 5,
        'codes': {
            'GX01': '电力线杆',
            'GX02': '通信线杆',
            'GX03': '检查井（雨水）',
            'GX04': '检查井（污水）',
            'GX05': '阀门井',
        }
    },
}

# 密度配置
DENSITY_CONFIGS = {
    'level1': {
        'name': '1-10m',
        'min_distance': 1,
        'max_distance': 10,
        'avg_distance': 5,
    },
    'level2': {
        'name': '10-100m',
        'min_distance': 10,
        'max_distance': 100,
        'avg_distance': 50,
    },
    'level3': {
        'name': '100-200m',
        'min_distance': 100,
        'max_distance': 200,
        'avg_distance': 150,
    },
    'level4': {
        'name': '200-500m',
        'min_distance': 200,
        'max_distance': 500,
        'avg_distance': 350,
    },
    'level5': {
        'name': '500-1000m',
        'min_distance': 500,
        'max_distance': 1000,
        'avg_distance': 750,
    },
    'level6': {
        'name': '1000m以上',
        'min_distance': 1000,
        'max_distance': 3000,
        'avg_distance': 2000,
    },
}

# 生成参数
NUM_POINTS = 500
DENSITY_MODE = 'level2'


def calculate_distance_2d(p1, p2):
    """计算两点之间的平面距离（不考虑高程）"""
    return math.sqrt((p1[0] - p2[0]) ** 2 + (p1[1] - p2[1]) ** 2)


def calculate_area_size(num_points, avg_distance):
    """
    根据点数和平均间距计算合理的区域大小
    
    参数:
        num_points: 点数量
        avg_distance: 平均间距（米）
    
    返回:
        (width, height): 区域宽度和高度（米）
    """
    # 假设点均匀分布，计算所需面积
    # 每个点占据的平均面积 = avg_distance²
    total_area = num_points * (avg_distance ** 2)
    
    # 计算正方形边长，乘以系数1.5确保有足够空间
    side_length = math.sqrt(total_area) * 1.5
    
    return side_length, side_length


class SpatialGrid:
    """空间网格索引，用于快速查找最近点"""
    
    def __init__(self, cell_size):
        self.cell_size = cell_size
        self.grid = {}
    
    def _get_cell(self, x, y):
        """获取点所在的网格单元"""
        return (int(x // self.cell_size), int(y // self.cell_size))
    
    def add_point(self, point):
        """添加点到网格"""
        cell = self._get_cell(point[0], point[1])
        if cell not in self.grid:
            self.grid[cell] = []
        self.grid[cell].append(point)
    
    def find_nearest_distance(self, point):
        """查找点到最近已有点的距离"""
        cell = self._get_cell(point[0], point[1])
        min_distance = float('inf')
        
        # 检查当前单元及周围8个单元
        for dx in [-1, 0, 1]:
            for dy in [-1, 0, 1]:
                check_cell = (cell[0] + dx, cell[1] + dy)
                if check_cell in self.grid:
                    for existing_point in self.grid[check_cell]:
                        dist = calculate_distance_2d(point, existing_point)
                        min_distance = min(min_distance, dist)
        
        return min_distance


def generate_points_with_density(num_points, density_mode, num_isolated=0, max_attempts=5000):
    """
    根据密度模式生成测量点
    
    参数:
        num_points: 要生成的点数量
        density_mode: 密度模式 ('level1', 'level2', ...)
        num_isolated: 孤立点数量
        max_attempts: 每个点的最大尝试次数
    
    返回:
        points: 生成的点列表 [(x, y, z), ...]
        isolated_indices: 孤立点的索引集合
    """
    config = DENSITY_CONFIGS[density_mode]
    min_distance = config['min_distance']
    max_distance = config['max_distance']
    avg_distance = config['avg_distance']
    
    print(f"\n📐 生成配置:")
    print(f"  坐标系统: {COORDINATE_SYSTEM}")
    print(f"  投影方式: {PROJECTION_TYPE}")
    print(f"  中央经线: {CENTRAL_MERIDIAN}°E")
    print(f"  密度模式: {config['name']}")
    print(f"  点间距范围: {min_distance}m - {max_distance}m")
    print(f"  平均间距: {avg_distance}m")
    print(f"  目标点数: {num_points}")
    if num_isolated > 0:
        print(f"  孤立点数: {num_isolated}")
    
    # 计算区域大小
    width, height = calculate_area_size(num_points - num_isolated, avg_distance)
    x_min = CENTER_X - width / 2
    x_max = CENTER_X + width / 2
    y_min = CENTER_Y - height / 2
    y_max = CENTER_Y + height / 2
    
    print(f"  生成区域: {width:.0f}m × {height:.0f}m")
    print(f"  坐标范围: X=[{x_min:.0f}, {x_max:.0f}]")
    print(f"            Y=[{y_min:.0f}, {y_max:.0f}]")
    print(f"            Z=[{Z_MIN}, {Z_MAX}]\n")
    
    points = []
    isolated_indices = set()
    spatial_grid = SpatialGrid(cell_size=max_distance)
    
    # 生成第一个点（在中心附近）
    first_x = CENTER_X + random.uniform(-width/4, width/4)
    first_y = CENTER_Y + random.uniform(-height/4, height/4)
    first_z = random.uniform(max(Z_MIN, 0), min(Z_MAX, 1000))
    first_point = (first_x, first_y, first_z)
    points.append(first_point)
    spatial_grid.add_point(first_point)
    print(f"  已生成 1/{num_points} 个点...")
    
    # 生成正常点（不包括孤立点）
    normal_points_target = num_points - num_isolated
    failed_attempts = 0
    max_failed = normal_points_target * 10
    
    while len(points) < normal_points_target and failed_attempts < max_failed:
        # 随机选择一个已有点作为参考
        reference_point = random.choice(points)
        
        # 在参考点周围生成新点
        angle = random.uniform(0, 2 * math.pi)
        distance = random.uniform(min_distance, max_distance)
        
        new_x = reference_point[0] + distance * math.cos(angle)
        new_y = reference_point[1] + distance * math.sin(angle)
        
        # 确保在范围内
        if not (x_min <= new_x <= x_max and y_min <= new_y <= y_max):
            failed_attempts += 1
            continue
        
        # 生成高程
        z_variation = random.gauss(0, avg_distance / 10)
        new_z = reference_point[2] + z_variation
        new_z = max(Z_MIN, min(Z_MAX, new_z))
        
        new_point = (new_x, new_y, new_z)
        
        # 检查与最近点的距离
        nearest_distance = spatial_grid.find_nearest_distance(new_point)
        
        if nearest_distance >= min_distance:
            points.append(new_point)
            spatial_grid.add_point(new_point)
            failed_attempts = 0
            
            if len(points) % 100 == 0:
                print(f"  已生成 {len(points)}/{num_points} 个点...")
        else:
            failed_attempts += 1
    
    # 生成孤立点（远离主区域）
    if num_isolated > 0:
        print(f"\n  生成 {num_isolated} 个孤立点...")
        
        # 计算主区域的范围半径
        range_radius = math.sqrt((width / 2) ** 2 + (height / 2) ** 2)
        
        # 孤立点应该距离中心至少 10 倍范围半径
        isolation_distance = range_radius * 10
        
        for i in range(num_isolated):
            # 在远离中心的位置生成孤立点
            angle = random.uniform(0, 2 * math.pi)
            distance = random.uniform(isolation_distance, isolation_distance * 1.5)
            
            isolated_x = CENTER_X + distance * math.cos(angle)
            isolated_y = CENTER_Y + distance * math.sin(angle)
            isolated_z = random.uniform(max(Z_MIN, 0), min(Z_MAX, 1000))
            
            isolated_point = (isolated_x, isolated_y, isolated_z)
            isolated_indices.add(len(points))
            points.append(isolated_point)
            
            print(f"  已生成 {len(points)}/{num_points} 个点 (孤立点 {i+1}/{num_isolated})...")
    
    if len(points) < num_points:
        print(f"\n  ⚠️ 达到尝试上限，已生成 {len(points)}/{num_points} 个点")
    else:
        print(f"\n  ✅ 成功生成 {len(points)} 个点!")
    
    return points, isolated_indices


def generate_random_code():
    """
    根据权重随机生成测绘编码
    
    返回:
        code: 编码字符串（如 'JZ01'）
    """
    # 构建加权列表
    categories = []
    weights = []
    
    for category_key, category_data in SURVEY_CODES.items():
        categories.append(category_key)
        weights.append(category_data['weight'])
    
    # 按权重随机选择类别
    category = random.choices(categories, weights=weights)[0]
    
    # 从该类别中随机选择一个编码
    codes = list(SURVEY_CODES[category]['codes'].keys())
    return random.choice(codes)


def save_to_dat_file(points, filename, generate_codes=False, num_anomalies=0, isolated_indices=None):
    """
    保存为 CASS .dat 格式
    格式: 点号,编码,X(北坐标),Y(东坐标),Z(高程),HRMS:值,VRMS:值
    
    参数:
        points: 点列表
        filename: 文件名
        generate_codes: 是否生成编码
        num_anomalies: 精度异常点数量
        isolated_indices: 孤立点的索引集合
    """
    script_dir = os.path.dirname(os.path.abspath(__file__))
    filepath = os.path.join(script_dir, filename)

    num_control = min(10, len(points) // 10)
    control_indices = set(random.sample(range(len(points)), num_control))
    
    if isolated_indices is None:
        isolated_indices = set()
    
    # 随机选择异常点索引
    anomaly_indices = set()
    if num_anomalies > 0:
        anomaly_indices = set(random.sample(range(len(points)), min(num_anomalies, len(points))))
    
    # 统计编码使用情况
    code_stats = {}
    
    # 精度统计
    normal_hrms_count = 0
    normal_vrms_count = 0
    anomaly_hrms_count = 0
    anomaly_vrms_count = 0

    with open(filepath, 'w', encoding='utf-8') as f:
        for i, (x, y, z) in enumerate(points):
            point_number = f"K{i + 1}" if i in control_indices else str(i + 1)
            
            # 生成编码
            if generate_codes:
                code = generate_random_code()
                # 统计
                if code not in code_stats:
                    code_stats[code] = 0
                code_stats[code] += 1
            else:
                code = ''
            
            # 生成精度信息
            is_anomaly = i in anomaly_indices
            
            if is_anomaly:
                # 异常精度：超过阈值 (0.05m)
                # 随机决定是水平异常还是垂直异常，或两者都异常
                anomaly_type = random.choice(['hrms', 'vrms', 'both'])
                
                if anomaly_type in ['hrms', 'both']:
                    hrms = random.uniform(0.06, 0.20)  # 0.06-0.20m (超标)
                    anomaly_hrms_count += 1
                else:
                    hrms = random.uniform(0.008, 0.045)  # 正常范围
                    normal_hrms_count += 1
                
                if anomaly_type in ['vrms', 'both']:
                    vrms = random.uniform(0.06, 0.20)  # 0.06-0.20m (超标)
                    anomaly_vrms_count += 1
                else:
                    vrms = random.uniform(0.008, 0.045)  # 正常范围
                    normal_vrms_count += 1
            else:
                # 正常精度：0.008-0.045m (低于阈值 0.05m)
                hrms = random.uniform(0.008, 0.045)
                vrms = random.uniform(0.008, 0.045)
                normal_hrms_count += 1
                normal_vrms_count += 1
            
            # 格式：点号,编码,X(北坐标),Y(东坐标),Z(高程),HRMS:值,VRMS:值
            f.write(f"{point_number},{code},{x:.3f},{y:.3f},{z:.3f},HRMS:{hrms:.3f},VRMS:{vrms:.3f}\n")

    print(f"\n� 文件已保存码: {filepath}")
    
    # 显示编码统计
    if generate_codes and code_stats:
        print(f"\n📊 编码统计:")
        # 按类别分组显示
        for category_key, category_data in SURVEY_CODES.items():
            category_codes = [code for code in code_stats.keys() if code.startswith(category_key)]
            if category_codes:
                total = sum(code_stats[code] for code in category_codes)
                percentage = (total / len(points)) * 100
                print(f"  {category_data['name']}类 ({category_key}): {total} 个 ({percentage:.1f}%)")
                for code in sorted(category_codes):
                    desc = category_data['codes'][code]
                    count = code_stats[code]
                    print(f"    {code} - {desc}: {count}")
    
    # 显示精度统计
    print(f"\n📊 精度统计:")
    print(f"  总点数: {len(points)}")
    print(f"  正常精度点: {len(points) - len(anomaly_indices)}")
    print(f"  异常精度点: {len(anomaly_indices)}")
    if len(anomaly_indices) > 0:
        print(f"    HRMS 异常: {anomaly_hrms_count}")
        print(f"    VRMS 异常: {anomaly_vrms_count}")
    
    # 显示孤立点统计
    if len(isolated_indices) > 0:
        print(f"\n📊 孤立点统计:")
        print(f"  孤立点数: {len(isolated_indices)}")
    
    return filepath, num_control


def main():
    print("=" * 60)
    print("  测量点数据生成器")
    print(f"  {COORDINATE_SYSTEM} | {PROJECTION_TYPE} | 中央经线 {CENTRAL_MERIDIAN}°E")
    print("=" * 60)

    try:
        # 输入点数量
        num_points_input = input(f"\n点数量 (默认 {NUM_POINTS}): ").strip()
        num_points = int(num_points_input) if num_points_input else NUM_POINTS
        if num_points <= 0:
            print("错误: 点数量必须大于 0")
            return

        # 选择密度模式
        print("\n密度模式:")
        print("  1. 1-10m")
        print("  2. 10-100m")
        print("  3. 100-200m")
        print("  4. 200-500m")
        print("  5. 500-1000m")
        print("  6. 1000m以上")
        
        density_input = input("选择密度 (1/2/3/4/5/6, 默认2): ").strip()
        density_map = {
            '1': 'level1',
            '2': 'level2',
            '3': 'level3',
            '4': 'level4',
            '5': 'level5',
            '6': 'level6',
            '': 'level2'
        }
        density_mode = density_map.get(density_input, 'level2')
        
        # 询问是否生成编码
        print("\n编码生成:")
        print("  是否为点位随机生成测绘编码？")
        print("  编码类别: 地貌、水系、植被、建筑、道路、管线")
        generate_codes_input = input("生成编码 (y/n, 默认y): ").strip().lower()
        generate_codes = generate_codes_input != 'n'  # 默认为 y
        
        if generate_codes:
            print("\n  ✓ 将生成测绘编码")
            print("  编码权重分配:")
            for category_key, category_data in SURVEY_CODES.items():
                print(f"    {category_data['name']}类 ({category_key}): {category_data['weight']}%")
        
        # 询问精度异常点数量
        print("\n精度信息:")
        print("  所有点位将生成精度信息 (HRMS/VRMS)")
        anomaly_input = input("生成多少个精度异常点 (默认0): ").strip()
        num_anomalies = int(anomaly_input) if anomaly_input else 0
        
        if num_anomalies > num_points:
            print(f"  ⚠️ 异常点数量不能超过总点数，已调整为 {num_points}")
            num_anomalies = num_points
        
        if num_anomalies > 0:
            print(f"\n  ✓ 将生成 {num_anomalies} 个精度异常点")
        
        # 询问孤立点数量
        print("\n孤立点:")
        print("  孤立点将远离主测绘区域")
        isolated_input = input("生成多少个孤立点 (默认0): ").strip()
        num_isolated = int(isolated_input) if isolated_input else 0
        
        if num_isolated > num_points:
            print(f"  ⚠️ 孤立点数量不能超过总点数，已调整为 {num_points}")
            num_isolated = num_points
        
        if num_isolated > 0:
            print(f"\n  ✓ 将生成 {num_isolated} 个孤立点")

    except ValueError:
        print("错误: 请输入有效的数字")
        return

    # 生成点
    points, isolated_indices = generate_points_with_density(num_points, density_mode, num_isolated)

    if len(points) < num_points * 0.8:  # 如果生成点数少于目标的80%
        print(f"\n⚠️ 仅生成 {len(points)}/{num_points} 个点")
        confirm = input("是否保存? (y/n, 默认y): ").strip().lower()
        if confirm == 'n':
            print("已取消")
            return

    # 保存文件
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    config = DENSITY_CONFIGS[density_mode]
    density_name = config['name']
    code_suffix = "_编码" if generate_codes else ""
    anomaly_suffix = f"_异常{num_anomalies}" if num_anomalies > 0 else ""
    isolated_suffix = f"_孤立{num_isolated}" if num_isolated > 0 else ""
    filename = f"test_{len(points)}pts_{density_name}{code_suffix}{anomaly_suffix}{isolated_suffix}_{timestamp}.dat"

    filepath, num_control = save_to_dat_file(points, filename, generate_codes, num_anomalies, isolated_indices)

    print(f"\n📊 统计信息:")
    print(f"  坐标系: {COORDINATE_SYSTEM}")
    print(f"  投影: {PROJECTION_TYPE} | 中央经线 {CENTRAL_MERIDIAN}°E")
    print(f"  密度模式: {density_name}")
    print(f"  总点数: {len(points)} (测量点 {len(points)-num_control}, 控制点 {num_control})")
    print(f"  点间距: {config['min_distance']}-{config['max_distance']}m")
    print(f"  编码: {'是' if generate_codes else '否'}")
    print(f"  精度异常: {num_anomalies} 个")
    print(f"  孤立点: {num_isolated} 个")
    print(f"  文件大小: {os.path.getsize(filepath) / 1024:.2f} KB")
    print(f"\n✨ 完成!")


if __name__ == "__main__":
    main()