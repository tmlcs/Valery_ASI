#ifndef CIRCUITBREAKER_H
#define CIRCUITBREAKER_H

#include <zmq.hpp>
#include <string>
#include <iostream>
#include <nlohmann/json.hpp>
#include <thread>
#include <httplib.h>  // Asegúrate de tener httplib.h configurado correctamente
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

class CircuitBreaker {
    private:
        std::atomic<int> failures;
        std::atomic<bool> is_open;
        std::atomic<std::chrono::steady_clock::time_point> last_failure;
        const int threshold;
        const std::chrono::seconds reset_timeout;
    
    public:
        CircuitBreaker(int threshold = 3, int reset_seconds = 30)
            : failures(0), is_open(false), threshold(threshold), 
              reset_timeout(reset_seconds) {}
    
        bool allowRequest() {
            if (!is_open) return true;
            
            auto now = std::chrono::steady_clock::now();
            auto last = last_failure.load();  // Load the atomic value first
            if (now - last > reset_timeout) {
                is_open = false;
                failures = 0;
                return true;
            }
            return false;
        }
    
        void recordFailure() {
            last_failure = std::chrono::steady_clock::now();
            if (++failures >= threshold) {
                is_open = true;
            }
        }
    
        void recordSuccess() {
            failures = 0;
            is_open = false;
        }
    
        // Add getFailureCount method
        int getFailureCount() const {
            return failures.load();
        }
    };
#endif