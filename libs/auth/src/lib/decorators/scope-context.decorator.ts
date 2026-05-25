import { getScopeContext, type IScopeContext } from '@mediastar/core';
import { createParamDecorator } from '@nestjs/common';

export const ScopeContext = createParamDecorator((): IScopeContext | undefined => {
  return getScopeContext();
});
