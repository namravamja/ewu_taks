import { IS_PUBLIC_KEY } from '@mediastar/core';
import { SetMetadata } from '@nestjs/common';

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
