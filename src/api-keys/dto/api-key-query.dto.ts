import { IsOptional, IsString, IsEnum, IsNumber, Min, Max } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ApiKeyQueryDto {
  @ApiPropertyOptional({
    description: 'Page number for pagination',
    example: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    example: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;

  @ApiPropertyOptional({
    description: 'Search term for API key name',
    example: 'production',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by API key status',
    enum: ['active', 'revoked', 'all'],
    example: 'active',
  })
  @IsOptional()
  @IsEnum(['active', 'revoked', 'all'])
  status?: 'active' | 'revoked' | 'all' = 'active';

  @ApiPropertyOptional({
    description: 'Sort field for API keys',
    enum: ['name', 'createdAt', 'lastUsedAt'],
    example: 'createdAt',
  })
  @IsOptional()
  @IsEnum(['name', 'createdAt', 'lastUsedAt'])
  sortBy?: 'name' | 'createdAt' | 'lastUsedAt' = 'createdAt';

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['asc', 'desc'],
    example: 'desc',
  })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';

  @ApiPropertyOptional({
    description: 'Filter by specific scope',
    example: 'events:write',
  })
  @IsOptional()
  @IsString()
  scope?: string;
}