import { DatabaseService, TxClient } from '@mediastar/database';
import { Injectable } from '@nestjs/common';

export interface UnusedBackupCode {
  id: number;
  hash: string;
}

@Injectable()
export class BackupCodeRepository {
  constructor(private readonly db: DatabaseService) {}

  async createMany(userId: number, hashes: string[], tx?: TxClient): Promise<void> {
    const client = tx ?? this.db;
    await client.backupCode.createMany({
      data: hashes.map((hash) => ({ userId, hash })),
    });
  }

  async findUnusedByUserId(userId: number, tx?: TxClient): Promise<UnusedBackupCode[]> {
    const client = tx ?? this.db;
    return client.backupCode.findMany({
      where: { userId, usedAt: null },
      select: { id: true, hash: true },
    });
  }

  async countUnusedByUserId(userId: number): Promise<number> {
    return this.db.backupCode.count({
      where: { userId, usedAt: null },
    });
  }

  async markUsed(id: number, tx?: TxClient): Promise<void> {
    const client = tx ?? this.db;
    await client.backupCode.update({
      where: { id },
      data: { usedAt: new Date() },
    });
  }

  async markUsedIfUnused(id: number, tx?: TxClient): Promise<boolean> {
    const client = tx ?? this.db;
    const { count } = await client.backupCode.updateMany({
      where: { id, usedAt: null },
      data: { usedAt: new Date() },
    });
    return count > 0;
  }

  async deleteAllByUserId(userId: number, tx?: TxClient): Promise<void> {
    const client = tx ?? this.db;
    await client.backupCode.deleteMany({ where: { userId } });
  }
}
