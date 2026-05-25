import { ALLOW_PENDING_KEY } from '@mediastar/core';
import { SetMetadata } from '@nestjs/common';

export const AllowPending = () => SetMetadata(ALLOW_PENDING_KEY, true);
