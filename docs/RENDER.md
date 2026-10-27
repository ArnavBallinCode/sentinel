# Hosting Sentinel on Render

Sentinel can run as a protected, shared workspace on Render. This is not a multi-tenant SaaS deployment: everyone given the workspace password can access its runs and configured provider operations. Give access only to trusted operators/reviewers. Keep the public video separate from private call evidence.

## Topology and cost

The root [render.yaml](../render.yaml) describes two services in Singapore:

| Resource | Configuration | Starting monthly cost |
| --- | --- | --- |
| `sentinel-web` | Public Node web service, 0.5 CPU / 512 MB | $7 |
| `sentinel-api` | Private Python service, 0.5 CPU / 512 MB, one worker | $7 |
| `sentinel-evidence` | 1 GB persistent disk mounted at `/var/data` | $0.25 |

Total: approximately **$14.25/month**, before taxes, bandwidth/build overages and external model/phone usage. Prices checked 27 October 2026 against [Render pricing](https://render.com/pricing). $50 in eligible credit covers roughly 3.5 months at the base rate, assuming no other spending or credit expiry. Credits are not a spending cap; review the workspace's billing and credit-expiry terms. No automatic upgrade or scaling is configured.

Render requires payment information for this workspace's paid resources even when credits are available. The initial Blueprint validation returned `need_payment_info`. Resolve this in the workspace Billing page before provisioning. Do not substitute free ephemeral storage for the evidence disk.

## Provisioning

1. Connect Render to the private `ArnavBallinCode/sentinel` repository, granting access to this repository only where possible.
2. Validate `render.yaml` with `render blueprints validate render.yaml`. Create a Blueprint from the repository, or create the equivalent services through the Render API. Do not create both and duplicate the resources.
3. Keep both services on the same region/private network. Keep the API private and at one instance/one worker. Its disk must exist before saving evidence.
4. Configure the web service with the API's internal `host:port` as `API_HOSTPORT`. This is used at build time, so rebuild the frontend if it changes.
5. Use the same randomly generated `SENTINEL_API_TOKEN` on both services (at least 32 characters). Set `SENTINEL_REQUIRE_AUTH=true`, `SENTINEL_WEB_USERNAME=sentinel` and a random `SENTINEL_WEB_PASSWORD` of at least 24 characters on the web service only. The Blueprint generates both secrets; retrieve the web password privately from Render's environment settings.
6. Set the API's `ALLOWED_ORIGINS` to the exact HTTPS web-service origin. Add the exact custom-domain origin when it is connected. Use comma-separated origins without trailing slashes.
7. Deploy the API and web app. Only `/api/health` is anonymously accessible; it contains no workspace data. All other web/API paths require the shared browser login. The frontend injects the internal API token server-side after authentication; the token never belongs in browser code.

Automatic deployments are disabled initially so ordinary edits cannot interrupt a recorded demonstration. Trigger deliberate deploys after checks pass. A disk-backed API briefly stops during deployments; finish active runs/calls first. Disk persistence does not preserve in-flight Python tasks.

## Provider configuration

Configure optional provider keys **only on `sentinel-api`**:

- `GROQ_API_KEY` or `OPENAI_API_KEY` for model testing; see [.env.example](../.env.example) for role/model settings.
- `BOLNA_API_KEY` for the hosted adapter.
- `ALLOWED_TEST_NUMBERS` with explicitly authorized E.164 recipients; the Blueprint sets `MAX_LIVE_CALLS_PER_DAY=3`.
- `RECORDING_ALLOWED_HOSTS` if restricting signed/public audio origins.

Start with a fresh database and synthetic data. Do not upload the local database, prompt snapshots or recordings as a deployment convenience. Credentials do not prove provider connectivity; perform explicit read-only connection checks after deployment. Telephone calls and hosted prompt changes are separate, deliberate operator actions.

Direct Bolna callbacks do not bypass the shared access gate. Use the existing manual refresh/import flow unless a separately authenticated callback gateway is implemented and verified. The controlled synthetic-tool endpoint is also behind the gate in this topology; do not claim a hosted live-tool interception integration from this deployment alone.

## Domain options

**Recommended:** keep Sentinel independent and use `sentinel.angarkar.tech`. In Render, add that custom domain to the web service. At the DNS provider, add a CNAME named `sentinel` pointing to the web service's assigned `*.onrender.com` hostname. Use the actual assigned hostname, not an example. Render validates DNS and provisions HTTPS. This does not require changing the apex website or mail records.

**Optional temporary Voxbento link:** Voxbento's main application is FastAPI behind Caddy. A redirect from `voxbento.com/sentinel` to the deployed Sentinel URL can be added to its existing `voxbento.com` site block:

```caddyfile
# Replace the destination with the verified live Sentinel address.
@sentinel_entry path /sentinel /sentinel/
redir @sentinel_entry https://sentinel.angarkar.tech/demo 302
```

Use a temporary 302 so the link can be removed without a permanently cached redirect. Validate the complete Caddy configuration before reloading. This is an optional example, not a change already applied to Voxbento.

To keep the full application at `voxbento.com/sentinel`, Sentinel would need base-path-aware assets, API calls, navigation and proxy configuration. That is a larger integration than adding a redirect or landing page and is not required for this Render deployment. A separate `sentinel.voxbento.com` hostname would also keep deployments independent if that branding is desired.

## Acceptance and operations

`npm run verify` includes protected production-browser checks with synthetic credentials: anonymous/spoofed requests, private API access, authorized workflow execution, export, event streaming, cross-origin rejection and missing-secret failure. These checks use temporary local data and never call providers.

After deploying, explicitly verify the live URL's access gate and health, then run a clearly labeled synthetic release check. Verify its saved run survives an API restart before calling persistence verified. Check provider connections separately. Keep any live verification result and its date in [VERIFICATION.md](VERIFICATION.md).

Keep the disk when suspending or redeploying. Deleting the disk destroys its evidence. Make consistent database backups before upgrades; platform snapshots alone are not a validated SQLite restore procedure. Monitor disk usage before importing recordings.
