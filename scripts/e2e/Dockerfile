# syntax=docker/dockerfile:1.7
#
# Shared Docker E2E image.
# `bare` is a clean Node/Git runner for install/update lanes. `functional`
# installs the prepared DaisyClaw npm tarball into /app for built-app lanes.

FROM node:24-bookworm-slim@sha256:242549cd46785b480c832479a730f4f2a20865d61ea2e404fdb2a5c3d3b73ecf AS e2e-runner

# python3 covers package/plugin install paths that execute helper scripts.
# procps provides pgrep for E2E watchdogs that assert no package-manager work is
# still running after Gateway readiness.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates git procps python3 \
 && rm -rf /var/lib/apt/lists/*

RUN corepack enable
RUN npm install -g tsx@4.21.0 --no-fund --no-audit

RUN useradd --create-home --shell /bin/bash appuser \
 && mkdir -p /app \
 && chown appuser:appuser /app

ENV HOME="/home/appuser"
ENV PATH="/home/appuser/.local/bin:${PATH}"
ENV NODE_OPTIONS="--disable-warning=ExperimentalWarning"
# Docker E2E lanes start many loopback gateways concurrently; mDNS advertising
# is unrelated to those checks and can flap under container CPU/network load.
ENV DAISYCLAW_DISABLE_BONJOUR="1"

USER appuser
WORKDIR /app

FROM e2e-runner AS bare

CMD ["bash"]

FROM bare AS build

CMD ["bash"]

FROM bare AS functional

# The app under test enters through the named BuildKit context, not by copying
# checkout sources into the image.
COPY --from=daisyclaw_package --chown=appuser:appuser daisyclaw-current.tgz /tmp/daisyclaw-current.tgz
# Preserve package self-reference imports such as daisyclaw/plugin-sdk/* after
# copying the installed package out of npm's global node_modules tree.
RUN npm install -g --prefix /tmp/daisyclaw-prefix /tmp/daisyclaw-current.tgz --no-fund --no-audit \
 && cp -a /tmp/daisyclaw-prefix/lib/node_modules/daisyclaw/. /app/ \
 && mkdir -p "$HOME/.local/bin" \
 && ln -sf /app/daisyclaw.mjs "$HOME/.local/bin/daisyclaw" \
 && rm -rf /app/node_modules/daisyclaw \
 && ln -sf /app /app/node_modules/daisyclaw \
 && rm -rf /tmp/daisyclaw-prefix /tmp/daisyclaw-current.tgz

CMD ["bash"]
