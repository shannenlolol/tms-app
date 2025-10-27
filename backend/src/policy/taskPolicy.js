// backend/src/policy/taskPolicy.js
import pool from "../models/db.js";

// async function checkUserInGroup(username, groupName) {
//     const [rows] = await pool.query(
//         "SELECT 1 FROM user_group_membership WHERE username = ? AND LOWER(group_name) = LOWER(?) LIMIT 1",
//         [username, String(groupName || "").toLowerCase()]
//     );
//     return rows.length > 0;
// }
const toArray = (v) => String(v ?? "").split(",").map(s => s.trim()).filter(Boolean);

async function checkGroup(username, groupName) {
    const [[row]] = await pool.query(
        "SELECT usergroups FROM accounts WHERE username = ? LIMIT 1",
        [username]
    );

    const member = toArray(row.usergroups).map(g => g.toLowerCase()).includes(groupName);
    return member; // strictly boolean

}
export async function canUserCreateTaskForApp(username, appAcronym) {
    const u = String(username || "").trim();
    const acr = String(appAcronym || "").trim();
    if (!u || !acr) return false;

    const [apps] = await pool.query(
        "SELECT App_permit_Create FROM application WHERE App_Acronym = ? LIMIT 1",
        [acr]
    );
    if (apps.length === 0) return false;

    const groups = String(apps[0].App_permit_Create ?? "")
        .split(",").map(s => s.trim()).filter(Boolean);
    if (groups.length === 0) return false;

    const checks = await Promise.all(groups.map(g => checkGroup(u, g)));
    return checks.some(Boolean);
}
