#!/bin/sh
set -e # stop if any step fails

npx prisma migrate deploy # apply migrations (update tables)
npx prisma db seed
exec npm start # start the app