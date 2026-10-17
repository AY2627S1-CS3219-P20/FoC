#!/bin/sh
set -e # stop if any step fails

npx prisma migrate deploy # apply migrations (update tables)
npx prisma db seed # seed database; prisma/seed.ts skips the seeding if the database has already been populated
exec npm start # start the app