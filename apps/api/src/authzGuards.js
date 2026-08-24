// Pure authorization-decision helpers. Kept dependency-free (no db.js import) so they are testable
// without a live database: callers load the relevant rows first, then ask "would this mutation be
// safe" before writing it.

// True if applying { nextRole, nextIsActive } to the user identified by targetUserId would leave
// the organization with zero active admins. `admins` is every currently active-or-not admin row
// visible to the caller (id, role, isActive) -- typically every user in the org, pre-filtered or
// not; only rows with role "admin" are considered.
export function wouldRemoveLastAdmin(users, targetUserId, { nextRole, nextIsActive } = {}) {
  const remainingActiveAdmins = users.filter((user) => {
    const isTarget = user.id === targetUserId;
    const role = isTarget && nextRole !== undefined && nextRole !== null ? nextRole : user.role;
    const isActive = isTarget && nextIsActive !== undefined && nextIsActive !== null ? nextIsActive : user.isActive;
    return role === "admin" && isActive;
  });
  return remainingActiveAdmins.length === 0;
}

export const authzGuardMessage = Object.freeze({
  lastAdminRequired: "The organization must keep at least one active admin.",
});
