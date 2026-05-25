import { PERMISSIONS_KEY } from '@mediastar/core';
import { SetMetadata } from '@nestjs/common';

/**
 * Decorator to set required permissions on a route handler.
 * Format: "module:action:scope" (scope defaults to "all" if omitted).
 *
 * @example @Permissions('cases:read:all', 'cases:read:own')
 */
export const Permissions = (...permissions: string[]) => SetMetadata(PERMISSIONS_KEY, permissions);
