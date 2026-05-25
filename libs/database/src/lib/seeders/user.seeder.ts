import { BuiltInRole, SALT_ROUNDS, SYSTEM_BOT_EMAIL } from '@mediastar/core';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';

import { DatabaseService } from '../database.service';
import { HardDeleteService } from '../hard-delete.service';

// eslint-disable-next-line sonarjs/no-hardcoded-passwords
const DEV_DEFAULT_PASSWORD = 'Owner@12345';

@Injectable()
export class UserSeeder {
  private readonly logger = new Logger(UserSeeder.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly hardDeleteService: HardDeleteService,
    private readonly config: ConfigService,
  ) {}

  async seed(): Promise<void> {
    const emails = this.config.get<string[]>('app.seedOwnerEmails') ?? [];
    const isProduction = this.config.get<string>('app.nodeEnv') === 'production';

    if (emails.length === 0) {
      this.logger.log('SEED_OWNER_EMAILS is empty, skipping bootstrap Owner seeding');
    } else {
      const passwordHash = isProduction
        ? null
        : await bcrypt.hash(DEV_DEFAULT_PASSWORD, SALT_ROUNDS);

      await this.db.$transaction(async (tx) => {
        const ownerRole = await tx.role.findUniqueOrThrow({ where: { name: BuiltInRole.Owner } });

        for (const email of emails) {
          const existing = await tx.user.findUnique({
            where: { email },
            select: { id: true, passwordHash: true },
          });

          if (existing) {
            // In non-prod, backfill the dev password on owners that were seeded before the
            // password seeding was wired up (e.g. legacy SSO-only seed rows).
            if (!isProduction && passwordHash && existing.passwordHash === null) {
              await tx.user.update({ where: { id: existing.id }, data: { passwordHash } });
              this.logger.log(`Backfilled dev password on existing Owner "${email}"`);
            } else {
              this.logger.log(`Owner "${email}" already exists; skipping`);
            }
            continue;
          }

          const localPart = email.split('@')[0] ?? email;
          const created = await tx.user.create({
            data: {
              email,
              firstName: localPart,
              lastName: '',
              passwordHash,
              status: 'ACTIVE',
            },
          });

          await tx.userRole.create({
            data: { userId: created.id, roleId: ownerRole.id },
          });

          this.logger.log(
            isProduction
              ? `Seeded bootstrap Owner "${email}" (no password — set via invitation/reset)`
              : `Seeded bootstrap Owner "${email}" with dev default password`,
          );
        }
      });
    }

    // Seed system bot user via HardDeleteService to bypass soft-delete extension.
    // If the bot was ever soft-deleted, the regular upsert (which injects isDeleted: false)
    // would miss it and crash on the unique constraint.
    await this.hardDeleteService.user.upsert({
      where: { email: SYSTEM_BOT_EMAIL },
      update: {
        firstName: 'System',
        lastName: 'Bot',
        status: 'ACTIVE',
        isDeleted: false,
        deletedAt: null,
        deletedBy: null,
      },
      create: {
        firstName: 'System',
        lastName: 'Bot',
        email: SYSTEM_BOT_EMAIL,
        passwordHash: null,
        status: 'ACTIVE',
      },
    });
    this.logger.log(`System bot user "${SYSTEM_BOT_EMAIL}" seeded`);
  }
}
