#!/bin/bash

cd "$(dirname "$0")/.."
docker buildx build --platform linux/amd64 . -f provisioning/Dockerfile -t maelstromeous/applications:dig-roadmap-latest --push
echo "Docker build completed"
cd "$(dirname "$0")/scripts"