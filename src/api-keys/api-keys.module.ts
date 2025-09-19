import { Module } from '@nestjs/common'
import { ApiKeyController } from './controllers/api-key.controller'
import { CommonModule } from '../common/common.module'

@Module({
  imports: [CommonModule],
  controllers: [ApiKeyController],
  providers: [],
  exports: [],
})
export class ApiKeysModule {}
