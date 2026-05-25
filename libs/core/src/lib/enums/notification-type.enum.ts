export const NotificationType = {
  SYSTEM: 'SYSTEM',
  ACCOUNT: 'ACCOUNT',
  INVITE: 'INVITE',
  APPROVAL: 'APPROVAL',
} as const;

export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];
