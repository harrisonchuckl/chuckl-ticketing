#!/usr/bin/env sh
set -eu

# Default port if not provided
: "${PORT:=8080}"

# Start the compiled server
exec node dist/start.js
