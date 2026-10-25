# One image runs everything: API + chat widget + dashboard (built into apps/dashboard/dist, served at /app).
FROM node:22-slim

# Prisma's query engine needs OpenSSL.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies first (cached unless a package.json changes).
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/dashboard/package.json apps/dashboard/
COPY apps/widget/package.json apps/widget/
COPY packages/shared/package.json packages/shared/
RUN npm ci --include=dev

COPY . .

# Prisma client + dashboard build. The dashboard calls the API on the same origin.
RUN npx prisma generate --schema apps/api/prisma/schema.prisma \
    && npm run build -w @leadpilot/dashboard

ENV NODE_ENV=production
EXPOSE 4000
CMD ["npm", "run", "start", "-w", "@leadpilot/api"]
