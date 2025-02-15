#ifndef COMMON_H
#define COMMON_H

#include <string>
#include <cstdlib>
#include <nlohmann/json.hpp>
#include <cstdint>

using json = nlohmann::json;

// Configuration constants
const std::uint32_t MAX_THREAD_POOL_SIZE = 8;
const std::uint32_t MAX_QUEUE_SIZE = 100;
const std::uint64_t MAX_FILE_SIZE = 10ULL * 1024 * 1024;
const std::uint32_t MAX_MESSAGE_SIZE = 1024 * 1024;
const char* DEFAULT_ZMQ_ADDRESS = "tcp://0.0.0.0:5555";
const char* DEFAULT_HTTP_HOST = "localhost";
const int DEFAULT_HTTP_PORT = 3000;

// Helper functions
inline std::string getEnvOr(const char* key, const char* defaultValue) {
    if (!key || !defaultValue) {
        throw std::invalid_argument("Neither key nor default value can be null");
    }
    const char* val = std::getenv(key);
    return val ? std::string(val) : std::string(defaultValue);
}

#endif
