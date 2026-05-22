#!/bin/bash

cd "$(dirname "$0")/.."

if [ "$1" == "test" ]; then
  IMAGE_TAG="maelstromeous/applications:dig-roadmap-testing"
  BUILD_MSG="Docker test build completed"
else
  IMAGE_TAG="maelstromeous/applications:dig-roadmap-latest"
  BUILD_MSG="Docker build completed"
fi

if [ "$(uname)" == "Darwin" ]; then
  docker buildx build --platform linux/amd64 . -f provisioning/Dockerfile -t $IMAGE_TAG --push
else
  docker build --platform linux/amd64 . -f provisioning/Dockerfile -t $IMAGE_TAG
  docker push $IMAGE_TAG
fi
echo "$BUILD_MSG"
cd "$(dirname "$0")/scripts"
