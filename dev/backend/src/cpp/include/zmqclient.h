#ifndef ZMQCLIENT_H
#define ZMQCLIENT_H

#include "config.h"
#include "zmqthreadpool.h"
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

using json = nlohmann::json;

class ZMQClient {
    private:
        zmq::context_t context;
        std::atomic<bool> is_running;
        ZMQThreadPool thread_pool;
        std::map<std::string, std::unique_ptr<zmq::socket_t>> sockets;
        std::mutex sockets_mutex_;

        // Private constructor
        ZMQClient() : context(1), is_running(true), thread_pool(4) {}
        
        // Delete copy and move operations
        ZMQClient(const ZMQClient&) = delete;
        ZMQClient& operator=(const ZMQClient&) = delete;
        ZMQClient(ZMQClient&&) = delete;
        ZMQClient& operator=(ZMQClient&&) = delete;
    
        // Agregar logging más robusto
        // Mejorar el logging con formato de tiempo correcto
        void log_error(const std::string& message) {
            auto now = std::chrono::system_clock::now();
            auto time = std::chrono::system_clock::to_time_t(now);
            std::cerr << "[ERROR][" << std::ctime(&time) << "] " << message << std::endl;
        }
    
        // Agregar logging estructurado
        enum class LogLevel { INFO, WARNING, ERROR };
        
        void log(LogLevel level, const std::string& message) {
            static const std::map<LogLevel, std::string> level_strings = {
                {LogLevel::INFO, "INFO"},
                {LogLevel::WARNING, "WARNING"},
                {LogLevel::ERROR, "ERROR"}
            };
            
            auto now = std::chrono::system_clock::now();
            auto time = std::chrono::system_clock::to_time_t(now);
            std::string timestamp = std::ctime(&time);
            timestamp.pop_back(); // Remove newline
            
            std::cerr << "[" << level_strings.at(level) << "][" 
                     << timestamp << "] " << message << std::endl;
        }
        
        // Mejorar limpieza de recursos
        void cleanup_socket(zmq::socket_t& socket) {
            try {
                if (socket.handle()) {
                    socket.close();
                }
            } catch (const zmq::error_t& e) {
                log(LogLevel::ERROR, "Socket cleanup error: " + std::string(e.what()));
            }
        }
    
    public:
        // Make destructor public
        ~ZMQClient() {
            try {
                stop();
                
                // Cerrar sockets de forma segura
                {
                    std::lock_guard<std::mutex> lock(sockets_mutex_);
                    for(auto& socket : sockets) {
                        try {
                            socket.second->close();
                        } catch (...) {
                            // Log error but continue cleanup
                        }
                    }
                    sockets.clear();
                }
                
                // Limpiar el contexto ZMQ
                if (context.handle() != nullptr) {  // Update to use handle()
                    context.close();
                }
                
                // Asegurar que el thread pool se limpie
                thread_pool.~ZMQThreadPool();
                
            } catch (const std::exception& e) {
                std::cerr << "Error in ZMQClient destructor: " << e.what() << std::endl;
            }
        }
    
        // Meyer's Singleton implementation
        static ZMQClient& getInstance() {
            static ZMQClient instance;
            return instance;
        }
        
        void stop() {
            is_running = false;
        }
        
        /**
         * Sends a message to the ZMQ server and waits for response
         * @param message The message to send
         * @param response Reference to store the response
         * @return true if successful, false otherwise
         * @throws std::runtime_error if message size exceeds MAX_MESSAGE_SIZE
         */
        bool send_message(const std::string& message, std::string& response) {
            // Validación de entrada
            if (message.empty()) {
                log_error("Empty message received");
                return false;
            }
    
            if (message.size() > MAX_MESSAGE_SIZE) {
                log_error("Message size exceeds maximum allowed size");
                throw std::runtime_error("Message size exceeds maximum allowed size");
            }
            
            std::promise<bool> promise;
            auto future = promise.get_future();
            
            thread_pool.enqueue([this, message, &response, &promise]() {
                std::unique_ptr<zmq::socket_t> requester;
                try {
                    requester = std::make_unique<zmq::socket_t>(context, ZMQ_REQ);
                    
                    // Enhanced socket configuration
                    requester->set(zmq::sockopt::linger, 3000);
                    requester->set(zmq::sockopt::rcvtimeo, 15000);
                    requester->set(zmq::sockopt::sndtimeo, 15000);
                    requester->set(zmq::sockopt::immediate, 1);
                    requester->set(zmq::sockopt::reconnect_ivl, 100);
                    requester->set(zmq::sockopt::reconnect_ivl_max, 1000);
                    requester->set(zmq::sockopt::tcp_keepalive, 1);
                    requester->set(zmq::sockopt::tcp_keepalive_idle, 300);
                    
                    const std::string zmq_address = getEnvOr("ZMQ_ADDRESS", DEFAULT_ZMQ_ADDRESS);
                    std::cout << "Connecting to " << zmq_address << std::endl;
                    requester->connect(zmq_address);
                    
                    // Wait for connection to establish
                    std::this_thread::sleep_for(std::chrono::seconds(1));
                    
                    // Mejorar la validación de la conexión usando el operador bool
                    const auto deadline = std::chrono::system_clock::now() + std::chrono::seconds(5);
                    while (std::chrono::system_clock::now() < deadline) {
                        if (*requester) {  // Usar operador bool en lugar de connected()
                            break;
                        }
                        std::this_thread::sleep_for(std::chrono::milliseconds(100));
                    }
                    
                    if (!(*requester)) {  // Usar operador bool en lugar de connected()
                        throw std::runtime_error("Failed to connect to ZMQ server");
                    }
    
                    json msg_json = {{"message", message}};
                    std::string msg_str = msg_json.dump();
                    
                    zmq::message_t request(msg_str.data(), msg_str.size());
                    std::cout << "Sending message: " << msg_str << std::endl;
                    
                    // Retry logic with backoff
                    for (int retry = 0; retry < 3; retry++) {
                        if (retry > 0) {
                            std::cout << "Retry attempt " << retry + 1 << std::endl;
                            std::this_thread::sleep_for(std::chrono::milliseconds(100 * (1 << retry)));
                        }
                        
                        auto send_result = requester->send(request, zmq::send_flags::none);
                        if (send_result.has_value()) {
                            zmq::message_t reply;
                            auto recv_result = requester->recv(reply, zmq::recv_flags::none);
                            
                            if (recv_result.has_value()) {
                                response = std::string(static_cast<char*>(reply.data()), reply.size());
                                std::cout << "Received response: " << response << std::endl;
                                promise.set_value(true);
                                return;
                            }
                        }
                    }
                    
                    throw zmq::error_t();
                }
                catch (const zmq::error_t& e) {
                    std::cerr << "ZMQ error: " << e.what() << std::endl;
                    promise.set_value(false);
                }
                catch (const std::exception& e) {
                    log_error(std::string("Error in send_message: ") + e.what());
                    promise.set_value(false);
                }
                // Socket will be automatically closed by unique_ptr
            });
    
            return future.get();
        }
    
        // Add connection state validation
        bool validate_connection(zmq::socket_t& socket) {
            try {
                int timeout = 1000;
                socket.set(zmq::sockopt::rcvtimeo, timeout); // Updated to use modern API
                zmq::message_t msg;
                return socket.recv(msg) >= 0;
            } catch (const zmq::error_t& e) {
                return false;
            }
        }
    };

#endif