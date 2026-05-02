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

# 密度配置
DENSITY_CONFIGS = {
    'dense': {
        'name': '密集',
        'min_distance': 10,
        'max_distance': 100,
        'avg_distance': 50,
        'description': '适合小区域详细测绘'
    },
    'medium': {
        'name': '中等',
        'min_distance': 100,
        'max_distance': 800,
        'avg_distance': 400,
        'description': '适合常规地形测量'
    },
    'sparse': {
        'name': '稀疏',
        'min_distance': 800,
        'max_distance': 3000,
        'avg_distance': 1500,
        'description': '适合大范围控制网'
    }
}

# 生成参数
NUM_POINTS = 1000
DENSITY_MODE = 'medium'


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


def generate_points_with_density(num_points, density_mode, max_attempts=5000):
    """
    根据密度模式生成测量点
    
    参数:
        num_points: 要生成的点数量
        density_mode: 密度模式 ('dense', 'medium', 'sparse')
        max_attempts: 每个点的最大尝试次数
    
    返回:
        points: 生成的点列表 [(x, y, z), ...]
    """
    config = DENSITY_CONFIGS[density_mode]
    min_distance = config['min_distance']
    max_distance = config['max_distance']
    avg_distance = config['avg_distance']
    
    print(f"\n📐 生成配置:")
    print(f"  坐标系统: {COORDINATE_SYSTEM}")
    print(f"  投影方式: {PROJECTION_TYPE}")
    print(f"  中央经线: {CENTRAL_MERIDIAN}°E")
    print(f"  密度模式: {config['name']} - {config['description']}")
    print(f"  点间距范围: {min_distance}m - {max_distance}m")
    print(f"  平均间距: {avg_distance}m")
    print(f"  目标点数: {num_points}")
    
    # 计算区域大小
    width, height = calculate_area_size(num_points, avg_distance)
    x_min = CENTER_X - width / 2
    x_max = CENTER_X + width / 2
    y_min = CENTER_Y - height / 2
    y_max = CENTER_Y + height / 2
    
    print(f"  生成区域: {width:.0f}m × {height:.0f}m")
    print(f"  坐标范围: X=[{x_min:.0f}, {x_max:.0f}]")
    print(f"            Y=[{y_min:.0f}, {y_max:.0f}]")
    print(f"            Z=[{Z_MIN}, {Z_MAX}]\n")
    
    points = []
    spatial_grid = SpatialGrid(cell_size=max_distance)
    
    # 生成第一个点（在中心附近）
    first_x = CENTER_X + random.uniform(-width/4, width/4)
    first_y = CENTER_Y + random.uniform(-height/4, height/4)
    first_z = random.uniform(max(Z_MIN, 0), min(Z_MAX, 1000))
    first_point = (first_x, first_y, first_z)
    points.append(first_point)
    spatial_grid.add_point(first_point)
    print(f"  已生成 1/{num_points} 个点...")
    
    # 生成剩余点
    failed_attempts = 0
    max_failed = num_points * 10  # 总失败次数上限
    
    while len(points) < num_points and failed_attempts < max_failed:
        # 随机选择一个已有点作为参考
        reference_point = random.choice(points)
        
        # 在参考点周围生成新点
        # 距离在 min_distance 到 max_distance 之间
        angle = random.uniform(0, 2 * math.pi)
        distance = random.uniform(min_distance, max_distance)
        
        new_x = reference_point[0] + distance * math.cos(angle)
        new_y = reference_point[1] + distance * math.sin(angle)
        
        # 确保在范围内
        if not (x_min <= new_x <= x_max and y_min <= new_y <= y_max):
            failed_attempts += 1
            continue
        
        # 生成高程（基于参考点高程，加上随机变化）
        z_variation = random.gauss(0, avg_distance / 10)
        new_z = reference_point[2] + z_variation
        new_z = max(Z_MIN, min(Z_MAX, new_z))
        
        new_point = (new_x, new_y, new_z)
        
        # 检查与最近点的距离
        nearest_distance = spatial_grid.find_nearest_distance(new_point)
        
        if nearest_distance >= min_distance:
            points.append(new_point)
            spatial_grid.add_point(new_point)
            failed_attempts = 0  # 重置失败计数
            
            if len(points) % 100 == 0:
                print(f"  已生成 {len(points)}/{num_points} 个点...")
        else:
            failed_attempts += 1
    
    if len(points) < num_points:
        print(f"\n  ⚠️ 达到尝试上限，已生成 {len(points)}/{num_points} 个点")
    else:
        print(f"\n  ✅ 成功生成 {len(points)} 个点!")
    
    return points


def save_to_dat_file(points, filename):
    """
    保存为 CASS .dat 格式
    格式: 点号,,X(北坐标),Y(东坐标),Z(高程)
    """
    script_dir = os.path.dirname(os.path.abspath(__file__))
    filepath = os.path.join(script_dir, filename)

    num_control = min(10, len(points) // 10)
    control_indices = set(random.sample(range(len(points)), num_control))

    with open(filepath, 'w', encoding='utf-8') as f:
        for i, (x, y, z) in enumerate(points):
            point_number = f"K{i + 1}" if i in control_indices else str(i + 1)
            # 正确的顺序：X(北坐标),Y(东坐标),Z(高程)
            f.write(f"{point_number},,{x:.3f},{y:.3f},{z:.3f}\n")

    print(f"\n📁 文件已保存: {filepath}")
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
        print("  1. 密集 (10-100m) - 适合小区域详细测绘")
        print("  2. 中等 (100-800m) - 适合常规地形测量")
        print("  3. 稀疏 (800m以上) - 适合大范围控制网")
        
        density_input = input("选择密度 (1/2/3, 默认2): ").strip()
        density_map = {'1': 'dense', '2': 'medium', '3': 'sparse', '': 'medium'}
        density_mode = density_map.get(density_input, 'medium')

    except ValueError:
        print("错误: 请输入有效的数字")
        return

    # 生成点
    points = generate_points_with_density(num_points, density_mode)

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
    filename = f"test_{len(points)}pts_{density_name}_{timestamp}.dat"

    filepath, num_control = save_to_dat_file(points, filename)

    print(f"\n📊 统计信息:")
    print(f"  坐标系: {COORDINATE_SYSTEM}")
    print(f"  投影: {PROJECTION_TYPE} | 中央经线 {CENTRAL_MERIDIAN}°E")
    print(f"  密度模式: {density_name}")
    print(f"  总点数: {len(points)} (测量点 {len(points)-num_control}, 控制点 {num_control})")
    print(f"  点间距: {config['min_distance']}-{config['max_distance']}m")
    print(f"  文件大小: {os.path.getsize(filepath) / 1024:.2f} KB")
    print(f"\n✨ 完成!")


if __name__ == "__main__":
    main()