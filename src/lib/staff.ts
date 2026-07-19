/** Роли персонала Xelity и матрица прав */

export type StaffRole = 'helper' | 'moderator' | 'admin' | 'owner';

export type StaffPermission =
  | 'tickets'
  | 'tickets.investigate'
  | 'dashboard'
  | 'users.view'
  | 'users.moderate'
  | 'users.plan'
  | 'users.roles'
  | 'users.roles.owner'
  | 'api.manage'
  | 'chats.view'
  | 'chats.god'
  | 'payments'
  | 'broadcasts'
  | 'prompts'
  | 'maintenance'
  | 'credits.bypass';

export type StaffBrand = {
  /** Короткий ярлык в шапке: HELPER / MODERATOR / ADMIN / OWNER */
  code: string;
  /** Полная строка: XELITY HELPER */
  title: string;
  /** CSS-модификатор темы панели */
  theme: 'helper' | 'moderator' | 'admin' | 'owner';
  accent: string;
  accentSoft: string;
  hint: string;
};

const ROLE_RANK: Record<StaffRole, number> = {
  helper: 1,
  moderator: 2,
  admin: 3,
  owner: 4,
};

const PERMS: Record<StaffRole, StaffPermission[]> = {
  helper: ['tickets'],
  moderator: [
    'tickets',
    'tickets.investigate',
    'dashboard',
    'users.view',
    'users.moderate',
    'chats.view',
    'broadcasts',
  ],
  admin: [
    'tickets',
    'tickets.investigate',
    'dashboard',
    'users.view',
    'users.moderate',
    'users.plan',
    'api.manage',
    'chats.view',
    'chats.god',
    'payments',
    'broadcasts',
    'prompts',
    'maintenance',
    'credits.bypass',
  ],
  owner: [
    'tickets',
    'tickets.investigate',
    'dashboard',
    'users.view',
    'users.moderate',
    'users.plan',
    'users.roles',
    'users.roles.owner',
    'api.manage',
    'chats.view',
    'chats.god',
    'payments',
    'broadcasts',
    'prompts',
    'maintenance',
    'credits.bypass',
  ],
};

export const STAFF_BRAND: Record<StaffRole, StaffBrand> = {
  helper: {
    code: 'HELPER',
    title: 'XELITY HELPER',
    theme: 'helper',
    accent: '#2a9d8f',
    accentSoft: 'rgba(42, 157, 143, 0.18)',
    hint: 'Только тикеты поддержки',
  },
  moderator: {
    code: 'MODERATOR',
    title: 'XELITY MODERATOR',
    theme: 'moderator',
    accent: '#e09f3e',
    accentSoft: 'rgba(224, 159, 62, 0.18)',
    hint: 'Тикеты, модерация и чаты',
  },
  admin: {
    code: 'ADMIN',
    title: 'XELITY ADMIN',
    theme: 'admin',
    accent: '#c62828',
    accentSoft: 'rgba(198, 40, 40, 0.2)',
    hint: 'Полная панель; роли назначает только Owner',
  },
  owner: {
    code: 'OWNER',
    title: 'XELITY OWNER',
    theme: 'owner',
    accent: '#d4a017',
    accentSoft: 'rgba(212, 160, 23, 0.2)',
    hint: 'Полный доступ и единственный, кто меняет роли',
  },
};

export const STAFF_ROLE_ORDER: StaffRole[] = ['helper', 'moderator', 'admin', 'owner'];

export const STAFF_ROLE_LABEL: Record<StaffRole, string> = {
  helper: 'Helper',
  moderator: 'Moderator',
  admin: 'Admin',
  owner: 'Owner',
};

export function isStaffRole(value: unknown): value is StaffRole {
  return (
    value === 'helper' ||
    value === 'moderator' ||
    value === 'admin' ||
    value === 'owner'
  );
}

/** Роль из профиля + миграция legacy isAdmin/admin → admin */
export function resolveStaffRole(profile: {
  staffRole?: string | null;
  isAdmin?: boolean;
  admin?: boolean;
} | null | undefined): StaffRole | null {
  if (!profile) return null;
  if (isStaffRole(profile.staffRole)) return profile.staffRole;
  if (profile.isAdmin === true || profile.admin === true) return 'admin';
  return null;
}

export function isStaff(profile: Parameters<typeof resolveStaffRole>[0]): boolean {
  return resolveStaffRole(profile) != null;
}

/** Совместимость: «админ» в старом смысле = любой staff */
export function profileIsStaffAdmin(profile: Parameters<typeof resolveStaffRole>[0]): boolean {
  return isStaff(profile);
}

export function roleRank(role: StaffRole | null | undefined): number {
  if (!role) return 0;
  return ROLE_RANK[role] ?? 0;
}

export function hasPermission(
  role: StaffRole | null | undefined,
  perm: StaffPermission,
): boolean {
  if (!role) return false;
  return PERMS[role]?.includes(perm) ?? false;
}

export function canAssignRole(
  actor: StaffRole | null | undefined,
  target: StaffRole | null,
): boolean {
  // роли меняет только Owner
  if (actor !== 'owner') return false;
  if (!hasPermission(actor, 'users.roles')) return false;
  if (target === 'owner') return hasPermission(actor, 'users.roles.owner');
  if (target === null) return true;
  return roleRank(actor) >= roleRank(target);
}

export function staffBrand(role: StaffRole | null | undefined): StaffBrand {
  if (role && STAFF_BRAND[role]) return STAFF_BRAND[role];
  return STAFF_BRAND.admin;
}

export type AdminNavItem = {
  to: string;
  end?: boolean;
  label: string;
  perm: StaffPermission;
};

export const ADMIN_NAV: AdminNavItem[] = [
  { to: '/admin', end: true, label: 'Обзор', perm: 'dashboard' },
  { to: '/admin/tickets', label: 'Тикеты', perm: 'tickets' },
  { to: '/admin/users', label: 'Пользователи', perm: 'users.view' },
  { to: '/admin/api', label: 'API', perm: 'api.manage' },
  { to: '/admin/chats', label: 'Чаты', perm: 'chats.view' },
  { to: '/admin/payments', label: 'Платежи', perm: 'payments' },
  { to: '/admin/broadcasts', label: 'Broadcasts', perm: 'broadcasts' },
  { to: '/admin/prompts', label: 'Промпты', perm: 'prompts' },
  { to: '/admin/maintenance', label: 'Техработы', perm: 'maintenance' },
];

export function navForRole(role: StaffRole | null): AdminNavItem[] {
  return ADMIN_NAV.filter((item) => hasPermission(role, item.perm));
}

export function defaultAdminPath(role: StaffRole | null): string {
  const nav = navForRole(role);
  return nav[0]?.to ?? '/admin/tickets';
}

export function pathAllowed(pathname: string, role: StaffRole | null): boolean {
  if (!role) return false;
  if (pathname.startsWith('/admin/users/')) {
    return hasPermission(role, 'users.view');
  }
  if (pathname.startsWith('/admin/api')) {
    return hasPermission(role, 'api.manage');
  }
  const exact = ADMIN_NAV.find((n) => n.to === pathname);
  if (exact) return hasPermission(role, exact.perm);
  if (pathname === '/admin' || pathname === '/admin/') {
    return hasPermission(role, 'dashboard') || hasPermission(role, 'tickets');
  }
  return pathname.startsWith('/admin') && isStaffRole(role);
}

export function messageRoleLabel(
  role: string | undefined,
  staffRole?: string | null,
): string {
  if (role === 'user') return 'пользователь';
  if (isStaffRole(staffRole)) {
    return STAFF_ROLE_LABEL[staffRole];
  }
  if (role === 'admin' || role === 'staff') return 'поддержка';
  return role || '—';
}
