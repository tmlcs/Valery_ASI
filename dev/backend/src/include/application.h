#ifndef APPLICATION_H
#define APPLICATION_H

#include "config.h"
#include "zmqclient.h"
#include <string>

class Application {
public:
    Application() = default;
    
    bool initialize(int argc, char* argv[]) {
        try {
            // Initialize ZMQ client and verify it's working
            auto& client = ZMQClient::getInstance();
            std::string response;
            return client.send_message("init", response);
        } catch (const std::exception& e) {
            std::cerr << "Initialization error: " << e.what() << std::endl;
            return false;
        }
    }

    int run() {
        try {
            auto& client = ZMQClient::getInstance();
            std::string response;
            
            while (running) {
                // Send heartbeat message to verify connection
                if (!client.send_message("heartbeat", response)) {
                    std::cerr << "Connection lost" << std::endl;
                    return 1;
                }
                std::this_thread::sleep_for(std::chrono::milliseconds(100));
            }
            
            return 0;
        } catch (const std::exception& e) {
            std::cerr << "Runtime error: " << e.what() << std::endl;
            return 1;
        }
    }

    void stop() {
        running = false;
    }

private:
    void setupSignalHandlers() {
        // Setup signal handlers
    }

    std::atomic<bool> running{true};
};

#endif
