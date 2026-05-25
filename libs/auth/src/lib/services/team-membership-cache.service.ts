import { Injectable } from '@nestjs/common';

/**
 * Team feature has been removed from this codebase. This service is kept as a
 * stub so that scope-resolution code paths referencing it continue to type-check.
 * It always reports the user as a member of no teams.
 */
@Injectable()
export class TeamMembershipCacheService {
  async getTeamIds(_userId: number): Promise<number[]> {
    return [];
  }

  async invalidate(_userId: number): Promise<void> {
    // no-op
  }

  async invalidateMany(_userIds: number[]): Promise<void> {
    // no-op
  }
}
