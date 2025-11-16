#!/bin/bash

# Generate TypeScript code from protobuf files
PROTO_DIR="./proto"
OUTPUT_DIR="./src/generated"

# Create output directory if it doesn't exist
mkdir -p $OUTPUT_DIR

# Generate TypeScript code using grpc-tools
./node_modules/.bin/grpc_tools_node_protoc \
  --plugin=protoc-gen-ts=./node_modules/.bin/protoc-gen-ts \
  --ts_out=$OUTPUT_DIR \
  --grpc_out=$OUTPUT_DIR \
  --proto_path=$PROTO_DIR \
  $PROTO_DIR/*.proto

echo "TypeScript gRPC code generated successfully in $OUTPUT_DIR"