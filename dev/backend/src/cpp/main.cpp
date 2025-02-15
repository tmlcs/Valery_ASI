#include <httplib.h>
#include "config.h"
#include "application.h"
#include <filesystem>

// Move main functionality into a separate function
int runServer() {
    httplib::Server svr;

    // Configurar directorio de archivos estáticos
    auto web_dir = "/app/agent-ai/frontend/UI/";
    if (!std::filesystem::exists(web_dir)) {
        std::cerr << "Frontend directory not found!" << std::endl;
        return 1;
    }

    // Montar directorio estático
    svr.set_mount_point("/", web_dir);

    // API endpoints
    svr.Post("/api/message", [](const httplib::Request &req, httplib::Response &res) {
        json request_json;
        try {
            request_json = json::parse(req.body);
            std::string message = request_json["message"];
            
            // Procesar mensaje aquí
            json response_json;
            response_json["response"] = "Received message: " + message;
            
            res.set_content(response_json.dump(), "application/json");
        } catch (const std::exception &e) {
            res.status = 400;
            json error_json;
            error_json["error"] = "Invalid request";
            res.set_content(error_json.dump(), "application/json");
        }
    });

    // Iniciar servidor
    std::cout << "Server started at http://localhost:" << DEFAULT_HTTP_PORT << std::endl;
    svr.listen(DEFAULT_HTTP_HOST, DEFAULT_HTTP_PORT);

    return 0;
}

// Only compile main() when not running tests
#if !defined(TESTING) || TESTING == 0
int main() {
    return runServer();
}
#endif
