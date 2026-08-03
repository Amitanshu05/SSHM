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
