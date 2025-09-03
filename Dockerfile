FROM oven/bun:latest
WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile
RUN bun run build
EXPOSE 3000
CMD ["bun", "run", "start"]