export const TRASH_BULK_ACTIONS = ['restore', 'hard_delete'] as const;
export type TrashBulkAction = (typeof TRASH_BULK_ACTIONS)[number];

export interface IBulkTrashAction {
  readonly action: TrashBulkAction;
  readonly ids: readonly number[];
}

export interface IBulkTrashActionError {
  readonly id: number;
  readonly reason: string;
}

export interface IBulkTrashActionResult {
  readonly succeeded: readonly number[];
  readonly failed: readonly IBulkTrashActionError[];
}
