# Thinking Graph image: a recipe for packaging the app.
# It has two stages. Stage 1 builds the interface, stage 2 runs the server.
# Only stage 2 ends up in the final image; stage 1 is thrown away.

# ---------- Stage 1: build the React interface ----------
# Start from an official image that already has Node.js installed.
FROM node:24-slim AS frontend

# All following commands run inside this folder (in the image, not on Windows).
WORKDIR /app

# Copy only the dependency lists first, then install.
# Docker caches each step: if these files did not change, the slow
# "npm ci" step is reused on the next build instead of running again.
COPY package.json package-lock.json .npmrc ./
RUN npm ci

# Now copy the interface source code and build it into dist/.
COPY index.html vite.config.ts tsconfig.json postcss.config.mjs components.json ./
COPY src ./src
COPY components ./components
COPY lib ./lib
COPY hooks ./hooks
COPY public ./public
COPY vendor ./vendor
RUN npm run build


# ---------- Stage 2: the Python server (the final image) ----------
FROM python:3.12-slim

WORKDIR /app

# Same caching trick: install Python libraries before copying the code.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# The server code and the database migrations.
COPY alembic.ini ./
COPY backend ./backend
COPY migrations ./migrations
COPY public ./public

# Take ONLY the finished interface from stage 1. Node.js itself is not copied.
COPY --from=frontend /app/dist ./dist

# Documentation: the server inside listens on port 8000.
EXPOSE 8000

# The start command: what runs when a container is created from this image.
# --host 0.0.0.0 is needed INSIDE a container so traffic forwarded from Windows
# can reach it. Who can reach it from outside is decided by the port mapping
# in "docker run" (we use 127.0.0.1 = only this computer).
CMD ["uvicorn", "backend.main:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000"]
