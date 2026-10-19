# Test / staging instance

A second, fully isolated instance of the same commit runs on this host for testing. It shares the
managed catalogue/auth backend but has its **own build, port, systemd unit and SQLite database**.

| Item                      | Production                                | Test / staging                                 |
| ------------------------- | ----------------------------------------- | ---------------------------------------------- |
| URL                       | https://proteinstore.46.225.2.52.sslip.io | https://test.proteinstore.46.225.2.52.sslip.io |
| Port                      | 5077                                      | **5078**                                       |
| Unit                      | `proteinstore`                            | **`proteinstore-test`**                        |
| Code                      | `/root/Said/proteinstore`                 | `/root/Said/proteinstore-test`                 |
| Database                  | `data/proteinstore.db`                    | `proteinstore-test/data/proteinstore.db`       |
| Indexing                  | allowed                                   | **`X-Robots-Tag: noindex`**                    |
| Catalogue/auth            | managed backend                           | same managed backend                           |
| Orders/customers/invoices | separate                                  | **separate**                                   |

## First-time setup (done)

```bash
git clone /root/Said/proteinstore /root/Said/proteinstore-test
cp -al /root/Said/proteinstore/node_modules /root/Said/proteinstore-test/node_modules   # hardlinks, no extra disk
cp /root/Said/proteinstore/.env /root/Said/proteinstore-test/.env
# append ORDER_DB_PATH, SITE_URL, VITE_SITE_URL for the test host
npm run build
install -m 644 deploy/proteinstore-test.service /etc/systemd/system/
systemctl daemon-reload && systemctl enable --now proteinstore-test
# append deploy/Caddyfile.test.snippet to /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
```

## Update the test instance

```bash
cd /root/Said/proteinstore-test
git pull --ff-only
./deploy/deploy-test.sh
```

## Reset test data

```bash
systemctl stop proteinstore-test
rm -f data/proteinstore.db data/proteinstore.db-wal data/proteinstore.db-shm
systemctl start proteinstore-test
```

## Notes

- Staging is **publicly reachable** on the sslip.io host, but marked `noindex`. It shares the admin
  accounts; use a non-production admin if you want stricter separation.
- It has no access to production order data: the SQLite files are different.
- The dependency tree is hard-linked to save disk on this shared host; do not run `npm install`
  in the test directory without removing the hardlinks first.
- Remove the vhost block and `systemctl disable --now proteinstore-test` to retire it.
