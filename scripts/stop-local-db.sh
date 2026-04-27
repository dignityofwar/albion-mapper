#!/bin/bash

# Navigate to the project root
cd "$(dirname "$0")/.."

# Detect which docker compose command to use
if docker compose version >/dev/null 2>&1; then
  DOCKER_COMPOSE="docker compose"
elif docker-compose version >/dev/null 2>&1; then
  DOCKER_COMPOSE="docker-compose"
else
  echo "Error: Neither 'docker compose' nor 'docker-compose' found in PATH."
  echo "Please ensure Docker Compose is installed."
  exit 1
fi

echo "Using: $DOCKER_COMPOSE"

echo "Stopping local database..."
$DOCKER_COMPOSE -f provisioning/docker-compose.yml down
