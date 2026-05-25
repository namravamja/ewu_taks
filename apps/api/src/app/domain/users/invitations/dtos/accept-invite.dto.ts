import { PasswordDTO } from '@mediastar/shared';

import type { IAcceptInviteRequest } from '../interfaces/invitation.interface';

export class AcceptInviteDTO extends PasswordDTO implements IAcceptInviteRequest {}
