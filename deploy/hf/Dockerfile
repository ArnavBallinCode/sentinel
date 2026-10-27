# Single-container Hugging Face Space: the API stays on loopback, only the gated web app is exposed.
FROM node:22-slim AS web
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/package.json
RUN npm ci
COPY apps/web ./apps/web
# Served behind voxbento.com/sentinel; both values are baked in at build time.
ENV NEXT_PUBLIC_BASE_PATH=/sentinel API_URL=http://127.0.0.1:8001
RUN npm run build

FROM python:3.13-slim
COPY --from=node:22-slim /usr/local/bin/node /usr/local/bin/node
COPY --from=ghcr.io/astral-sh/uv:0.9.5 /uv /usr/local/bin/uv
RUN useradd --create-home --uid 1000 sentinel
WORKDIR /app/api
COPY services/api/pyproject.toml services/api/uv.lock ./
RUN uv sync --frozen --no-dev
COPY services/api/sentinel ./sentinel
COPY --from=web /app /app/web
COPY deploy/hf/start.sh /app/start.sh
RUN chown -R sentinel:sentinel /app
USER sentinel
ENV NODE_ENV=production SENTINEL_DATA_DIR=/tmp/sentinel SENTINEL_REQUIRE_AUTH=true
EXPOSE 7860
CMD ["bash", "/app/start.sh"]
