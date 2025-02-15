#ifndef VALIDATOR_H
#define VALIDATOR_H

#include <zmq.hpp>
#include <string>
#include <iostream>
#include <nlohmann/json.hpp>
#include <thread>
#include <httplib.h>
#include <functional> 
#include <memory>
#include <atomic>
#include <mutex>
#include <chrono>
#include <queue>
#include <condition_variable>
#include <future>
#include <csignal>
#include <sys/stat.h>
#include <system_error>

class MessageValidator {
public:
    static void validateMessageSize(const std::string& message, size_t max_size) {
        if (max_size == 0) {
            throw std::invalid_argument("Max size cannot be 0");
        }
        if (message.empty()) {
            throw std::invalid_argument("Message cannot be empty");
        }
        if (message.size() > max_size) {
            std::stringstream ss;
            ss << "Message size (" << message.size() 
               << " bytes) exceeds maximum allowed (" << max_size << " bytes)";
            throw std::invalid_argument(ss.str());
        }
        
        // Validate UTF-8 encoding
        if (!isValidUTF8(message)) {
            throw std::invalid_argument("Invalid UTF-8 encoding detected");
        }
        
        // Check for control characters
        if (containsControlCharacters(message)) {
            throw std::invalid_argument("Message contains invalid control characters");
        }
    }

    static void validateJsonStructure(const nlohmann::json& j) {
        if (!j.is_object()) {
            throw std::invalid_argument("JSON must be an object");
        }
        if (!j.contains("message")) {
            throw std::invalid_argument("Missing required 'message' field");
        }
        // Validar campos anidados
        validateNestedFields(j);
    }

private:
    static bool isValidUTF8(const std::string& str) {
        const unsigned char* bytes = reinterpret_cast<const unsigned char*>(str.c_str());
        size_t len = str.length();
        
        for (size_t i = 0; i < len; i++) {
            if (bytes[i] <= 0x7F) {
                continue;
            }
            
            // Check multi-byte sequences
            size_t extra_bytes = 0;
            if ((bytes[i] & 0xE0) == 0xC0) {
                extra_bytes = 1;
            } else if ((bytes[i] & 0xF0) == 0xE0) {
                extra_bytes = 2;
            } else if ((bytes[i] & 0xF8) == 0xF0) {
                extra_bytes = 3;
            } else {
                return false;
            }
            
            if (i + extra_bytes >= len) {
                return false;
            }
            
            for (size_t j = 0; j < extra_bytes; j++) {
                if ((bytes[i + j + 1] & 0xC0) != 0x80) {
                    return false;
                }
            }
            i += extra_bytes;
        }
        return true;
    }
    
    static bool containsControlCharacters(const std::string& str) {
        return std::any_of(str.begin(), str.end(), [](char c) {
            return (c < 32 && c != 9 && c != 10 && c != 13) || c == 127;
        });
    }

    static void validateNestedFields(const nlohmann::json& j) {
        for (const auto& [key, value] : j.items()) {
            if (value.is_object()) {
                validateJsonStructure(value);
            }
        }
    }
};

void validateMessage(const std::string& message, size_t max_size = MAX_MESSAGE_SIZE) {
    MessageValidator::validateMessageSize(message, max_size);
    try {
        auto j = nlohmann::json::parse(message);
        MessageValidator::validateJsonStructure(j);
    } catch (const nlohmann::json::exception&) {
        throw std::invalid_argument("Invalid JSON format");
    }
}

#endif