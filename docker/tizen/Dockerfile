# Tizen Studio CLI image for packaging the Flixor .wgt in CI.
# Mirrors the proven jellyfin-tizen CI approach (a container with the Tizen CLI
# that signs + packages a prebuilt web bundle).
#
# NOTE: the Tizen Studio version/URL and the exact package-manager package names
# below are the one thing that drifts over time. If a CI run fails at the install
# step, bump TIZEN_VERSION / verify the package ids against:
#   https://developer.tizen.org/development/tizen-studio/download
FROM eclipse-temurin:17-jdk-jammy

ARG TIZEN_VERSION=5.6
ARG TIZEN_INSTALLER=web-cli_Tizen_Studio_${TIZEN_VERSION}_ubuntu-64.bin

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
      wget ca-certificates libpython3-dev pciutils zip unzip \
      libwebkit2gtk-4.0-37 libsdl2-2.0-0 expect \
    && rm -rf /var/lib/apt/lists/*

ENV TIZEN_HOME=/home/tizen/tizen-studio
RUN useradd -ms /bin/bash tizen
USER tizen
WORKDIR /home/tizen

# Headless install of the Tizen Studio CLI, then the TV extension + cert tooling.
RUN wget -q "https://download.tizen.org/sdk/Installer/tizen-studio_${TIZEN_VERSION}/${TIZEN_INSTALLER}" -O installer.bin \
    && chmod +x installer.bin \
    && ./installer.bin --accept-license "${TIZEN_HOME}" \
    && rm installer.bin

ENV PATH="${TIZEN_HOME}/tools/ide/bin:${TIZEN_HOME}/tools:${PATH}"

RUN package-manager-cli.bin install \
      TIZEN-5.0-NativeAppDevelopment-CLI \
      cert-add-on \
      MOBILE-5.0-NativeAppDevelopment-CLI 2>/dev/null || true
# TV extension (provides the tv-samsung profile/tooling)
RUN package-manager-cli.bin install --accept-license tv-samsung-public-5.0 2>/dev/null || true

COPY --chown=tizen:tizen package.sh /home/tizen/package.sh
RUN chmod +x /home/tizen/package.sh

ENTRYPOINT ["/home/tizen/package.sh"]
