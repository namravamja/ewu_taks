import { ModuleName, PermissionAction } from '@mediastar/core';

export const PERMISSION_SEED: ReadonlyArray<{
  module: string;
  action: string;
  description: string;
}> = [
  // Cases
  { module: ModuleName.Cases, action: PermissionAction.Create, description: 'Create new cases' },
  { module: ModuleName.Cases, action: PermissionAction.Read, description: 'View cases' },
  { module: ModuleName.Cases, action: PermissionAction.Update, description: 'Edit cases' },
  { module: ModuleName.Cases, action: PermissionAction.Delete, description: 'Delete cases' },
  { module: ModuleName.Cases, action: PermissionAction.Export, description: 'Export cases' },
  {
    module: ModuleName.Cases,
    action: PermissionAction.Manage,
    description: 'Manage case team assignments',
  },

  // Agencies
  { module: ModuleName.Agencies, action: PermissionAction.Create, description: 'Create agencies' },
  { module: ModuleName.Agencies, action: PermissionAction.Read, description: 'View agencies' },
  { module: ModuleName.Agencies, action: PermissionAction.Update, description: 'Edit agencies' },
  { module: ModuleName.Agencies, action: PermissionAction.Delete, description: 'Delete agencies' },
  { module: ModuleName.Agencies, action: PermissionAction.Export, description: 'Export agencies' },

  // Emails
  { module: ModuleName.Emails, action: PermissionAction.Create, description: 'Send emails' },
  { module: ModuleName.Emails, action: PermissionAction.Read, description: 'View emails' },
  { module: ModuleName.Emails, action: PermissionAction.Update, description: 'Edit emails' },
  { module: ModuleName.Emails, action: PermissionAction.Delete, description: 'Delete emails' },

  // Templates
  {
    module: ModuleName.Templates,
    action: PermissionAction.Admin,
    description: 'Manage agency templates',
  },

  // Reports
  { module: ModuleName.Reports, action: PermissionAction.Read, description: 'View reports' },
  { module: ModuleName.Reports, action: PermissionAction.Export, description: 'Export reports' },

  // Users
  { module: ModuleName.Users, action: PermissionAction.Create, description: 'Create users' },
  { module: ModuleName.Users, action: PermissionAction.Read, description: 'View users' },
  { module: ModuleName.Users, action: PermissionAction.Update, description: 'Edit users' },
  { module: ModuleName.Users, action: PermissionAction.Delete, description: 'Delete users' },
  { module: ModuleName.Users, action: PermissionAction.Admin, description: 'Administer users' },

  // Roles
  { module: ModuleName.Roles, action: PermissionAction.Create, description: 'Create roles' },
  { module: ModuleName.Roles, action: PermissionAction.Read, description: 'View roles' },
  { module: ModuleName.Roles, action: PermissionAction.Update, description: 'Edit roles' },
  { module: ModuleName.Roles, action: PermissionAction.Delete, description: 'Delete roles' },
  { module: ModuleName.Roles, action: PermissionAction.Admin, description: 'Administer roles' },

  // Settings
  { module: ModuleName.Settings, action: PermissionAction.Read, description: 'View settings' },
  { module: ModuleName.Settings, action: PermissionAction.Update, description: 'Edit settings' },
  {
    module: ModuleName.Settings,
    action: PermissionAction.Admin,
    description: 'Administer settings',
  },

  // Attorneys
  {
    module: ModuleName.Attorneys,
    action: PermissionAction.Create,
    description: 'Create attorneys',
  },
  { module: ModuleName.Attorneys, action: PermissionAction.Read, description: 'View attorneys' },
  { module: ModuleName.Attorneys, action: PermissionAction.Update, description: 'Edit attorneys' },
  {
    module: ModuleName.Attorneys,
    action: PermissionAction.Delete,
    description: 'Delete attorneys',
  },

  // Billing
  { module: ModuleName.Billing, action: PermissionAction.Read, description: 'View billing' },
  { module: ModuleName.Billing, action: PermissionAction.Update, description: 'Edit billing' },
  { module: ModuleName.Billing, action: PermissionAction.Admin, description: 'Administer billing' },

  // Files
  { module: ModuleName.Files, action: PermissionAction.Create, description: 'Upload files' },
  { module: ModuleName.Files, action: PermissionAction.Read, description: 'View files' },
  { module: ModuleName.Files, action: PermissionAction.Delete, description: 'Delete files' },

  // Leaderboard
  {
    module: ModuleName.Leaderboard,
    action: PermissionAction.Read,
    description: 'View leaderboard rankings and stats',
  },
  {
    module: ModuleName.Leaderboard,
    action: PermissionAction.Manage,
    description: 'Manage leaderboard scoring configuration',
  },

  // Audit
  { module: ModuleName.Audit, action: PermissionAction.Read, description: 'View audit logs' },

  // Pipeline Statuses
  {
    module: ModuleName.PipelineStatuses,
    action: PermissionAction.Create,
    description: 'Create pipeline statuses',
  },
  {
    module: ModuleName.PipelineStatuses,
    action: PermissionAction.Read,
    description: 'View pipeline statuses',
  },
  {
    module: ModuleName.PipelineStatuses,
    action: PermissionAction.Update,
    description: 'Edit pipeline statuses',
  },
  {
    module: ModuleName.PipelineStatuses,
    action: PermissionAction.Delete,
    description: 'Delete pipeline statuses',
  },

  // Auth
  {
    module: ModuleName.Auth,
    action: PermissionAction.Read,
    description: 'View auth provider settings',
  },
  {
    module: ModuleName.Auth,
    action: PermissionAction.Admin,
    description: 'Administer auth providers',
  },

  // Reminders
  {
    module: ModuleName.Reminders,
    action: PermissionAction.Create,
    description: 'Create reminders',
  },
  {
    module: ModuleName.Reminders,
    action: PermissionAction.Read,
    description: 'View reminders',
  },
  {
    module: ModuleName.Reminders,
    action: PermissionAction.Update,
    description: 'Edit AI-created reminders',
  },
  {
    module: ModuleName.Reminders,
    action: PermissionAction.Delete,
    description: 'Delete AI-created reminders',
  },

  // Tasks
  { module: ModuleName.Tasks, action: PermissionAction.Create, description: 'Create tasks' },
  { module: ModuleName.Tasks, action: PermissionAction.Read, description: 'View tasks' },
  { module: ModuleName.Tasks, action: PermissionAction.Update, description: 'Edit tasks' },
  { module: ModuleName.Tasks, action: PermissionAction.Delete, description: 'Delete tasks' },
  { module: ModuleName.Tasks, action: PermissionAction.Manage, description: 'Manage tasks' },

  // Teams
  { module: ModuleName.Teams, action: PermissionAction.Read, description: 'View teams' },
  {
    module: ModuleName.Teams,
    action: PermissionAction.Admin,
    description: 'Administer teams (create, update, delete)',
  },

  // Trash
  {
    module: ModuleName.Trash,
    action: PermissionAction.View,
    description: 'View soft-deleted records across modules',
  },
  {
    module: ModuleName.Trash,
    action: PermissionAction.Restore,
    description: 'Restore soft-deleted records',
  },
  {
    module: ModuleName.Trash,
    action: PermissionAction.HardDelete,
    description: 'Permanently delete soft-deleted records',
  },

  // Agency Requests
  {
    module: ModuleName.AgencyRequests,
    action: PermissionAction.Create,
    description: 'Create agency requests',
  },
  {
    module: ModuleName.AgencyRequests,
    action: PermissionAction.Read,
    description: 'View agency requests',
  },
  {
    module: ModuleName.AgencyRequests,
    action: PermissionAction.Update,
    description: 'Edit agency requests',
  },
  {
    module: ModuleName.AgencyRequests,
    action: PermissionAction.Delete,
    description: 'Delete agency requests',
  },
  {
    module: ModuleName.AgencyRequests,
    action: PermissionAction.Manage,
    description: 'Manage agency requests',
  },
];
