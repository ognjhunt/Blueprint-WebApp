# Monitoring & Alerting (Render)

This guide documents how to confirm service health in Render and set up uptime/5xx alerting using the existing health endpoints.

## 1) Check Render logs for crash loops or missing env vars

1. Open **Render → Service → Logs**.
2. Filter for:
   - **Crash loops**: repeated “process exited” or restart messages.
   - **Missing env vars**: `process.env` warnings or explicit “undefined env var” errors.
   - **Health check failures**: repeated 5xx around `/health` or `/health/ready`.
3. If you see missing secrets, compare against the list in `DEPLOYMENT.md` and fix in Render’s **Environment** settings. 

## 2) Confirm plan/cold-start behavior

Render plan behavior can affect cold starts. Verify the current plan in **Render → Service → Settings** and confirm whether your plan includes cold-start sleep. If requests are failing after inactivity, consider upgrading the service plan to avoid idle spin-downs. 

## 3) Verify `/health` and `/health/ready` in production

These endpoints are already implemented:

```bash
curl -i https://<your-render-domain>/health
curl -i https://<your-render-domain>/health/ready
```

Both should return `200` when the service is healthy and ready.

## 4) Add uptime monitoring + 5xx alerting

### Uptime monitoring
Use any external uptime monitor (e.g., UptimeRobot, Better Stack, StatusCake) and point it at:

```
https://<your-render-domain>/health/ready
```

Configure a 1–5 minute check interval and enable notifications (email/Slack/PagerDuty).

### 5xx alerting
The server tracks error rates and counts in `/health/status`. Hook a log/metrics tool to:

```
https://<your-render-domain>/health/status
```

Set alert thresholds for:
- `metrics.errorRate` above a baseline (for example, >2% over 5–10 minutes).
- Or alert on any spikes in 5xx responses.

If you already use a logging platform, configure a query/alert for `statusCode >= 500` and page on a spike.
