from setuptools import setup, find_packages
import os

def read_requirements(filename):
    with open(filename) as f:
        return [line.strip() for line in f if line.strip() and not line.startswith('#')]

setup(
    name="agent-ai",
    version="0.1",
    package_dir={"": "src"},
    packages=find_packages(where="src"),
    include_package_data=True,
    package_data={
        'agent_ai.protos': ['*.proto'],
    },
    install_requires=[
        "fastapi",
        "uvicorn",
        "transformers",
        "torch",
        "tensorflow",
        "pyzmq",
        "prometheus_client",
        "structlog",
        "grpcio",
        "grpcio-tools",
        "protobuf"
    ]
)
