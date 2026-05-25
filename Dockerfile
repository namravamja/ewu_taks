FROM --platform=linux/arm64 node:24-slim AS runner

RUN apt-get update -y && apt-get install -y openssl wget && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm@10.30.3
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY libs/ ./libs/

RUN pnpm install --frozen-lockfile --ignore-scripts

COPY apps/api/dist ./apps/api/dist
COPY apps/email-sync/dist ./apps/email-sync/dist
COPY apps/email-classifier/dist ./apps/email-classifier/dist
COPY apps/queue-worker/dist ./apps/queue-worker/dist
COPY apps/breakglass-cli/dist ./apps/breakglass-cli/dist
COPY libs/database/prisma ./libs/database/prisma
COPY libs/database/src ./libs/database/src
COPY libs/core/src ./libs/core/src
COPY prisma.config.ts ./prisma.config.ts

EXPOSE 3000
EXPOSE 3001
CMD ["node", "apps/api/dist/main.js"]