# ──────────────────────────────────────────────────────────────────────────────
# BUILD STAGE
# ──────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Install build dependencies
RUN apk add --no-cache libc6-compat python3 make g++

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source
COPY . .

# Build NestJS
RUN npm run build


# ──────────────────────────────────────────────────────────────────────────────
# PRODUCTION DEPENDENCIES
# ──────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /usr/src/app

COPY package*.json ./

# Install production dependencies only
RUN npm install --omit=dev


# ──────────────────────────────────────────────────────────────────────────────
# RUNNER
# ──────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /usr/src/app

ENV NODE_ENV=production

# Copy application
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/package*.json ./

# Create upload directories
RUN mkdir -p /usr/src/app/uploads/apks /usr/src/app/uploads/dpc \
    && chown -R node:node /usr/src/app

# Switch to non-root user
USER node

EXPOSE 3001

CMD ["node", "dist/main.js"]