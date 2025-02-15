#ifndef ZMQTHREADPOOL_H
#define ZMQTHREADPOOL_H

#include "config.h"
#include "circuitbreaker.h"
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

const int MAX_RETRIES = 3;
const std::chrono::milliseconds BASE_RETRY_DELAY(500);
const std::chrono::seconds WAIT_TIMEOUT(5);
const size_t MAX_THREAD_POOL_SIZE = 32; // Define MAX_THREAD_POOL_SIZE

class ZMQThreadPool {
    private:
        std::vector<std::thread> workers;
        std::queue<std::function<void()>> tasks;
        std::mutex queue_mutex;
        std::condition_variable condition;
        std::atomic<bool> stop;
        const size_t max_threads;
        CircuitBreaker circuit_breaker; // Add circuit breaker as member
    
    public:
        explicit ZMQThreadPool(size_t threads) 
            : stop(false)
            , max_threads(static_cast<size_t>(std::min(static_cast<uint32_t>(threads), MAX_THREAD_POOL_SIZE)))
            , circuit_breaker(3, 30) // Initialize with threshold=3, reset_timeout=30s
        {
            
            for(size_t i = 0; i < max_threads; ++i) {
                workers.emplace_back([this] {
                    while(true) {
                        std::function<void()> task;
                        {
                            std::unique_lock<std::mutex> lock(queue_mutex);
                            condition.wait(lock, [this] {
                                return stop || !tasks.empty();
                            });
                            if(stop && tasks.empty()) return;
                            task = std::move(tasks.front());
                            tasks.pop();
                        }
                        task();
                    }
                });
            }
        }

        template<class F>
        void enqueue(F&& f) {
            std::unique_lock<std::mutex> lock(queue_mutex);
            if (tasks.size() >= max_threads) {
                throw std::runtime_error("Queue full");
            }
            if (!circuit_breaker.allowRequest()) {
                throw std::runtime_error("Circuit breaker is open");
            }
    
            {
                tasks.emplace(std::forward<F>(f));
            }
            condition.notify_one();
        }
    
        ~ZMQThreadPool() {
            try {
                std::unique_lock<std::mutex> lock(queue_mutex);
                stop = true;
                condition.notify_all();
                
                // Clear tasks safely
                std::queue<std::function<void()>> empty;
                tasks.swap(empty);
            } catch (const std::exception& e) {
                std::cerr << "Error in destructor: " << e.what() << std::endl;
            }
            
            // Limpiar workers de forma segura
            for(std::thread &worker: workers) {
                if(worker.joinable()) {
                    try {
                        worker.join();
                    } catch (const std::exception& e) {
                        std::cerr << "Error joining worker thread: " << e.what() << std::endl;
                    }
                }
            }
            
            workers.clear();
        }
    
    private:
        void workerLoop() {
            while(true) {
                std::function<void()> task;
                {
                    std::unique_lock<std::mutex> lock(queue_mutex);
                    bool timeout = !condition.wait_for(lock, WAIT_TIMEOUT, [this]{ 
                        return stop || !tasks.empty(); 
                    });
                    if((stop && tasks.empty()) || timeout) return;
                    task = std::move(tasks.front());
                    tasks.pop();
                }
    
                executeWithRetry(task);
            }
        }
    
        void executeWithRetry(const std::function<void()>& task) {
            std::unique_lock<std::mutex> lock(queue_mutex);
            int retries = 0;
            const int MAX_DELAY_MS = 30000; // 30 segundos máximo
            while (retries < MAX_RETRIES) {
                try {
                    task();
                    {
                        std::lock_guard<std::mutex> lock(queue_mutex);
                        circuit_breaker.recordSuccess();  // Posible race condition aquí
                    }
                    return;
                } catch (const zmq::error_t& e) {
                    retries++;
                    {
                        std::lock_guard<std::mutex> lock(queue_mutex);
                        circuit_breaker.recordFailure();
                    }
                    if (retries == MAX_RETRIES) throw;
                    
                    // Calcular delay con límite máximo
                    auto delay = std::min(
                        BASE_RETRY_DELAY * (1 << retries),
                        std::chrono::milliseconds(MAX_DELAY_MS)
                    );
                    std::this_thread::sleep_for(delay);
                }
            }
        }
    };

#endif