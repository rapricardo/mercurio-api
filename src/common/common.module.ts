import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { MercurioLogger } from './services/logger.service';
import { CacheService } from './services/cache.service';
import { MetricsService } from './services/metrics.service';
import { EncryptionService } from './services/encryption.service';
import { RateLimitService } from './services/rate-limit.service';
import { InitializationService } from './services/initialization.service';
import { RequestContextMiddleware } from './middleware/request-context.middleware';
import { ApiKeyGuard } from './auth/api-key.guard';
import { RateLimitGuard } from './guards/rate-limit.guard';
import { ApiKeyService } from './auth/api-key.service';
import { SupabaseAuthService } from './auth/supabase-auth.service';
import { UserMappingService } from './auth/user-mapping.service';
import { HybridAuthGuard } from './auth/hybrid-auth.guard';
import { UserManagementController } from './auth/user-management.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [UserManagementController],
  providers: [
    PrismaService,
    MercurioLogger,
    CacheService,
    MetricsService,
    EncryptionService,
    RateLimitService,
    InitializationService,
    ApiKeyService,
    SupabaseAuthService,
    UserMappingService,
    ApiKeyGuard,
    HybridAuthGuard,
    RateLimitGuard,
  ],
  exports: [
    PrismaService,
    MercurioLogger,
    CacheService,
    MetricsService,
    EncryptionService,
    RateLimitService,
    InitializationService,
    ApiKeyService,
    SupabaseAuthService,
    UserMappingService,
    ApiKeyGuard,
    HybridAuthGuard,
    RateLimitGuard,
  ],
})
export class CommonModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RequestContextMiddleware)
      .forRoutes('*'); // Apply to all routes
  }
}