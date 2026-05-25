/**
 * Entity types that support undo (soft-delete + restore via token).
 *
 * Each value maps to a distinct Prisma model. The undo dispatcher routes
 * token redemption to the correct restore handler based on this type.
 *
 * Agency request notes reuse the `CaseNote` model (via `agencyRequestId` FK),
 * so they use `CaseNote` — no separate value needed.
 *
 * New entries should be added here as more entities gain soft-delete support.
 */
export enum UndoEntityType {
  CaseComment = 'CASE_COMMENT',
  AgencyRequestComment = 'AGENCY_REQUEST_COMMENT',
  TaskComment = 'TASK_COMMENT',
  ReminderComment = 'REMINDER_COMMENT',
  Task = 'TASK',
  Reminder = 'REMINDER',
  CaseNote = 'CASE_NOTE',
  AgencyNote = 'AGENCY_NOTE',
  File = 'FILE',
  Tag = 'TAG',
}
