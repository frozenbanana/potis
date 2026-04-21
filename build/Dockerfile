FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json ./
RUN npm install --production

FROM node:22-alpine

LABEL org.opencontainers.image.title="Potis"
LABEL org.opencontainers.image.description="Decentralized Key-Value Store (POT + Redis)"
LABEL org.opencontainers.image.source="https://github.com/brainiac-five/potis"

WORKDIR /app

RUN apk add --no-cache wget

COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./
COPY server.js ./

RUN mkdir -p /app/data /app/public

COPY public/ ./public/

ENV PORT=8080
ENV BEE_URL=http://host.docker.internal:1633
ENV BATCH_ID=""
ENV NODE_ENV=production

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget -q --spider http://localhost:8080/health || exit 1

CMD ["node", "server.js"]