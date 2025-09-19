import { Module } from '@nestjs/common'
import { InvitationsController } from './controllers/invitations.controller'
import { InvitationsService } from './services/invitations.service'
import { CommonModule } from '../common/common.module'

@Module({
  imports: [CommonModule],
  controllers: [InvitationsController],
  providers: [InvitationsService],
  exports: [InvitationsService],
})
export class InvitationsModule {}
