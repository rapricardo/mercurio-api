import { Module } from '@nestjs/common';
import { WorkspaceController } from './controllers/workspace.controller';
import { WorkspaceService } from './services/workspace.service';
import { PrismaService } from '../prisma.service';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [CommonModule],
  controllers: [WorkspaceController],
  providers: [
    WorkspaceService,
    PrismaService,
  ],
  exports: [WorkspaceService],
})
export class WorkspacesModule {}