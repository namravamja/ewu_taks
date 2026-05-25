export interface MockLogger {
  setContext: jest.Mock;
  info: jest.Mock;
  error: jest.Mock;
  warn: jest.Mock;
  debug: jest.Mock;
  verbose: jest.Mock;
  log: jest.Mock;
}

export function createMockLogger(): MockLogger {
  return {
    setContext: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
    log: jest.fn(),
  };
}
