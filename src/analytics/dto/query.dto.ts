import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsDateString,
  IsArray,
  IsInt,
  Min,
  Max,
  IsBoolean,
  IsObject,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { PeriodType, GranularityType, MetricType } from '../types/analytics.types';

export class PeriodQueryDto {
  @IsEnum(['24h', '7d', '30d', 'custom'])
  @IsNotEmpty()
  period!: PeriodType;

  @IsDateString()
  @ValidateIf((o) => o.period === 'custom')
  @IsNotEmpty()
  start_date?: string;

  @IsDateString()
  @ValidateIf((o) => o.period === 'custom')
  @IsNotEmpty()
  end_date?: string;

  @IsOptional()
  @IsString()
  timezone?: string = 'UTC';

  get startDate(): Date {
    if (this.period === 'custom' && this.start_date) {
      return new Date(this.start_date);
    }
    return this.getPeriodStartDate();
  }

  get endDate(): Date {
    if (this.period === 'custom' && this.end_date) {
      return new Date(this.end_date);
    }
    return new Date();
  }

  private getPeriodStartDate(): Date {
    const now = new Date();
    switch (this.period) {
      case '24h':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      default:
        throw new Error('Invalid period');
    }
  }
}

export class OverviewQueryDto extends PeriodQueryDto {}

export class TimeSeriesQueryDto extends PeriodQueryDto {
  @IsEnum(['hour', 'day', 'week'])
  @IsNotEmpty()
  granularity!: GranularityType;

  @IsArray()
  @IsEnum(['events', 'visitors', 'sessions', 'conversions'], { each: true })
  @IsNotEmpty()
  @Transform(({ value }) => {
    if (Array.isArray(value)) return value;
    return typeof value === 'string' ? value.split(',') : [value];
  })
  metrics!: MetricType[];
}

export class TopEventsQueryDto extends PeriodQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Transform(({ value }) => parseInt(value, 10))
  limit?: number = 10;
}

export class UserAnalyticsQueryDto extends PeriodQueryDto {
  @IsOptional()
  @IsEnum(['all', 'visitors', 'leads'])
  segment?: 'all' | 'visitors' | 'leads' = 'all';
}

export class EventDetailsQueryDto extends PeriodQueryDto {
  @IsOptional()
  @IsString()
  event_name?: string;

  @IsOptional()
  @IsString()
  anonymous_id?: string;

  @IsOptional()
  @IsString()
  lead_id?: string;

  @IsOptional()
  @IsString()
  session_id?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (typeof value === 'boolean') return value;
    return value === 'true';
  })
  has_lead?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }) => parseInt(value, 10))
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  @Transform(({ value }) => parseInt(value, 10))
  limit?: number = 50;

  @IsOptional()
  @IsEnum(['timestamp', 'event_name'])
  sort_by?: 'timestamp' | 'event_name' = 'timestamp';

  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sort_order?: 'asc' | 'desc' = 'desc';
}

export class ExportRequestDto extends PeriodQueryDto {
  @IsEnum(['events', 'overview', 'timeseries', 'users'])
  @IsNotEmpty()
  dataset!: 'events' | 'overview' | 'timeseries' | 'users';

  @IsEnum(['json', 'csv'])
  @IsNotEmpty()
  format!: 'json' | 'csv';

  @IsOptional()
  @IsObject()
  filters?: Record<string, any>;
}