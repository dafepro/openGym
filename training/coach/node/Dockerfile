# Build context: training/. Runtime has no npm dependencies or package installer.
FROM node:22.22.0-bookworm-slim@sha256:dd9d21971ec4395903fa6143c2b9267d048ae01ca6d3ea96f16cb30df6187d94
ENV NODE_ENV=production NODE_OPTIONS=--max-old-space-size=128 PORT=8787
WORKDIR /app
COPY --chown=node:node package.json ./package.json
COPY --chown=node:node coach ./coach
COPY --chown=node:node worker/http.js ./worker/http.js
COPY --chown=node:node src/domain ./src/domain
USER node
EXPOSE 8787
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 CMD ["node", "--input-type=module", "-e", "const r=await fetch('http://127.0.0.1:8787/healthz');process.exit(r.ok?0:1)"]
CMD ["node", "coach/node/server.mjs"]
