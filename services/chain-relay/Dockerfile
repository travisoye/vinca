# syntax=docker/dockerfile:1
# Vinca Chain Relay — Production Container
# Multi-stage build producing a minimal, unprivileged Debian runner image.

# ─── Stage 1: Build ──────────────────────────────────────────────────────────
FROM rust:1.89-bookworm AS builder

WORKDIR /build

# Install build dependencies for tonic/gRPC and ring
RUN apt-get update && apt-get install -y --no-install-recommends \
    protobuf-compiler \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy workspace manifests
COPY Cargo.toml Cargo.lock ./
COPY crates/ crates/
COPY services/chain-relay/ services/chain-relay/

# Build release binary for chain relay
RUN cargo build --release -p vinca-chain-relay

# ─── Stage 2: Runtime ────────────────────────────────────────────────────────
FROM debian:bookworm-slim AS runner

WORKDIR /app

# Install runtime certificates and curl for health check
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create unprivileged system user
RUN groupadd -g 10001 vinca && \
    useradd -u 10001 -g vinca -s /bin/false -M vinca

# Copy binary from builder
COPY --from=builder /build/target/release/vinca-chain-relay /usr/local/bin/vinca-chain-relay

# Copy configuration
COPY services/chain-relay/relay.toml* /app/

# Expose default port
EXPOSE 8080

# Environment defaults
ENV PORT=8080 \
    RUST_LOG=info,vinca_chain_relay=info

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://127.0.0.1:${PORT}/health || exit 1

# Run as unprivileged user
USER vinca:vinca

ENTRYPOINT ["/usr/local/bin/vinca-chain-relay"]
