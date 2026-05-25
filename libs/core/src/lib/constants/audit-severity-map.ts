import { AuditAction } from '../enums/audit-action.enum';
import { AuditSeverity } from '../enums/audit-severity.enum';

export const AUDIT_SEVERITY_MAP = new Map<AuditAction, AuditSeverity>([
  // Info
  [AuditAction.Login, AuditSeverity.Info],
  [AuditAction.Logout, AuditSeverity.Info],
  [AuditAction.Export, AuditSeverity.Info],
  [AuditAction.Create, AuditSeverity.Info],
  [AuditAction.ResendInvite, AuditSeverity.Info],
  [AuditAction.TwoFactorSetup, AuditSeverity.Info],

  // Warning
  [AuditAction.EmailMarkedNotSpam, AuditSeverity.Warning],
  [AuditAction.EmailArchived, AuditSeverity.Warning],
  [AuditAction.EmailUnarchived, AuditSeverity.Warning],
  [AuditAction.EmailTrashed, AuditSeverity.Warning],
  [AuditAction.EmailRestored, AuditSeverity.Warning],
  [AuditAction.EmailLinkedToCase, AuditSeverity.Warning],
  [AuditAction.EmailLinkedToAgencyRequest, AuditSeverity.Warning],
  [AuditAction.EmailUnlinkedFromAgencyRequest, AuditSeverity.Warning],
  [AuditAction.EmailMarkedIrrelevant, AuditSeverity.Warning],
  [AuditAction.EmailUnmarkedIrrelevant, AuditSeverity.Info],
  [AuditAction.Update, AuditSeverity.Warning],
  [AuditAction.ChangeEmail, AuditSeverity.Warning],
  [AuditAction.SetPassword, AuditSeverity.Warning],
  [AuditAction.Approve, AuditSeverity.Warning],
  [AuditAction.Reject, AuditSeverity.Warning],
  [AuditAction.Activate, AuditSeverity.Warning],
  [AuditAction.Deactivate, AuditSeverity.Warning],
  [AuditAction.TwoFactorEnable, AuditSeverity.Warning],
  [AuditAction.TwoFactorDisable, AuditSeverity.Warning],
  [AuditAction.TwoFactorBackupRegenerate, AuditSeverity.Warning],
  [AuditAction.TwoFactorEnforcementChange, AuditSeverity.Warning],

  // Critical
  [AuditAction.Delete, AuditSeverity.Critical],
  [AuditAction.TwoFactorAdminDisable, AuditSeverity.Critical],
  [AuditAction.TwoFactorBackupUsed, AuditSeverity.Critical],
  [AuditAction.BulkAction, AuditSeverity.Critical],
  [AuditAction.AgencyDeleted, AuditSeverity.Critical],
]);
