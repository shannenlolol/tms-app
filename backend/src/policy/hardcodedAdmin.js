// policy/adminPolicy.js
export const ADMIN_GROUP_NAME = "admin";

/** True when this username is the hardcoded admin account. */
export function hardcodedAdmin(username) {
  return String(username || "").trim().toLowerCase() === "admin";
}

/**
 * Enforce hardcode admin policy for any update that touches its groups/active/username.
 * - The hardcoded admin ("admin") must keep the "admin" group.
 * - The hardcoded admin cannot be disabled.
 *
 * Returns { ok: true } if allowed, or { ok: false, status, message } if blocked.
 */
export function enforceHardcodedAdmin({ targetUsername, body }) {
  const targetIsAdmin = hardcodedAdmin(targetUsername);

  if (!targetIsAdmin) return { ok: true };

  // 1) Must stay active
  if (Object.prototype.hasOwnProperty.call(body, "active") && body.active === false) {
    return {
      ok: false,
      status: 409, 
      code: "ADMIN_CANNOT_DISABLE",
      message: 'Cannot deactivate the original admin.',
    };
  }

  // 2) Must keep the admin group if groups are provided in this request
  if (Object.prototype.hasOwnProperty.call(body, "usergroup")) {
    const groups = Array.isArray(body.usergroup) ? body.usergroup : [];
    const hasAdminGroup = groups
      .map((g) => String(g || "").toLowerCase())
      .includes(ADMIN_GROUP_NAME.toLowerCase());
    if (!hasAdminGroup) {
      return {
        ok: false,
        status: 409,
        code: "ADMIN_MUST_KEEP_GROUP",
        message: 'Cannot remove admin group from original admin.',
      };    }
  }

  return { ok: true };
}
