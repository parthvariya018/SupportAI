const AppError = require('../utils/AppError');

/**
 * Role → permission matrix.
 * Each role inherits all permissions of roles below it.
 */
const ROLE_PERMISSIONS = {
  viewer: [
    'tickets:read',
    'conversations:read',
    'kb:read',
    'analytics:read',
    'leads:read',
    'team:read',
  ],
  agent: [
    'tickets:read', 'tickets:write',
    'conversations:read', 'conversations:write',
    'kb:read',
    'analytics:read',
    'leads:read',
    'team:read',
  ],
  admin: [
    'tickets:read', 'tickets:write', 'tickets:delete',
    'conversations:read', 'conversations:write', 'conversations:delete',
    'kb:read', 'kb:write', 'kb:delete',
    'analytics:read',
    'leads:read', 'leads:write',
    'team:read', 'team:write',
    'settings:read', 'settings:write',
    'billing:read',
  ],
  owner: [
    'tickets:read', 'tickets:write', 'tickets:delete',
    'conversations:read', 'conversations:write', 'conversations:delete',
    'kb:read', 'kb:write', 'kb:delete',
    'analytics:read',
    'leads:read', 'leads:write',
    'team:read', 'team:write', 'team:delete',
    'settings:read', 'settings:write',
    'billing:read', 'billing:write',
    'apikey:rotate',
  ],
};

/**
 * hasPermission(role, permission) → boolean
 */
const hasPermission = (role, permission) => {
  const perms = ROLE_PERMISSIONS[role] || [];
  return perms.includes(permission);
};

/**
 * requirePermission('tickets:write') middleware
 * Requires protect to run first (req.user must exist).
 */
const requirePermission = (permission) => (req, res, next) => {
  if (!hasPermission(req.user.role, permission)) {
    return next(new AppError(`Missing permission: ${permission}`, 403));
  }
  next();
};

/**
 * requireAnyPermission('tickets:write', 'kb:write')
 * Allows if the user has at least one of the listed permissions.
 */
const requireAnyPermission = (...permissions) => (req, res, next) => {
  const allowed = permissions.some(p => hasPermission(req.user.role, p));
  if (!allowed) {
    return next(new AppError('You do not have the required permissions.', 403));
  }
  next();
};

module.exports = { hasPermission, requirePermission, requireAnyPermission, ROLE_PERMISSIONS };
