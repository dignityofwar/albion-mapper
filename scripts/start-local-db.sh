#!/bin/bash

# Navigate to the project root
cd "$(dirname "$0")/.."

# Load environment variables if .env exists
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi
if [ -f web/server/.env ]; then
  set -a
  source web/server/.env
  set +a
fi

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

echo "Starting local database..."
$DOCKER_COMPOSE -f provisioning/docker-compose.yml up -d db

echo "Waiting for database to be ready..."
# Use ps -q to get the container ID for the 'db' service
MAX_RETRIES=30
COUNT=0
CONTAINER_ID=""

while [ -z "$CONTAINER_ID" ] && [ $COUNT -lt $MAX_RETRIES ]; do
  CONTAINER_ID=$($DOCKER_COMPOSE -f provisioning/docker-compose.yml ps -q db | head -n 1)
  if [ -z "$CONTAINER_ID" ]; then
    sleep 1
    COUNT=$((COUNT + 1))
  fi
done

if [ -z "$CONTAINER_ID" ]; then
  echo "Error: Database container failed to start or could not be found."
  $DOCKER_COMPOSE -f provisioning/docker-compose.yml logs db
  exit 1
fi

until docker exec "$CONTAINER_ID" pg_isready -U "${POSTGRES_USER:-user}" -d "${POSTGRES_DB:-dbname}"
do
  echo "Still waiting..."
  sleep 2
done

echo "Database is ready!"
echo "You can now run 'pnpm dev' in the web/server directory."
