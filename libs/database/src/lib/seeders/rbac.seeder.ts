import { Injectable, Logger } from '@nestjs/common';

import { DatabaseService } from '../database.service';
import { PERMISSION_SEED } from './seed-data/permissions.seed';
import { BUILT_IN_ROLES } from './seed-data/roles.seed';

@Injectable()
export class RbacSeeder {
  private readonly logger = new Logger(RbacSeeder.name);

  constructor(private readonly db: DatabaseService) {}

  async seed(): Promise<void> {
    await this.db.$transaction(async (tx) => {
      // 1. Upsert all permissions
      const permissionResults = await Promise.all(
        PERMISSION_SEED.map((p) =>
          tx.permission.upsert({
            where: {
              module_action: { module: p.module, action: p.action },
            },
            update: { description: p.description },
            create: {
              module: p.module,
              action: p.action,
              description: p.description,
            },
          }),
        ),
      );

      this.logger.log(`Upserted ${permissionResults.length} permissions`);

      // Build lookup: "module:action" → permission.id
      const permissionMap = new Map(
        permissionResults.map((p) => [`${p.module}:${p.action}`, p.id]),
      );

      // 2. Upsert built-in roles and sync their permissions
      for (const roleSeed of BUILT_IN_ROLES) {
        const role = await tx.role.upsert({
          where: { name: roleSeed.name },
          update: { description: roleSeed.description, level: roleSeed.level, isBuiltIn: true },
          create: {
            name: roleSeed.name,
            description: roleSeed.description,
            level: roleSeed.level,
            isBuiltIn: true,
          },
        });

        // Delete existing role-permission mappings for this built-in role
        await tx.rolePermission.deleteMany({ where: { roleId: role.id } });

        // Handle wildcard owner: create a special "*:*" permission
        const rolePermissionData = await Promise.all(
          roleSeed.permissions.map(async (rp) => {
            let permissionId = permissionMap.get(`${rp.module}:${rp.action}`);

            if (!permissionId) {
              if (rp.module !== '*' || rp.action !== '*') {
                throw new Error(
                  `Role "${roleSeed.name}" references unknown permission "${rp.module}:${rp.action}" — add it to PERMISSION_SEED or remove it from the role.`,
                );
              }
              // Wildcard permission ("*:*") — upsert it
              const wildcardPerm = await tx.permission.upsert({
                where: {
                  module_action: { module: rp.module, action: rp.action },
                },
                update: {},
                create: {
                  module: rp.module,
                  action: rp.action,
                  description: 'Wildcard permission',
                },
              });
              permissionId = wildcardPerm.id;
              permissionMap.set(`${rp.module}:${rp.action}`, permissionId);
            }

            return {
              roleId: role.id,
              permissionId,
              scope: rp.scope,
            };
          }),
        );

        await tx.rolePermission.createMany({ data: rolePermissionData });

        this.logger.log(
          `Seeded role "${roleSeed.name}" with ${rolePermissionData.length} permissions`,
        );
      }
    });
  }
}
