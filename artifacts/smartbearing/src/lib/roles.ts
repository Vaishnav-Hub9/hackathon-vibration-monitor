export type AppRole = 'maintenance_engineer' | 'admin' | 'factory_manager' | 'worker' | 'operator' | 'customer';

export interface CurrentUser {
  id?: string;
  name?: string;
  email?: string;
  role?: AppRole | string;
  factoryUnits?: string[];
  customerName?: string;
}

export interface RoleDefinition {
  label: string;
  shortLabel: string;
  description: string;
  access: string;
  accent: string;
}

export const ROLE_DEFINITIONS: Record<AppRole, RoleDefinition> = {
  maintenance_engineer: {
    label: 'Maintenance Engineer',
    shortLabel: 'Maintenance',
    description: 'Owns diagnosis, intervention, and verification across the plant.',
    access: 'Full operational access',
    accent: '#F59E0B',
  },
  admin: {
    label: 'Platform Admin',
    shortLabel: 'Admin',
    description: 'Governs users, factories, integrations, and platform controls.',
    access: 'Platform administration',
    accent: '#A78BFA',
  },
  factory_manager: {
    label: 'Factory Manager',
    shortLabel: 'Factory manager',
    description: 'Sees the factory-wide production picture and removes constraints.',
    access: 'Factory-wide visibility',
    accent: '#38BDF8',
  },
  worker: {
    label: 'Line Worker',
    shortLabel: 'Worker',
    description: 'Sees assigned problems, safe actions, and shift priorities.',
    access: 'Assigned work orders',
    accent: '#10B981',
  },
  operator: {
    label: 'Line Operator',
    shortLabel: 'Operator',
    description: 'Legacy operator access mapped to the worker workflow.',
    access: 'Assigned work orders',
    accent: '#10B981',
  },
  customer: {
    label: 'Brand Customer',
    shortLabel: 'Customer',
    description: 'Tracks factory performance, delivery confidence, and business impact.',
    access: 'Read-only partner view',
    accent: '#C084FC',
  },
};

export function normalizeRole(role: unknown): AppRole {
  if (role === 'maintenance_engineer' || role === 'admin' || role === 'factory_manager' || role === 'worker' || role === 'customer') {
    return role;
  }
  return 'operator';
}

export function getCurrentUser(): CurrentUser {
  try {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) as CurrentUser : {};
  } catch {
    return {};
  }
}

export function getCurrentRole(): AppRole {
  return normalizeRole(getCurrentUser().role);
}

export function canAccess(role: AppRole, capability: 'maintenance' | 'factory' | 'worker' | 'customer' | 'admin'): boolean {
  if (role === 'maintenance_engineer') return true;
  if (capability === 'admin') return role === 'admin';
  if (capability === 'maintenance') return role === 'admin' || role === 'factory_manager';
  if (capability === 'factory') return role === 'admin' || role === 'factory_manager' || role === 'customer';
  if (capability === 'customer') return role === 'customer';
  return role === 'admin' || role === 'factory_manager' || role === 'worker' || role === 'operator';
}
