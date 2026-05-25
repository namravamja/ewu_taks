export const NotificationCategory = {
  CASE: 'CASE',
  USER: 'USER',
  EMAIL: 'EMAIL',
  SYSTEM: 'SYSTEM',
  PROMOTIONAL: 'PROMOTIONAL',
  REMINDER: 'REMINDER',
} as const;

export type NotificationCategory = (typeof NotificationCategory)[keyof typeof NotificationCategory];

export const NOTIFICATION_CATEGORY_VALUES = Object.values(
  NotificationCategory,
) as readonly NotificationCategory[];
