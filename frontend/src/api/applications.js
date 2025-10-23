// Frontend API for the `application` table
import client from "./client"; // your pre-configured axios instance

/** GET /api/applications */
export async function getApplications() {
  const { data } = await client.get("/applications");
  return data;
}

/** POST /api/applications  body: application */
export async function createApplication(app) {
  const { data } = await client.post("/applications", app);
  return data;
}

/** PUT /api/applications/:acronym  body: partial/full application */
export async function updateApplication(acronym, app) {
  const { data } = await client.put(`/applications/${encodeURIComponent(acronym)}`, app);
  return data;
}

/** (Optional) DELETE /api/applications/:acronym */
export async function deleteApplication(acronym) {
  const { data } = await client.delete(`/applications/${encodeURIComponent(acronym)}`);
  return data;
}
