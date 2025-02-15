cmake_minimum_required(VERSION 3.10)
project(AgenteIA)
set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_FLAGS "-O2 -Wall")
set(CMAKE_CXX_FLAGS_RELEASE "-O3 -DNDEBUG -march=native")

# Dependencias
find_package(PkgConfig REQUIRED)
find_package(nlohmann_json REQUIRED)
pkg_check_modules(ZMQ REQUIRED libzmq)
find_package(ZeroMQ 4.3.2)

# Google Test
include(FetchContent)
FetchContent_Declare(
    googletest
    GIT_REPOSITORY https://github.com/google/googletest.git
    GIT_TAG release-1.11.0
)
FetchContent_MakeAvailable(googletest)

include_directories(src/include)

# Ejecutable principal
add_executable(agente src/main.cpp)
target_compile_definitions(agente PRIVATE TESTING=0)
target_link_libraries(agente PRIVATE 
    ${ZMQ_LIBRARIES}
    nlohmann_json::nlohmann_json)

# Agregar target de instalación
install(TARGETS agente
    RUNTIME DESTINATION bin
    LIBRARY DESTINATION lib
    ARCHIVE DESTINATION lib/static)

# Tests - Compile the test executable separately
enable_testing()
add_executable(unit_tests src/tests/cpp/test_main.cpp)
target_compile_definitions(unit_tests PRIVATE TESTING=1)
target_link_libraries(unit_tests PRIVATE
    gtest
    gtest_main
    gmock
    gmock_main
    ${ZMQ_LIBRARIES}
    nlohmann_json::nlohmann_json)

add_test(NAME unit_tests COMMAND unit_tests)

# Manejo de dependencias faltantes
if(NOT ZMQ_FOUND)
    message(FATAL_ERROR "ZeroMQ >= 4.3.2 is required but not found")
endif()