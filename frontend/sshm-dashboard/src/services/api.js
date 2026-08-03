const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8081/api";

/**
 * Fetches complete dashboard summary from Spring Boot backend.
 *
 * Backend endpoint:
 * GET /api/metrics/dashboard-summary
 */
export async function fetchDashboardSummary() {
  const response = await fetch(`${API_BASE_URL}/metrics/dashboard-summary`);

  if (!response.ok) {
    throw new Error("Failed to fetch dashboard summary from backend");
  }

  return response.json();
}

/**
 * Fetches SMART metric history from the backend.
 *
 * Backend endpoint:
 * GET /api/metrics/history
 */
export async function fetchMetricsHistory(hours = 24) {
  const response = await fetch(`${API_BASE_URL}/metrics/history?hours=${encodeURIComponent(hours)}`);

  if (!response.ok) {
    throw new Error("Failed to fetch metrics history from backend");
  }

  return response.json();
}

/**
 * Fetches latest Python AI/ML analysis from the backend.
 *
 * Backend endpoint:
 * GET /api/analysis/latest
 */
export async function fetchLatestAnalysis() {
  const response = await fetch(`${API_BASE_URL}/analysis/latest`);

  if (!response.ok) {
    throw new Error("Failed to fetch AI analysis from backend");
  }

  return response.json();
}
