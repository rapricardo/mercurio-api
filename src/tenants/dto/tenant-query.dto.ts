import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsOptional, IsString, IsNumber, Min, Max, IsEnum } from 'class-validator'
import { Type, Transform } from 'class-transformer'

export class TenantQueryDto {
  @ApiPropertyOptional({
    description: 'Page number for pagination',
    example: 1,
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1

  @ApiPropertyOptional({
    description: 'Number of items per page',
    example: 20,
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  pageSize?: number = 20

  @ApiPropertyOptional({
    description: 'Search term for tenant name',
    example: 'acme',
  })
  @IsOptional()
  @IsString()
  search?: string

  @ApiPropertyOptional({
    description: 'Filter by tenant status',
    example: 'active',
    enum: ['active', 'inactive', 'suspended'],
  })
  @IsOptional()
  @IsEnum(['active', 'inactive', 'suspended'], {
    message: 'Status must be one of: active, inactive, suspended',
  })
  status?: string

  @ApiPropertyOptional({
    description: 'Filter by subscription plan',
    example: 'pro',
  })
  @IsOptional()
  @IsString()
  plan?: string

  @ApiPropertyOptional({
    description: 'Sort field',
    example: 'createdAt',
    enum: ['name', 'createdAt', 'status'],
    default: 'createdAt',
  })
  @IsOptional()
  @IsEnum(['name', 'createdAt', 'status'], {
    message: 'Sort field must be one of: name, createdAt, status',
  })
  sortBy?: string = 'createdAt'

  @ApiPropertyOptional({
    description: 'Sort order',
    example: 'desc',
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @IsOptional()
  @IsEnum(['asc', 'desc'], {
    message: 'Sort order must be either asc or desc',
  })
  sortOrder?: string = 'desc'

  @ApiPropertyOptional({
    description: 'Include tenant statistics in response',
    example: true,
    type: 'boolean',
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true
    if (value === 'false' || value === false) return false
    return false
  })
  includeStats?: boolean = false
}
