# use multi-stage build

# ---------- build stage ----------
FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm install
# for production
# RUN npm ci --omit=dev

# bundle source code inside the docker image
COPY . .
# prisma.config.ts requires DATABASE_URL
# placeholders in the DATABASE_URL can be used since `prisma generate` does not connect to the database
ARG DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
RUN npx prisma generate && npm run build


# ---------- runtime stage ----------
FROM node:22-alpine AS runtime
WORKDIR /app

COPY package*.json ./
RUN npm install
# for production
# RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist
# migrate and seed commands need the prisma schema, migrations, config and generated prisma client
COPY --from=build /app/src/generated ./src/generated
COPY prisma ./prisma
COPY prisma.config.ts docker-entrypoint.sh ./

# expose port 3001
EXPOSE 3001

# start app and run scripting seed everytime app starts
CMD ["sh", "docker-entrypoint.sh"] 
