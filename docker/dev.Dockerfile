# Dev box for wb_server: Amazon Linux 2023 (what production runs) plus Rust.
# The project is bind-mounted at /whiteboard by docker-compose.yml, so nothing
# is copied in here.
FROM amazonlinux:2023

RUN dnf install -y gcc tar gzip findutils && dnf clean all

# AL2023's own rust package lags; the crate needs edition 2024 (Rust >= 1.85).
ENV RUSTUP_HOME=/usr/local/rustup \
    CARGO_HOME=/usr/local/cargo \
    PATH=/usr/local/cargo/bin:$PATH
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \
      | sh -s -- -y --profile minimal --default-toolchain 1.98.0 \
    && rustc --version && cargo --version

WORKDIR /whiteboard/wb_server
