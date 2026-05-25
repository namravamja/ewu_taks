import { REQUIRES_ROLE_KEY } from '@mediastar/core';
import { SetMetadata } from '@nestjs/common';

/**
 * Marks an endpoint as requiring the acting user to hold a specific role by name.
 * Must be used together with `@UseGuards(RequiresRoleGuard)`.
 *
 * @param roleName - The role name the user must have (e.g. `BuiltInRole.Owner`)
 */
export const RequiresRole = (roleName: string) => SetMetadata(REQUIRES_ROLE_KEY, roleName);
