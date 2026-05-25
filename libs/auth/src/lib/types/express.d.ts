import type { IUserContext } from '@mediastar/shared';

declare global {
  namespace Express {
    interface Request {
      user?: IUserContext;
    }
  }
}
