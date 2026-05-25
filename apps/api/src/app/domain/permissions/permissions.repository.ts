import { DatabaseService, Prisma } from '@mediastar/database';
import { Injectable } from '@nestjs/common';

interface PermissionQueryParams {
  skip: number;
  take: number;
  where: Prisma.PermissionWhereInput;
  orderBy: Prisma.PermissionOrderByWithRelationInput;
}

const PERMISSION_SELECT = {
  id: true,
  module: true,
  action: true,
  description: true,
} satisfies Prisma.PermissionSelect;

type PermissionDetail = Prisma.PermissionGetPayload<{ select: typeof PERMISSION_SELECT }>;

@Injectable()
export class PermissionsRepository {
  constructor(private readonly db: DatabaseService) {}

  async findById(id: number): Promise<PermissionDetail | null> {
    return this.db.permission.findUnique({ where: { id }, select: PERMISSION_SELECT });
  }

  async findByIds(ids: number[]): Promise<Array<{ id: number }>> {
    return this.db.permission.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
  }

  async findMany(params: PermissionQueryParams): Promise<[PermissionDetail[], number]> {
    const { skip, take, where, orderBy } = params;

    const [data, total] = await Promise.all([
      this.db.permission.findMany({ where, skip, take, orderBy, select: PERMISSION_SELECT }),
      this.db.permission.count({ where }),
    ]);

    return [data, total];
  }
}
