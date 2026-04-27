#!/bin/bash

cd "$(dirname "$0")/.."
docker build . -f provisioning/Dockerfile -t maelstromeous/applications:dig-roadmap-latest
docker push maelstromeous/applications:dig-roadmap-latest
echo "Docker build completed"
cd "$(dirname "$0")/scripts"