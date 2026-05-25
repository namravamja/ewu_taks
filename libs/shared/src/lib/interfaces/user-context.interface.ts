import type { IUserIdentity } from './user-identity.interface';

export interface IUserContext extends IUserIdentity {
  sessionId: number;
}
