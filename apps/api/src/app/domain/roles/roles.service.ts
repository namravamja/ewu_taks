import { RbacService } from '@mediastar/auth';
import { PermissionScope } from '@mediastar/database';
import { buildListQuery, buildPaginatedResult, OffsetPaginatedResultVM } from '@mediastar/shared';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PermissionsService } from '../permissions/permissions.service';
import {
  CreateRoleDTO,
  ROLE_SEARCHABLE_FIELDS,
  ROLE_SORTABLE_FIELDS,
  RoleDetailVM,
  RoleMutationResultVM,
  RolesQueryDTO,
  RoleSummaryVM,
  UpdateRoleDTO,
} from './dtos';
import { RolesRepository } from './roles.repository';

const ROLE_NOT_FOUND = 'Role not found';

@Injectable()
export class RolesService {
  constructor(
    private readonly rolesRepository: RolesRepository,
    private readonly rbacService: RbacService,
    private readonly permissionsService: PermissionsService,
  ) {}

  async findAll(query: RolesQueryDTO): Promise<OffsetPaginatedResultVM<RoleSummaryVM>> {
    const { skip, take, orderBy, searchWhere } = buildListQuery(
      query,
      ROLE_SEARCHABLE_FIELDS,
      ROLE_SORTABLE_FIELDS,
      'name',
    );

    const where = {
      ...searchWhere,
      ...(query.isBuiltIn != null && { isBuiltIn: query.isBuiltIn }),
    };

    const [data, total] = await this.rolesRepository.findMany({ skip, take, where, orderBy });

    return buildPaginatedResult(data, total, query);
  }

  async findNameById(id: number): Promise<{ id: number; name: string } | null> {
    const role = await this.rolesRepository.findById(id);
    if (!role) return null;
    return { id: role.id, name: role.name };
  }

  async findNamesByIds(ids: number[]): Promise<Array<{ id: number; name: string }>> {
    return this.rolesRepository.findByIds(ids);
  }

  async findById(id: number): Promise<RoleDetailVM> {
    const role = await this.rolesRepository.findByIdWithPermissions(id);
    if (!role) {
      throw new NotFoundException(ROLE_NOT_FOUND);
    }

    // Cast: Prisma's PermissionScope (string literal union) → core's PermissionScope (enum).
    // Values are identical — the sync test in permission-scope-sync.spec.ts guarantees this.
    return role as RoleDetailVM;
  }

  async create(dto: CreateRoleDTO): Promise<RoleMutationResultVM> {
    const existing = await this.rolesRepository.findByName(dto.name);
    if (existing) {
      throw new ConflictException(`Role "${dto.name}" already exists`);
    }

    const permissionRecords = await this.validatePermissionIds(dto.permissions);

    return this.rolesRepository.create({
      name: dto.name,
      description: dto.description,
      permissions: permissionRecords,
    });
  }

  async update(id: number, dto: UpdateRoleDTO): Promise<RoleMutationResultVM> {
    const role = await this.rolesRepository.findById(id);
    if (!role) {
      throw new NotFoundException(ROLE_NOT_FOUND);
    }
    if (role.isBuiltIn) {
      throw new BadRequestException('Cannot modify a built-in role');
    }

    if (dto.name != null) {
      const existing = await this.rolesRepository.findByName(dto.name);
      if (existing && existing.id !== id) {
        throw new ConflictException(`Role "${dto.name}" already exists`);
      }
    }

    const permissionRecords = dto.permissions
      ? await this.validatePermissionIds(dto.permissions)
      : undefined;

    const updated = await this.rolesRepository.updateWithPermissions(
      id,
      { name: dto.name, description: dto.description },
      permissionRecords,
    );

    await this.rbacService.invalidateRole(id);

    return updated;
  }

  async remove(id: number, deletedBy: number): Promise<RoleMutationResultVM> {
    const role = await this.rolesRepository.findByIdWithUserCount(id);
    if (!role) {
      throw new NotFoundException(ROLE_NOT_FOUND);
    }
    if (role.isBuiltIn) {
      throw new BadRequestException('Cannot delete a built-in role');
    }
    if (role._count.userRoles > 0) {
      throw new BadRequestException(
        `Cannot delete role "${role.name}" — ${role._count.userRoles} user(s) still assigned`,
      );
    }

    await this.rolesRepository.softDelete(id, deletedBy);
    await this.rbacService.invalidateRole(id);

    return { id: role.id, name: role.name };
  }

  private async validatePermissionIds(
    permissions: Array<{ permissionId: number; scope?: PermissionScope }>,
  ): Promise<Array<{ permissionId: number; scope: PermissionScope }>> {
    const ids = permissions.map((p) => p.permissionId);
    const uniqueIds = [...new Set(ids)];

    const found = await this.permissionsService.findByIds(uniqueIds);

    const foundIds = new Set(found.map((p) => p.id));
    const missing = uniqueIds.filter((id) => !foundIds.has(id));

    if (missing.length > 0) {
      throw new BadRequestException(`Permission(s) not found: ${missing.join(', ')}`);
    }

    return permissions.map((p) => ({
      permissionId: p.permissionId,
      scope: p.scope ?? PermissionScope.ALL,
    }));
  }
}
