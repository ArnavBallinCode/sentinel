FROM python:3.13-slim
WORKDIR /app
COPY --from=ghcr.io/astral-sh/uv:0.9.5 /uv /usr/local/bin/uv
COPY services/api/pyproject.toml services/api/uv.lock ./
RUN uv sync --frozen --no-dev
COPY services/api/sentinel ./sentinel
RUN useradd --create-home sentinel && mkdir /app/data && chown -R sentinel:sentinel /app
USER sentinel
EXPOSE 8000
CMD ["uv", "run", "--no-sync", "uvicorn", "sentinel.main:app", "--host", "0.0.0.0", "--port", "8000"]
