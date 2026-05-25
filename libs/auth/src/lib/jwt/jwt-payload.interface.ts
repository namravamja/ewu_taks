export interface IBaseJwtPayload {
  sub: string;
  sessionId: string;
  iss: string;
  aud: string;
  iat?: number;
  exp?: number;
}

export interface IAccessTokenPayload extends IBaseJwtPayload {
  type: 'access';
}

export interface IRefreshTokenPayload extends IBaseJwtPayload {
  type: 'refresh';
}

export interface ITwoFactorTokenPayload extends IBaseJwtPayload {
  type: 'two_factor';
}

export interface ISessionMgmtTokenPayload extends IBaseJwtPayload {
  type: 'session_management';
  trustDevice: boolean;
  /** IP address of the original login request — verified on redemption. */
  boundIp: string;
}
