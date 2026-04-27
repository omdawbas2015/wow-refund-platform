# Deploying v2 to Kubernetes

Tailored for a self-hosted **1-master + 2-worker** cluster.
Manifests live under [`v2/k8s/`](../k8s) as a Kustomize base + overlays.
For the Docker image build itself see [`DOCKER.md`](./DOCKER.md).

---

## 1. What you get

```
k8s/base/
  namespace.yaml         wow-refund namespace
  configmap.yaml         non-secret runtime config
  secret.example.yaml    skeleton for kubectl create secret
  postgres/              StatefulSet (1 replica, 10Gi PVC) + headless Service
  redis/                 Deployment (1 replica) + Service
  web/                   Deployment (3 replicas) + Service + Ingress (nginx)
                         + HPA (3-10 on CPU/mem) + PodDisruptionBudget (min 2)
  jobs/
    backup-pvc.yaml      separate 20Gi PVC for pg_dumps
    migrate.yaml         one-shot Job that runs `prisma migrate deploy`
    cronjobs.yaml        4 CronJobs:
                           */15 * * * *  scheduled-reports
                           */30 * * * *  sla-breach-scan
                           0  */6 * * *  fraud-scan
                           0  2  * * *   pg_dump backup (14-day retention)
k8s/overlays/dev/        example overlay (1 replica, dev hostname)
```

---

## 2. Pre-flight checklist

- [ ] kubectl configured against your cluster (`kubectl get nodes` shows 3 nodes)
- [ ] An **Ingress controller** is installed (NGINX is the default; if you use
      Traefik replace `ingressClassName: nginx` in `k8s/base/web/ingress.yaml`)
- [ ] The cluster has a **default StorageClass** (`kubectl get sc` should show
      one with `(default)`). The manifests use `storageClassName: ''` which
      defers to the default — works on local-path, longhorn, cephfs, rbd, etc.
- [ ] DNS for your chosen domain points to one of the worker nodes (or to the
      LoadBalancer / NodePort the Ingress controller advertises)
- [ ] The image `ghcr.io/omdawbas2015/wow-refund-platform:latest` has been
      built at least once by `.github/workflows/docker-build.yml` (visible at
      <https://github.com/omdawbas2015/wow-refund-platform/pkgs/container/wow-refund-platform>)

If the GHCR image is private, also create a pull secret and reference it:

```bash
kubectl -n wow-refund create secret docker-registry ghcr-pull \
  --docker-server=ghcr.io \
  --docker-username=omdawbas2015 \
  --docker-password=$GHCR_PAT
```

Then add `imagePullSecrets: [{ name: ghcr-pull }]` to the web Deployment.

---

## 3. Apply order

```bash
cd v2

# 3.1 Namespace + non-secret config
kubectl apply -f k8s/base/namespace.yaml
kubectl apply -f k8s/base/configmap.yaml

# 3.2 Real secret (DO NOT apply secret.example.yaml — it has placeholders)
kubectl -n wow-refund create secret generic wow-secrets \
  --from-literal=DATABASE_URL='postgresql://wow:STRONG@wow-postgres:5432/wow_refund?schema=public' \
  --from-literal=DIRECT_DATABASE_URL='postgresql://wow:STRONG@wow-postgres:5432/wow_refund?schema=public' \
  --from-literal=POSTGRES_PASSWORD='STRONG' \
  --from-literal=AUTH_SECRET="$(openssl rand -base64 32)" \
  --from-literal=CRON_SECRET="$(openssl rand -hex 24)" \
  --from-literal=PII_ENCRYPTION_KEY="$(openssl rand -hex 32)" \
  --from-literal=POWER_AUTOMATE_SIGNING_SECRET='REPLACE_OR_LEAVE_BLANK'

# 3.3 Postgres + Redis (data tier)
kubectl apply -f k8s/base/postgres/
kubectl apply -f k8s/base/redis/
kubectl -n wow-refund wait --for=condition=ready pod -l app.kubernetes.io/component=postgres --timeout=2m

# 3.4 Run the migration Job. First deploy ever:
#   - generate the initial Postgres migration history locally:
#       cd v2 && DATABASE_URL='postgresql://wow:STRONG@HOST:5432/wow_refund' \
#         pnpm --filter @wow/db migrate:dev:pg --name init
#       (this commits packages/db/prisma/postgres/migrations/)
#     Push, let CI rebuild the image, then run the migrate Job.
kubectl -n wow-refund delete job wow-migrate --ignore-not-found
kubectl apply -f k8s/base/jobs/backup-pvc.yaml
kubectl apply -f k8s/base/jobs/migrate.yaml
kubectl -n wow-refund wait --for=condition=complete job/wow-migrate --timeout=5m
kubectl -n wow-refund logs job/wow-migrate

# 3.5 Web tier + autoscaling + ingress
kubectl apply -f k8s/base/web/
kubectl -n wow-refund rollout status deploy/wow-web --timeout=5m

# 3.6 CronJobs
kubectl apply -f k8s/base/jobs/cronjobs.yaml
```

Or, with Kustomize (one shot):

```bash
kubectl apply -k v2/k8s/base
```

---

## 4. Verifying the deploy

```bash
# Pods all Ready?
kubectl -n wow-refund get pods

# Web is healthy?
kubectl -n wow-refund port-forward svc/wow-web 8080:80
curl http://127.0.0.1:8080/api/health

# Ingress reachable?
curl -I https://wow.example.com/api/health

# Cron firing?
kubectl -n wow-refund get cronjobs
kubectl -n wow-refund logs -l app.kubernetes.io/component=cron --tail=20

# Backups landing?
kubectl -n wow-refund exec -it $(kubectl -n wow-refund get pod -l app.kubernetes.io/component=postgres -o jsonpath='{.items[0].metadata.name}') -- ls -lh /var/lib/postgresql/data
```

---

## 5. Rolling deploys

CI pushes a new image on every commit. To roll a new image into prod:

```bash
# Pin to a specific SHA (recommended over :latest):
kubectl -n wow-refund set image deploy/wow-web web=ghcr.io/omdawbas2015/wow-refund-platform:sha-<short>
kubectl -n wow-refund rollout status deploy/wow-web

# Or simply restart to re-pull :latest:
kubectl -n wow-refund rollout restart deploy/wow-web
```

The `RollingUpdate` strategy + `maxUnavailable=1` + `PodDisruptionBudget
minAvailable=2` guarantees at least 2 pods are serving at all times.

---

## 6. Backup + restore

The `wow-cron-postgres-backup` CronJob writes a custom-format `pg_dump` to
the `wow-postgres-backups` PVC nightly at 02:00 UTC and prunes anything
older than 14 days.

### Restore

```bash
# 1. Copy the dump out of the PVC (or shell into a pod that mounts it).
kubectl -n wow-refund exec -it $(kubectl -n wow-refund get pod -l app.kubernetes.io/component=postgres -o jsonpath='{.items[0].metadata.name}') -- \
  pg_restore -U wow -d wow_refund --clean --if-exists /backups/wow_refund_<timestamp>.dump

# 2. Restart the web pods so they don't hold stale connections.
kubectl -n wow-refund rollout restart deploy/wow-web
```

For offsite copies, add a sidecar to `cronjobs.yaml` that `aws s3 cp`s
each new dump to S3-compatible storage.

---

## 7. When to upgrade beyond this topology

The single-instance Postgres StatefulSet is a deliberate trade-off
(simple, low-overhead, recoverable from nightly dumps). Move to
**[CloudNativePG](https://cloudnative-pg.io/)** or
**[Zalando postgres-operator](https://github.com/zalando/postgres-operator)**
when any of the following becomes true:

- The 2-5 minute failover window is unacceptable for SLA reasons
- The dataset grows past ~50GB (logical backups become slow)
- You need read replicas to scale dashboard / reports queries
- Compliance requires synchronous replication to a second AZ

For Redis, switch to `bitnami/redis-cluster` once SSE traffic justifies
multi-replica fanout.

---

## 8. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `wow-postgres-0` pod stuck `Pending` | No default StorageClass in cluster | `kubectl get sc` and either set a default or set `storageClassName` on the StatefulSet |
| `wow-web` pods `CrashLoopBackOff` immediately | `DATABASE_URL` wrong / migration not run | `kubectl logs deploy/wow-web` and re-run the migrate Job |
| Bell never fires (SSE broken) through ingress | Buffering on or read-timeout too short | Check `nginx.ingress.kubernetes.io/proxy-buffering: 'off'` annotation is applied |
| `kubectl rollout` hangs at "1 of 3 updated" | Image pull failing | Check `imagePullSecrets` if GHCR repo is private |
| HPA shows `<unknown>` for CPU | metrics-server not installed | `kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/...` |
