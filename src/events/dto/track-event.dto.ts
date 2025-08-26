import { IsString, IsOptional, IsObject, IsISO8601, Length, Matches } from 'class-validator'
import { Transform } from 'class-transformer'

export class PageInfoDto {
  @IsString()
  url!: string

  @IsOptional()
  @IsString()
  title?: string

  @IsOptional()
  @IsString()
  referrer?: string

  @IsOptional()
  @IsString()
  path?: string
}

export class UtmParametersDto {
  @IsOptional()
  @IsString()
  source?: string

  @IsOptional()
  @IsString()
  medium?: string

  @IsOptional()
  @IsString()
  campaign?: string

  @IsOptional()
  @IsString()
  term?: string

  @IsOptional()
  @IsString()
  content?: string
}

export class TrackEventDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  event_id?: string // Optional client-provided ID for deduplication

  @IsString()
  @Length(1, 100)
  event_name!: string

  @IsISO8601()
  timestamp!: string

  @IsString()
  @Matches(/^a_[a-zA-Z0-9_]+$/, {
    message: 'anonymous_id must start with "a_" and contain only alphanumeric characters and underscores'
  })
  anonymous_id!: string

  @IsOptional()
  @IsString()
  @Matches(/^s_[a-zA-Z0-9_]+$/, {
    message: 'session_id must start with "s_" and contain only alphanumeric characters and underscores'
  })
  session_id?: string

  @IsOptional()
  @IsObject()
  properties?: Record<string, any>

  @IsOptional()
  @Transform(({ value }) => value && typeof value === 'object' ? value : undefined)
  page?: PageInfoDto

  @IsOptional()
  @Transform(({ value }) => value && typeof value === 'object' ? value : undefined)
  utm?: UtmParametersDto
}

export class BatchEventDto {
  @IsObject({ each: true })
  events!: TrackEventDto[]
}

export class IdentifyEventDto {
  @IsString()
  @Matches(/^a_[a-zA-Z0-9_]+$/, {
    message: 'anonymous_id must start with "a_" and contain only alphanumeric characters and underscores'
  })
  anonymous_id!: string

  @IsOptional()
  @IsString()
  user_id?: string

  @IsOptional()
  @IsObject()
  traits?: Record<string, any>

  @IsOptional()
  @IsISO8601()
  timestamp?: string
}