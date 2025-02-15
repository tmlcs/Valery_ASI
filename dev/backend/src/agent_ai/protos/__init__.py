from pathlib import Path
import sys

# Add the protos directory to the Python path
protos_dir = Path(__file__).parent
if str(protos_dir) not in sys.path:
    sys.path.append(str(protos_dir))

try:
    from . import query_pb2
    from . import query_pb2_grpc
except ImportError:
    # During initial setup, these modules might not exist yet
    pass

__all__ = ['query_pb2', 'query_pb2_grpc']
