FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ─────────────────────────────────────────────
# PRODUCTION STAGE
# Serves the built static files using Nginx.
# This is a separate lightweight Nginx instance
# just for static file serving — not our main
# Nginx reverse proxy container.
#
# Why not serve from Node?
# Nginx serves static files much faster than
# Node.js and with less memory.
# ─────────────────────────────────────────────
FROM nginx:alpine AS production

# Copy built files to Nginx's default serve directory
COPY --from=builder /app/dist /usr/share/nginx/html

# Custom Nginx config for React Router (SPA)
# Without this, refreshing /dashboard gives a 404
# because Nginx looks for a literal /dashboard folder.
# The config below redirects all routes to index.html
# and lets React Router handle navigation client-side.
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]