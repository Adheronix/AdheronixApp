FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend-api/package.json backend-api/package.json
COPY mobile-api/package.json mobile-api/package.json
RUN npm ci --workspace=backend-api --include-workspace-root --ignore-scripts --no-audit --no-fund
COPY backend-api/tsconfig*.json backend-api/nest-cli.json backend-api/
COPY backend-api/src backend-api/src
RUN npm run build --workspace=backend-api
RUN npm prune --workspace=backend-api --include-workspace-root --omit=dev --ignore-scripts --no-audit --no-fund && mkdir -p backend-api/node_modules

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=3000 TZ=Africa/Kigali
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/backend-api/node_modules ./backend-api/node_modules
COPY --from=build --chown=node:node /app/backend-api/dist ./backend-api/dist
COPY --chown=node:node backend-api/scripts ./backend-api/scripts
COPY --chown=node:node backend-api/migrations ./backend-api/migrations
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "backend-api/dist/main.js"]
