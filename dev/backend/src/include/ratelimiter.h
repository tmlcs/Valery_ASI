#ifndef RATELIMITER_H
#define RATELIMITER_H

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

class RateLimiter {
    private:
        std::mutex mtx;
        std::map<std::string, std::queue<std::chrono::steady_clock::time_point>> requests;
        const size_t max_requests;
        const std::chrono::seconds window;
    
    public:
        RateLimiter(size_t max_req = 100, std::chrono::seconds win = std::chrono::seconds(60))
            : max_requests(max_req), window(win) {}
            
        bool should_allow(const std::string& ip) {
            std::lock_guard<std::mutex> lock(mtx);
            auto now = std::chrono::steady_clock::now();
            auto& queue = requests[ip];
            
            // Remove old requests
            while (!queue.empty() && now - queue.front() > window) {
                queue.pop();
            }
            
            if (queue.size() >= max_requests) {
                return false;
            }
            
            queue.push(now);
            return true;
        }
    };

#endif