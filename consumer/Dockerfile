# ─────────────────────────────────────────────
# BUILD STAGE
# ─────────────────────────────────────────────
FROM node:20-alpine AS builder

# Install OpenSSL — required by Prisma on Alpine
RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma

RUN npm ci


COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ─────────────────────────────────────────────
# PRODUCTION STAGE
# ─────────────────────────────────────────────
FROM node:20-alpine AS production

# Install OpenSSL — required by Prisma on Alpine
RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma

RUN npm ci --only=production

COPY --from=builder /app/dist ./dist

# No migrations here — the API container runs
# `prisma migrate deploy` first on startup.
# Consumer just connects and starts reading.
CMD ["node", "dist/consumer.js"]