# Phase 8.1 staging image factory. Operator MUST publish an immutable digest
# and supply that digest to compose; this Dockerfile is not a production release approval.
FROM node:22-alpine AS build
WORKDIR /app
COPY server/package.json ./
RUN npm install --no-audit --no-fund
COPY server/tsconfig*.json ./
COPY server/src ./src
RUN npm run build

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY server/package.json ./
RUN npm install --omit=dev --no-audit --no-fund \
    && addgroup -S -g 10001 nutrition \
    && adduser -S -u 10001 -G nutrition nutrition
COPY --from=build --chown=nutrition:nutrition /app/dist ./dist
USER nutrition
EXPOSE 3001
CMD ["node", "dist/index.js"]
