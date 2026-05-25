import { Prisma } from '@mediastar/database';

export const POPULATED_USER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
} satisfies Prisma.UserSelect;
