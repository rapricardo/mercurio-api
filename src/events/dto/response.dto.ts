export interface ValidationError {
  field: string
  message: string
  value?: any
}

export interface EventResponse {
  accepted: boolean
  event_id?: string
  is_duplicate?: boolean // Indicates if this was a duplicate event (idempotent)
  errors?: ValidationError[]
}

export interface BatchResponse {
  accepted: number
  rejected: number
  total: number
  results: EventResponse[]
  errors?: ValidationError[]
}

export interface IdentifyResponse {
  accepted: boolean
  lead_id?: string
  errors?: ValidationError[]
}

export interface ProcessingResult {
  success: boolean
  eventId?: string
  leadId?: string
  sessionId?: string
  isDuplicate?: boolean // Flag indicating if this was a duplicate event
  errors?: ValidationError[]
}

export interface BatchProcessingResult {
  totalProcessed: number
  successCount: number
  errorCount: number
  results: ProcessingResult[]
}