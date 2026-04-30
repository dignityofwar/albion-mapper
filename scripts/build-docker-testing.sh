#!/bin/bash

cd "$(dirname "$0")/.."
docker build . -f provisioning/Dockerfile -t maelstromeous/applications:dig-roadmap-testing
docker push maelstromeous/applications:dig-roadmap-testing
echo "Docker test build completed"
cd "$(dirname "$0")/scripts"