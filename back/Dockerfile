# ==========================================
# EUROTECH BACKEND MULTI-STAGE DOCKERFILE
# Node 22 Alpine - Hardened Production Image
# ==========================================

# Stage 1: Build Dependencies
FROM node:22-alpine AS builder

WORKDIR /usr/src/app

RUN apk add --no-cache openssl python3 make g++

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma/
RUN npx prisma generate

COPY . .

# Stage 2: Production Runner
FROM node:22-alpine AS runner

WORKDIR /usr/src/app

RUN apk add --no-cache dumb-init openssl

ENV NODE_ENV=production
ENV PORT=5000

# Security: Create non-root system user and group
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

COPY --chown=nodejs:nodejs --from=builder /usr/src/app/node_modules ./node_modules
COPY --chown=nodejs:nodejs --from=builder /usr/src/app/package*.json ./
COPY --chown=nodejs:nodejs --from=builder /usr/src/app/prisma ./prisma
COPY --chown=nodejs:nodejs --from=builder /usr/src/app ./

# Create uploads and archives directories with non-root ownership
RUN mkdir -p uploads archives && chown -R nodejs:nodejs uploads archives

USER nodejs

EXPOSE 5000

# Use dumb-init as PID 1 to handle kernel signals and zombie processes cleanly
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

CMD ["node", "server.js"]
