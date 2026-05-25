export const LOGGER_CONFIG = Symbol('LOGGER_CONFIG');
export const WINSTON_INSTANCE = Symbol('WINSTON_INSTANCE');

export const SENSITIVE_FIELDS = [
  'password',
  'token',
  'secret',
  'apikey',
  'authorization',
  'cookie',
  'accesstoken',
  'refreshtoken',
  'secretaccesskey',
  'awssecretaccesskey',
  'mongouri',
  'creditcard',
  'ssn',
  'code',
  'state',
] as const;
