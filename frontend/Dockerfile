# ─── BUILD STAGE ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Install build essentials if native node-modules require them (alpine specific)
RUN apk add --no-cache libc6-compat

COPY package*.json ./

# Install all dependencies
RUN npm ci

COPY . .

# Disable Next.js telemetry during build time
ENV NEXT_TELEMETRY_DISABLED=1

# Accept NEXT_PUBLIC_* vars at build time (they get baked into the JS bundle)
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_BACKEND_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL

# Build the Next.js application
RUN npm run build

# ─── RUNNER STAGE ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /usr/src/app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Disable Next.js telemetry during runtime
ENV NEXT_TELEMETRY_DISABLED=1

# Use non-root node user for container security
USER node

# Copy built resources from builder stage (utilizing Next.js standalone output)
COPY --chown=node:node --from=builder /usr/src/app/public ./public
COPY --chown=node:node --from=builder /usr/src/app/.next/standalone ./
COPY --chown=node:node --from=builder /usr/src/app/.next/static ./.next/static

# Expose Next.js runtime port
EXPOSE 3000

# Next.js standalone build outputs server.js
CMD ["node", "server.js"]
