FROM node:22-alpine AS builder
WORKDIR /app

# Install dependencies from the committed lockfile.
COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
COPY prisma.config.ts tsconfig.json ./
COPY src ./src
RUN npm run db:generate && npm run build
RUN npm prune --omit=dev

FROM node:22-alpine AS production
WORKDIR /app

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./
COPY docker-entrypoint.sh ./

EXPOSE 3000
ENTRYPOINT ["sh", "docker-entrypoint.sh"]
