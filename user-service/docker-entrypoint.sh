#!/bin/sh
# Exit immediately if a command exits with a non-zero status.
set -e

# Apply committed migrations before accepting requests.
./node_modules/.bin/prisma migrate deploy
# replaces the shell process with the node process
exec node dist/index.js
