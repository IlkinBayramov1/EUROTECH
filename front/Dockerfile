# ==========================================
# EUROTECH FRONTEND MULTI-STAGE DOCKERFILE
# Node 22 Alpine Builder -> Nginx Alpine Runner
# ==========================================

# Stage 1: Build Frontend Assets
FROM node:22-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run build

# Stage 2: Serve with Nginx Alpine
FROM nginx:alpine AS runner

COPY --from=builder /usr/src/app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
