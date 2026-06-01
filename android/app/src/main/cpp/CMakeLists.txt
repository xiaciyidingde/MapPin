# CMake 最低版本
cmake_minimum_required(VERSION 3.18.1)

# 项目名称
project("rtklib")

# C/C++ 标准
set(CMAKE_C_STANDARD 99)
set(CMAKE_CXX_STANDARD 11)

# 编译选项
add_compile_options(-Wall -Wextra -O2)

# RTKLIB 多系统支持编译宏
add_definitions(
    -DENAGLO    # GLONASS 支持
    -DENAGAL    # Galileo 支持
    -DENACMP    # BeiDou 支持
    -DENAQZS    # QZSS 支持
    -DNFREQ=3   # 3 频点支持
    -DNEXOBS=3  # 扩展观测码
)

# RTKLIB 源文件目录
set(RTKLIB_SRC_DIR ${CMAKE_CURRENT_SOURCE_DIR}/rtklib)

# RTKLIB 核心源文件
set(RTKLIB_SOURCES
    ${RTKLIB_SRC_DIR}/rtkcmn.c
    ${RTKLIB_SRC_DIR}/rtkpos.c
    ${RTKLIB_SRC_DIR}/rtcm.c
    ${RTKLIB_SRC_DIR}/rtcm2.c
    ${RTKLIB_SRC_DIR}/rtcm3.c
    ${RTKLIB_SRC_DIR}/rtcm3e.c
    ${RTKLIB_SRC_DIR}/ephemeris.c
    ${RTKLIB_SRC_DIR}/preceph.c
    ${RTKLIB_SRC_DIR}/sbas.c
    ${RTKLIB_SRC_DIR}/pntpos.c
    ${RTKLIB_SRC_DIR}/lambda.c
    ${RTKLIB_SRC_DIR}/geoid.c
    ${RTKLIB_SRC_DIR}/ionex.c
    ${RTKLIB_SRC_DIR}/ppp.c
    ${RTKLIB_SRC_DIR}/ppp_ar.c
    ${RTKLIB_SRC_DIR}/tides.c
    ${RTKLIB_SRC_DIR}/rcvraw.c
    ${RTKLIB_SRC_DIR}/novatel.c
    ${RTKLIB_SRC_DIR}/ublox.c
    ${RTKLIB_SRC_DIR}/ss2.c
    ${RTKLIB_SRC_DIR}/crescent.c
    ${RTKLIB_SRC_DIR}/skytraq.c
    ${RTKLIB_SRC_DIR}/javad.c
    ${RTKLIB_SRC_DIR}/nvs.c
    ${RTKLIB_SRC_DIR}/binex.c
    ${RTKLIB_SRC_DIR}/rt17.c
    ${RTKLIB_SRC_DIR}/septentrio.c
    ${RTKLIB_SRC_DIR}/rinex.c
)

# JNI 包装源文件
set(JNI_SOURCES
    ${CMAKE_CURRENT_SOURCE_DIR}/rtklib_jni.c
)

# 创建共享库
add_library(
    rtklib
    SHARED
    ${RTKLIB_SOURCES}
    ${JNI_SOURCES}
)

# 包含目录
target_include_directories(
    rtklib
    PRIVATE
    ${RTKLIB_SRC_DIR}
)

# 链接库
target_link_libraries(
    rtklib
    log
    m
)
