import { SKIP_TWO_FACTOR_ENFORCEMENT_KEY } from '@mediastar/core';
import { SetMetadata } from '@nestjs/common';

export const SkipTwoFactorEnforcement = () => SetMetadata(SKIP_TWO_FACTOR_ENFORCEMENT_KEY, true);
