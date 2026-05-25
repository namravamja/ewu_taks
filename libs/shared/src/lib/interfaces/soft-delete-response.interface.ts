import type { UndoEntityType } from '@mediastar/core';

export interface ISoftDeleteResponse {
  success: true;
  deletedEntity: {
    type: UndoEntityType;
    ids: number[];
    displayLabel: string;
  };
  undo: {
    token: string;
    expiresAt: string;
  };
}
