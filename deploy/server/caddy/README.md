# Sentinel route on the VoxBento host

VoxBento's deploy workflow copies its repository Caddyfile over `/etc/caddy/Caddyfile` on every deploy, which drops
the `/sentinel` route. `sentinel-caddy.path` watches that file and runs `sentinel-caddy-ensure`, which re-inserts
`sentinel.caddy` into the `voxbento.com` site block, validates the result and reloads Caddy. Nothing in the VoxBento
repository changes. Expect `/sentinel` to be unavailable for a second or two after each VoxBento deploy.

Install (from `~/sentinel/deploy/server/caddy` on the host):

    sudo install -m 644 sentinel.caddy /etc/caddy/sentinel.caddy
    sudo install -m 755 sentinel-caddy-ensure /usr/local/sbin/sentinel-caddy-ensure
    sudo install -m 644 sentinel-caddy.path sentinel-caddy.service /etc/systemd/system/
    sudo systemctl daemon-reload
    sudo systemctl enable --now sentinel-caddy.path sentinel-caddy.service

Remove after the hackathon:

    sudo systemctl disable --now sentinel-caddy.path sentinel-caddy.service
    sudo rm /etc/systemd/system/sentinel-caddy.{path,service} /usr/local/sbin/sentinel-caddy-ensure /etc/caddy/sentinel.caddy
    sudo systemctl daemon-reload
    sudo cp ~/voxbento/Caddyfile /etc/caddy/Caddyfile && sudo systemctl reload caddy
    cd ~/sentinel/deploy/server && docker compose down -v
