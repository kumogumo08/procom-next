export function isAdmin(uid?: string) {
  const list = (process.env.ADMIN_UIDS || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
  return !!uid && list.includes(uid);
}
