# Smart Storage Health Monitor

Local storage-health monitoring app with:

- Python worker for SMART/OS telemetry and AI risk analysis
- SQLite local persistence
- Spring Boot REST API
- React + Bootstrap dashboard

## Structure

```text
backend/storage-health-api/      Spring Boot API
engine/                          Python telemetry + AI analyzer
engine/models/                   Serialized local prediction model
frontend/sshm-dashboard/         React Bootstrap dashboard
*.bat                            Windows run scripts
```

## Run

From `D:\Smart Storage Health Monitor`, use:

```bat
start-all.bat
```

Then open:

- Dashboard: http://localhost:5173
- API summary: http://localhost:8081/api/metrics/dashboard-summary
- AI analysis: http://localhost:8081/api/analysis/latest

## Run Parts Manually

```bat
run-worker-once.bat
run-ai-analysis-once.bat
run-backend.bat
run-frontend.bat
```

For continuous telemetry:

```bat
run-worker-continuous.bat
```

Optional Gemini integration uses `GEMINI_API_KEY`. Without it, the Python AI analyzer uses its local plain-English fallback.

## Cloud Sync

The local Python worker can push live device telemetry to the deployed backend.

Render backend environment variables:

```text
SQLITE_DB_PATH=./storage_health.db
INGEST_API_KEY=choose-a-shared-secret
```

Local PowerShell environment variables:

```powershell
$env:CLOUD_API_BASE_URL="https://your-render-app.onrender.com/api"
$env:CLOUD_INGEST_TOKEN="choose-a-shared-secret"
```

Then run:

```powershell
.\run-cloud-sync-once.bat
.\run-worker-continuous.bat
```

The frontend deployed on Vercel should use:

```text
VITE_API_BASE_URL=https://your-render-app.onrender.com/api
```
