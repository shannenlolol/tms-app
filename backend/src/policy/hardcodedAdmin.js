// policy/adminPolicy.js
export const ADMIN_GROUP_NAME = "Admin";

/** True when this username is the hardcoded admin account. */
export function hardcodedAdmin(username) {
  return String(username || "").trim().toLowerCase() === "admin";
}

/**
 * Enforce hardcode admin policy for any update that touches its groups/active/username.
 * - The hardcoded admin ("admin") must keep the "Admin" group.
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
      message: 'The "admin" account cannot be disabled.',
    };
  }

  // 2) Must keep the Admin group if groups are provided in this request
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
        message: 'The "admin" account must keep the Admin group.',
      };    }
  }

  // 3) Optional: forbid renaming "admin"
  if (Object.prototype.hasOwnProperty.call(body, "username")) {
    const desired = String(body.username || "").trim().toLowerCase();
    if (desired !== "admin") {
      return {
        ok: false,
        status: 409,
        code: "ADMIN_CANNOT_RENAME",
        message: 'Renaming the hardcoded "admin" account is not allowed.',
      };    }
  }

  return { ok: true };
}
