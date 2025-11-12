#!/usr/bin/env sh
set -eu

: "${PORT:=8080}"

# Prisma client sometimes needs env to be present
export NODE_ENV="${NODE_ENV:-production}"

exec node dist/start.js
