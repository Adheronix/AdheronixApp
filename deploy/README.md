# Isolated Adheronix preview deployment

This stack is separate from Diamond Hardware. Use `/opt/adheronix` for its files,
the `adheronix-preview` Compose project, its own PostgreSQL volume and credentials,
and the loopback-only API port 3260. It joins no Diamond network and mounts no
Diamond files or Docker socket. The runtime API is non-root, read-only, drops
capabilities, and has CPU, memory, process and log limits. The database is not
published on the host. This isolation does not remove shared-host capacity limits.

Before deploying, inspect free memory/disk and existing listeners, record Diamond's
container health/identities, and check its public API. Do not restart or rebuild
Diamond, prune shared Docker resources, reuse its secrets, or modify its database.

## Fresh database only

Build from the repository root with `docker build -f backend-api/Dockerfile -t
adheronix-api:COMMIT_SHA .`. Build on a separate machine where possible; otherwise
bound build resources after checking VPS capacity. Transfer only committed source
or the resulting image, never development databases or private backup files.

Copy `compose.yaml` into the Adheronix deployment directory. Create its private
`.env` from the example with independent random values of at least 32 characters
for database passwords, JWT and admin setup. Set file mode 0600 and directory mode
0700. Keep the release keystore on the build machine, not the VPS. AI keys are
optional; without them the assistant returns an unavailable response.

Run these commands from that dedicated deployment directory:

```sh
docker compose up -d database
docker compose --profile tools run --rm migrate
docker compose up -d api
curl --fail http://127.0.0.1:3260/ready
```

The migration records a checksum and refuses an existing unversioned schema.
It creates an independent runtime role with table access but no schema ownership
or DDL privileges. Runtime startup in production does not synchronize entities or
create RAG tables. Existing Adheronix databases need a separately reviewed upgrade;
this initial migration is not an automatic retrofit.

Publish through a dedicated HTTPS virtual host only after identifying the current
reverse proxy. Validate the complete proxy configuration before a graceful reload;
keep Diamond's hostnames, routes, certificates and upstreams unchanged. Do not
publish port 3260 or PostgreSQL on all interfaces, disable TLS checks, or weaken
the VPS firewall to solve a connection problem.

Verify readiness, signup/login, patient-scoped medication/schedule reads, explicit
confirmation, assistant error behavior and device authentication using a disposable
test account. Compare Diamond's container identities and public health afterward.
Keep an Adheronix-only encrypted backup and demonstrate restore before real records
are admitted. Rollback changes only this Compose project's image/configuration;
do not remove its database volume.

## Android preview release

Use `mobile-api/scripts/build-release.cjs` with a verified public HTTPS
`EXPO_PUBLIC_API_URL`, an installed Android SDK/JDK, and private environment values
`ADHERONIX_KEYSTORE`, `ADHERONIX_STORE_PASSWORD`, `ADHERONIX_KEY_PASSWORD`,
`ADHERONIX_KEY_ALIAS`, and `ADHERONIX_RELEASE_OUTPUT`. Default ABIs are arm64-v8a
and x86_64. The script embeds JavaScript, ignores local dotenv files, aligns the
APK, replaces the generated debug signature with the private release signature,
and verifies it. Keep the key and its password backed up privately for updates.

Install and cold-launch the actual APK against the deployed backend before adding
it to a GitHub prerelease. Include SHA-256 checksums and concrete verification
limits. An Expo Go session is not proof of a standalone APK. iOS distribution
requires its own Apple signing/build workflow.

The GitHub workflow builds candidates on hosted runners without private release
keys. After verifying a run's commit SHA and downloading its Android artifact,
set `ADHERONIX_CANDIDATE_APK` to sign that candidate locally with the same script.
The workflow targets the dedicated Cloudflare preview hostname
`adheronix-api.diamondhardware.co`. This is a build setting, not evidence that
the VPS endpoint is deployed; keep the release draft until HTTPS and the packaged
app's account flow have been verified there.

## Current preview routing

The preview API uses `https://adheronix-api.diamondhardware.co`, routed by the
existing remotely managed Cloudflare connector to `http://127.0.0.1:3260`.
Keep every existing Diamond ingress entry and the final catch-all unchanged.
This route does not need a proxy restart, a new public host port, or changes to
Diamond's containers. TLS terminates at Cloudflare; the origin hop stays on
the VPS loopback interface. The hostname is temporary until an Adheronix-owned
domain is available. The apps remain separate Compose projects, but still share
the VPS and Cloudflare connector and therefore share those failure domains.

Administrative recovery currently uses a separately IP-restricted temporary
SSH hostname through the same connector, existing SSH keys and pinned host key.
Its source-IP allowlist must be updated through Cloudflare if the administrator's
public IP changes. Do not broaden it to all source addresses. VPN autostart is
not required. Remove only that administrative ingress/DNS/rule when it is no
longer needed; preserve the API route and all Diamond routes.
