import { DatabaseService, PermissionScope, Prisma } from '@mediastar/database';
import { Injectable } from '@nestjs/common';

const ROLE_SUMMARY_SELECT = {
  id: true,
  name: true,
  description: true,
  isBuiltIn: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.RoleSelect;

export type RoleSummary = Prisma.RoleGetPayload<{ select: typeof ROLE_SUMMARY_SELECT }>;

const ROLE_DETAIL_SELECT = {
  id: true,
  name: true,
  description: true,
  isBuiltIn: true,
  rolePermissions: {
    select: {
      id: true,
      scope: true,
      permission: {
        select: { id: true, module: true, action: true, description: true },
      },
    },
    orderBy: { permission: { module: 'asc' as const } },
  },
} satisfies Prisma.RoleSelect;

export type RoleDetail = Prisma.RoleGetPayload<{ select: typeof ROLE_DETAIL_SELECT }>;

interface RoleQueryParams {
  skip: number;
  take: number;
  where: Prisma.RoleWhereInput;
  orderBy: Prisma.RoleOrderByWithRelationInput;
}

interface CreateRoleParams {
  name: string;
  description?: string;
  permissions: Array<{ permissionId: number; scope: PermissionScope }>;
}

@Injectable()
export class RolesRepository {
  constructor(private readonly db: DatabaseService) {}

  async findMany(params: RoleQueryParams): Promise<[RoleSummary[], number]> {
    const { skip, take, where, orderBy } = params;

    const [data, total] = await Promise.all([
      this.db.role.findMany({ where, skip, take, orderBy, select: ROLE_SUMMARY_SELECT }),
      this.db.role.count({ where }),
    ]);

    return [data, total];
  }

  async findByIdWithPermissions(id: number): Promise<RoleDetail | null> {
    // Cast: Prisma's PermissionScope (string literal union) → core's PermissionScope (enum).
    // Values are identical — the sync test in permission-scope-sync.spec.ts guarantees this.
    return this.db.role.findUnique({
      where: { id },
      select: ROLE_DETAIL_SELECT,
    }) as Promise<RoleDetail | null>;
  }

  async findById(id: number): Promise<{ id: number; name: string; isBuiltIn: boolean } | null> {
    return this.db.role.findUnique({
      where: { id },
      select: { id: true, name: true, isBuiltIn: true },
    });
  }

  async findByIds(ids: number[]): Promise<Array<{ id: number; name: string }>> {
    return this.db.role.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true },
    });
  }

  async findByName(name: string): Promise<{ id: number; name: string } | null> {
    return this.db.role.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
      select: { id: true, name: true },
    });
  }

  async findByIdWithUserCount(id: number): Promise<{
    id: number;
    name: string;
    isBuiltIn: boolean;
    _count: { userRoles: number };
  } | null> {
    return this.db.role.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        isBuiltIn: true,
        _count: { select: { userRoles: true } },
      },
    });
  }

  async create(params: CreateRoleParams): Promise<{ id: number; name: string }> {
    return this.db.role.create({
      data: {
        name: params.name,
        description: params.description,
        isBuiltIn: false,
        rolePermissions: {
          create: params.permissions.map((p) => ({
            permissionId: p.permissionId,
            scope: p.scope,
          })),
        },
      },
      select: { id: true, name: true },
    });
  }

  async updateWithPermissions(
    id: number,
    data: { name?: string; description?: string },
    permissions?: Array<{ permissionId: number; scope: PermissionScope }>,
  ): Promise<{ id: number; name: string }> {
    return this.db.$transaction(async (tx) => {
      const result = await tx.role.update({
        where: { id },
        data: {
          ...(data.name != null && { name: data.name }),
          ...(data.description !== undefined && { description: data.description }),
        },
        select: { id: true, name: true },
      });

      if (permissions) {
        await tx.rolePermission.deleteMany({ where: { roleId: id } });
        await tx.rolePermission.createMany({
          data: permissions.map((p) => ({
            roleId: id,
            permissionId: p.permissionId,
            scope: p.scope,
          })),
        });
      }

      return result;
    });
  }

  async softDelete(id: number, deletedBy: number): Promise<void> {
    await this.db.role.delete({ where: { id }, deletedBy });
  }
}
