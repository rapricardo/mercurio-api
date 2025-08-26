import { Module } from '@nestjs/common';
import { TenantController } from './controllers/tenant.controller';
import { TenantService } from './services/tenant.service';
import { PrismaService } from '../prisma.service';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [CommonModule],
  controllers: [TenantController],
  providers: [
    TenantService,
    PrismaService,
  ],
  exports: [TenantService],
})
export class TenantsModule {}