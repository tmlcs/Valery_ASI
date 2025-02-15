import os
import subprocess
from pathlib import Path
import shutil

def compile_protos():
    # Base directories
    project_root = Path(__file__).parent
    proto_source_dir = project_root / "src" / "agent_ai" / "protos"
    proto_source_dir.mkdir(parents=True, exist_ok=True)

    # Ensure query.proto exists in protos directory
    proto_file = proto_source_dir / "query.proto"
    if not proto_file.exists():
        print(f"Creating {proto_file}")
        with open(proto_file, 'w') as f:
            f.write('''syntax = "proto3";

package agent_ai;

message QueryRequest {
    string message = 1;
    string user_id = 2;
    int64 timestamp = 3;
}

message QueryResponse {
    message SentimentAnalysis {
        string label = 1;
        float score = 2;
        int32 rating = 3;
    }

    message EmotionAnalysis {
        string label = 1;
        float score = 2;
    }

    message TopicAnalysis {
        string label = 1;
        float score = 2;
        repeated string all_topics = 3;
        repeated float all_scores = 4;
    }

    string status = 1;
    SentimentAnalysis sentiment = 2;
    EmotionAnalysis emotion = 3;
    TopicAnalysis topic = 4;
    int64 timestamp = 5;
    string error = 6;
}
''')

    # Compile proto files
    cmd = [
        "python", "-m", "grpc_tools.protoc",
        f"--proto_path={proto_source_dir}",
        f"--python_out={proto_source_dir}",
        f"--grpc_python_out={proto_source_dir}",
        str(proto_file)
    ]
    
    print(f"Compiling {proto_file}...")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"Error compiling protos: {result.stderr}")
        raise RuntimeError("Proto compilation failed")

    print("Proto files compiled successfully")

if __name__ == "__main__":
    compile_protos()
