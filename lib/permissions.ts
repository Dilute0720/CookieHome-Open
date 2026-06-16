export function isAdminRole(role: string | null | undefined) {
  return role === "ADMIN";
}

export function canManageDishes(role: string | null | undefined) {
  return isAdminRole(role);
}

export function canManageInventory(role: string | null | undefined) {
  return isAdminRole(role);
}

export function canManageTodoMenuStatus(role: string | null | undefined) {
  return role === "ADMIN" || role === "FAMILY";
}

export function canManageUsers(role: string | null | undefined) {
  return isAdminRole(role);
}
