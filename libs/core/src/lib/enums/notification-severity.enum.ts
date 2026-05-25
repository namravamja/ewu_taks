export const NotificationSeverity = {
  INFO: 'INFO',
  WARNING: 'WARNING',
  URGENT: 'URGENT',
} as const;

export type NotificationSeverity = (typeof NotificationSeverity)[keyof typeof NotificationSeverity];
