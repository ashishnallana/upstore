# syntax=docker/dockerfile:1.7
# =============================================================================
# UpStore all-in-one image: the Next.js store + the YouPI UPI payment gateway.
#
#   docker compose --env-file .env.docker up -d --build
#
# YouPI is fetched from its upstream repository at a pinned commit during the
# build (this repo doesn't contain YouPI's code; it has no open-source license).
# Don't push images built from this file to a public registry.
# =============================================================================

ARG NODE_IMAGE=node:24-alpine
ARG YOUPI_REPO=https://github.com/youpi-pg/YouPI-PG.git
ARG YOUPI_REF=d7b07414d803094525ceedd5cf81e8a38157263e

FROM ${NODE_IMAGE} AS base
RUN apk add --no-cache libc6-compat
ENV NEXT_TELEMETRY_DISABLED=1

# ── YouPI gateway (mirrors upstream's Dockerfile build steps) ────────────────
FROM base AS youpi
ARG YOUPI_REPO
ARG YOUPI_REF
RUN apk add --no-cache git python3 make g++
WORKDIR /youpi
RUN git init -q \
 && git remote add origin "$YOUPI_REPO" \
 && git fetch -q --depth 1 origin "$YOUPI_REF" \
 && git checkout -q FETCH_HEAD \
 && rm -rf .git
# No third-party install scripts; better-sqlite3 (WhatsApp OTP) is compiled explicitly.
RUN npm ci --ignore-scripts \
 && npm rebuild better-sqlite3 \
 && npm run build \
 && npm prune --omit=dev \
 && npm cache clean --force

# ── Store ─────────────────────────────────────────────────────────────────────
FROM base AS store-deps
WORKDIR /store
COPY package.json package-lock.json ./
RUN npm ci

FROM store-deps AS store
# NEXT_PUBLIC_* values are compiled into the client bundle, so they're build args.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_SITE_URL
RUN for v in NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY NEXT_PUBLIC_SITE_URL; do \
      eval "test -n \"\$$v\"" || { echo "Build arg $v is empty. Build with: docker compose --env-file .env.docker up -d --build"; exit 1; }; \
    done
COPY . .
RUN npm run build

# ── Runtime ───────────────────────────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production
RUN apk add --no-cache tini \
 && addgroup -S -g 1001 app && adduser -S -u 1001 -G app app
WORKDIR /app

COPY --from=youpi --chown=app:app /youpi ./youpi
COPY --from=store --chown=app:app /store/.next/standalone ./store
COPY --from=store --chown=app:app /store/.next/static ./store/.next/static
COPY --from=store --chown=app:app /store/public ./store/public
COPY --chown=app:app docker/start.mjs scripts/lib/youpi-admin.mjs ./

RUN mkdir -p /app/youpi/data && chown -R app:app /app/youpi/data
VOLUME ["/app/youpi/data"]

USER app
# 3000: store · 7000: hosted payment checkout · 6001: gateway Merchant Admin (keep private)
EXPOSE 3000 7000 6001

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget -qO /dev/null http://127.0.0.1:3000/login || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "start.mjs"]
