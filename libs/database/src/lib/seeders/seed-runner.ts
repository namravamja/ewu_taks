import { SYSTEM_BOT_EMAIL } from '@mediastar/core';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { HardDeleteService } from '../hard-delete.service';
import { RbacSeeder } from './rbac.seeder';
import { PERMISSION_SEED } from './seed-data/permissions.seed';
import { BUILT_IN_ROLES } from './seed-data/roles.seed';
import { computeSeedHash } from './seed-hash.util';
import { UserSeeder } from './user.seeder';

@Injectable()
export class SeedRunner {
  private readonly logger = new Logger(SeedRunner.name);

  constructor(
    private readonly hardDelete: HardDeleteService,
    private readonly rbacSeeder: RbacSeeder,
    private readonly userSeeder: UserSeeder,
    private readonly config: ConfigService,
  ) {}

  async runSeeders(): Promise<void> {
    await this.runIfChanged('rbac', [PERMISSION_SEED, BUILT_IN_ROLES], () =>
      this.rbacSeeder.seed(),
    );

    const ownerEmails = this.config.get<string[]>('app.seedOwnerEmails') ?? [];
    await this.runIfChanged('users', [ownerEmails, SYSTEM_BOT_EMAIL], () => this.userSeeder.seed());
  }

  private async runIfChanged(
    name: string,
    data: readonly unknown[],
    fn: () => Promise<void>,
  ): Promise<void> {
    const hash = computeSeedHash(data);

    const existing = await this.hardDelete.seedRegistry.findUnique({
      where: { name },
    });

    if (existing && existing.hash === hash) {
      this.logger.log(`Seed '${name}' unchanged, skipping`);
      return;
    }

    this.logger.log(`Seed '${name}' changed, running...`);
    await fn();

    await this.hardDelete.seedRegistry.upsert({
      where: { name },
      update: { hash, appliedAt: new Date() },
      create: { name, hash },
    });

    this.logger.log(`Seed '${name}' applied successfully`);
  }
}
