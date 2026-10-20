# Build with Node.js 22 on the small Alpine Linux base; npm is included.
# Naming this stage lets the runtime stage copy its finished artifacts.
FROM node:22-alpine AS builder
# Create/use /app as the directory for subsequent RUN and relative COPY paths.
WORKDIR /app

# Copy dependency manifests first so source-only changes can reuse the npm layer.
COPY package.json package-lock.json ./
# Install locked dependency versions, including development tools for compilation.
RUN npm ci

# Copy the service files; .dockerignore excludes secrets, keys, local dependencies,
# and generated output. Keeping this after npm ci preserves dependency caching.
COPY . .
# Generate Prisma Client under src/generated/prisma, then compile into dist.
# Client generation does not initialize a database; migrations run at startup.
RUN npm run db:generate && npm run build
# Remove development dependencies after building. 
RUN npm prune --omit=dev

# Start a fresh runtime stage, excluding build tools and original source files.
FROM node:22-alpine AS production
# Relative runtime paths, including the entrypoint, resolve from /app.
WORKDIR /app

# Retain package metadata, including type: module for the compiled JavaScript.
COPY --from=builder /app/package.json /app/package-lock.json ./
# Copy the pruned production dependencies, including the Prisma migration CLI.
COPY --from=builder /app/node_modules ./node_modules
# Copy compiled application code and the compiled generated Prisma Client.
COPY --from=builder /app/dist ./dist
# Keep the schema and migration history needed by prisma migrate deploy.
COPY --from=builder /app/prisma ./prisma
# Tell Prisma where its schema, migrations, and runtime DATABASE_URL are defined.
COPY --from=builder /app/prisma.config.ts ./
# Copy the startup script from the build context into the runtime image.
COPY docker-entrypoint.sh ./

EXPOSE 3000

ENTRYPOINT ["sh", "docker-entrypoint.sh"]
