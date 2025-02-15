#define CATCH_CONFIG_MAIN
#include "catch2/catch.hpp"
#include "zmqclient.h"
#include "validator.h"
#include "ratelimiter.h"
#include <thread>
#include <chrono>

TEST_CASE("ZMQClient singleton tests", "[zmq]") {
    SECTION("Multiple instances return same pointer") {
        auto& instance1 = ZMQClient::getInstance();
        auto& instance2 = ZMQClient::getInstance();
        REQUIRE(&instance1 == &instance2);
    }
}

TEST_CASE("Message validation tests", "[validator]") {
    SECTION("Empty message") {
        REQUIRE_THROWS_AS(
            MessageValidator::validateMessageSize("", 1024),
            std::invalid_argument
        );
    }
    
    SECTION("Message too large") {
        std::string large_msg(1025, 'x');
        REQUIRE_THROWS_AS(
            MessageValidator::validateMessageSize(large_msg, 1024),
            std::invalid_argument
        );
    }
    
    SECTION("Valid message") {
        std::string msg = "test";
        REQUIRE_NOTHROW(MessageValidator::validateMessageSize(msg, 1024));
    }
}

TEST_CASE("RateLimiter tests", "[ratelimiter]") {
    RateLimiter limiter(2, std::chrono::seconds(1));
    
    SECTION("Allow initial requests") {
        REQUIRE(limiter.should_allow("127.0.0.1"));
        REQUIRE(limiter.should_allow("127.0.0.1"));
    }
    
    SECTION("Block excess requests") {
        limiter.should_allow("127.0.0.1");
        limiter.should_allow("127.0.0.1");
        REQUIRE_FALSE(limiter.should_allow("127.0.0.1"));
    }
    
    SECTION("Reset after timeout") {
        limiter.should_allow("127.0.0.1");
        limiter.should_allow("127.0.0.1");
        std::this_thread::sleep_for(std::chrono::seconds(1));
        REQUIRE(limiter.should_allow("127.0.0.1"));
    }
}
