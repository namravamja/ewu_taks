import { SetMetadata } from '@nestjs/common';

import { THROTTLE_TIER_KEY, THROTTLE_TIERS, type ThrottleTierName } from '../constants/index';

export const ThrottleTier = (tier: ThrottleTierName): ReturnType<typeof SetMetadata> =>
  SetMetadata(THROTTLE_TIER_KEY, tier);

export const AuthThrottle = (): ReturnType<typeof SetMetadata> => ThrottleTier(THROTTLE_TIERS.AUTH);
export const OtpThrottle = (): ReturnType<typeof SetMetadata> => ThrottleTier(THROTTLE_TIERS.OTP);
export const UploadThrottle = (): ReturnType<typeof SetMetadata> =>
  ThrottleTier(THROTTLE_TIERS.UPLOAD);
export const RegistrationThrottle = (): ReturnType<typeof SetMetadata> =>
  ThrottleTier(THROTTLE_TIERS.REGISTRATION);
export const AiTurnThrottle = (): ReturnType<typeof SetMetadata> =>
  ThrottleTier(THROTTLE_TIERS.AI_TURN);
