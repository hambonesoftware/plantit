// @ts-check

/**
 * @typedef {import("./apiClient.js").APIClient} APIClient
 * @typedef {import("../../types/api").components["schemas"]["DashboardResponse"]} DashboardResponse
 */

/**
 * Fetch the dashboard summary DTO from the API.
 * @param {APIClient} apiClient
 * @returns {Promise<DashboardResponse>}
 */
export async function fetchDashboard(apiClient) {
  const response = await apiClient.get("/dashboard");
  const { data } = response ?? {};
  if (!data || typeof data !== "object") {
    throw new Error("Malformed dashboard response");
  }
  const { villages, today, calendar } = /** @type {DashboardResponse} */ (data);
  if (!Array.isArray(villages) || !Array.isArray(today) || !Array.isArray(calendar)) {
    throw new Error("Malformed dashboard payload");
  }
  return /** @type {DashboardResponse} */ ({ villages, today, calendar });
}
