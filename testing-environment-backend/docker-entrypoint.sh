#!/bin/sh
set -e

npm run prisma:deploy
npm run prisma:seed

exec "$@"
