# Find ZeroMQ Headers/Libs

# Variables
# ZeroMQ_ROOT - set this to a location where ZeroMQ may be found
#
# ZeroMQ_FOUND - True if ZeroMQ found
# ZeroMQ_INCLUDE_DIRS - Location of ZeroMQ includes
# ZeroMQ_LIBRARIES - ZeroMQ libraries

include(FindPackageHandleStandardArgs)

if (NOT ZeroMQ_ROOT)
    set(ZeroMQ_ROOT "$ENV{ZeroMQ_ROOT}")
endif()

if (NOT ZeroMQ_ROOT)
    if (WIN32)
        set(ZeroMQ_ROOT "C:/Program Files/ZeroMQ")
    else()
        set(ZeroMQ_ROOT "/usr/local")
    endif()
endif()

find_path(ZeroMQ_INCLUDE_DIR
    NAMES zmq.h
    PATHS ${ZeroMQ_ROOT}/include
          /usr/include
          /usr/local/include
          /opt/local/include
)

find_library(ZeroMQ_LIBRARY
    NAMES zmq libzmq
    PATHS ${ZeroMQ_ROOT}/lib
          /usr/lib
          /usr/local/lib
          /opt/local/lib
          /usr/lib/x86_64-linux-gnu
)

find_package_handle_standard_args(ZeroMQ DEFAULT_MSG
    ZeroMQ_LIBRARY 
    ZeroMQ_INCLUDE_DIR
)

if(ZeroMQ_FOUND)
    set(ZeroMQ_INCLUDE_DIRS ${ZeroMQ_INCLUDE_DIR})
    set(ZeroMQ_LIBRARIES ${ZeroMQ_LIBRARY})
    
    if(NOT TARGET ZeroMQ::ZeroMQ)
        add_library(ZeroMQ::ZeroMQ UNKNOWN IMPORTED)
        set_target_properties(ZeroMQ::ZeroMQ PROPERTIES
            IMPORTED_LOCATION "${ZeroMQ_LIBRARY}"
            INTERFACE_INCLUDE_DIRECTORIES "${ZeroMQ_INCLUDE_DIR}"
        )
    endif()
endif()

mark_as_advanced(
    ZeroMQ_ROOT
    ZeroMQ_LIBRARY
    ZeroMQ_INCLUDE_DIR
)
