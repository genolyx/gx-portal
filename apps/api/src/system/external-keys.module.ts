import { Global, Module } from '@nestjs/common';
import { ExternalKeysService } from './external-keys.service';

@Global()
@Module({
  providers: [ExternalKeysService],
  exports: [ExternalKeysService],
})
export class ExternalKeysModule {}
