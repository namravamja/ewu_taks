import { Module } from '@nestjs/common';

import { EncryptionService } from './services/encryption.service';
import { PasswordService } from './services/password.service';

@Module({
  providers: [PasswordService, EncryptionService],
  exports: [PasswordService, EncryptionService],
})
export class SharedModule {}
