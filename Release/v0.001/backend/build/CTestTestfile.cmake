# CMake generated Testfile for 
# Source directory: /app/agent-ai/backend
# Build directory: /app/agent-ai/backend/build
# 
# This file includes the relevant testing commands required for 
# testing this directory and lists subdirectories to be tested as well.
add_test(unit_tests "/app/agent-ai/backend/build/unit_tests")
set_tests_properties(unit_tests PROPERTIES  _BACKTRACE_TRIPLES "/app/agent-ai/backend/CMakeLists.txt;50;add_test;/app/agent-ai/backend/CMakeLists.txt;0;")
subdirs("_deps/googletest-build")
