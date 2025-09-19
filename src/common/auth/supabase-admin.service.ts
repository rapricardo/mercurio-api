import { Injectable, Logger } from '@nestjs/common'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

export interface CreateUserResult {
  success: boolean
  userId?: string
  error?: string
}

export interface UserExistsResult {
  exists: boolean
  userId?: string
  error?: string
}

@Injectable()
export class SupabaseAdminService {
  private readonly logger = new Logger(SupabaseAdminService.name)
  private readonly supabase: SupabaseClient
  private readonly anonClient: SupabaseClient
  private readonly isConfigured: boolean

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      this.logger.warn('Supabase admin configuration missing - Admin operations disabled')
      this.logger.warn(
        'To enable Supabase admin, set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables'
      )
      this.supabase = {} as SupabaseClient
      this.anonClient = {} as SupabaseClient
      this.isConfigured = false
      return
    }

    this.supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Create anon client for sign-in operations
    this.anonClient = createClient(supabaseUrl, supabaseAnonKey || supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    this.isConfigured = true
    this.logger.log('Supabase Admin Service initialized')
  }

  async createUser(email: string, password: string, metadata?: any): Promise<CreateUserResult> {
    if (!this.isConfigured) {
      return {
        success: false,
        error: 'Supabase admin service is not configured',
      }
    }

    try {
      this.logger.log('Creating new user via Supabase Admin', { email })

      const { data, error } = await this.supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: metadata || {},
      })

      if (error) {
        this.logger.error('Failed to create user in Supabase', {
          email,
          error: error.message,
          code: error.code || 'unknown',
        })

        // If user already exists, we should handle this gracefully
        if (
          error.message?.includes('already exists') ||
          error.message?.includes('already registered') ||
          error.code === '422'
        ) {
          return {
            success: false,
            error: `User with email ${email} already exists`,
          }
        }

        return {
          success: false,
          error: error.message,
        }
      }

      if (!data.user) {
        this.logger.error('No user returned from Supabase create operation', { email })
        return {
          success: false,
          error: 'Failed to create user - no user data returned',
        }
      }

      this.logger.log('User created successfully in Supabase', {
        email,
        userId: data.user.id,
      })

      return {
        success: true,
        userId: data.user.id,
      }
    } catch (error) {
      this.logger.error('Error creating user in Supabase', {
        email,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      })

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }
    }
  }

  async checkUserExists(email: string): Promise<UserExistsResult> {
    if (!this.isConfigured) {
      return {
        exists: false,
        error: 'Supabase admin service is not configured',
      }
    }

    try {
      this.logger.debug('Checking if user exists in Supabase', { email })

      // Since Supabase doesn't have a direct getUserByEmail API,
      // we'll use a small pagination approach with a reasonable limit
      const perPage = 100
      const maxPages = 10 // Limit search to first 1000 users for performance
      let page = 1
      let foundUser = null
      let error = null

      while (page <= maxPages) {
        const { data: listData, error: listError } = await this.supabase.auth.admin.listUsers({
          page,
          perPage,
        })

        if (listError) {
          error = listError
          break
        }

        // Check if user exists in current page
        foundUser = listData.users.find((user) => user.email === email)
        if (foundUser) {
          break
        }

        // If we got fewer users than perPage, we've reached the end
        if (listData.users.length < perPage) {
          break
        }

        page++
      }

      const data = foundUser ? { users: [foundUser] } : { users: [] }

      if (error) {
        // If the error is "User not found", that's a valid response
        if (error.message?.includes('User not found') || error.status === 404) {
          this.logger.debug('User does not exist in Supabase', { email })
          return {
            exists: false,
          }
        }

        // For other errors, log and return error
        this.logger.error('Failed to check user existence in Supabase', {
          email,
          error: error.message,
        })

        return {
          exists: false,
          error: error.message,
        }
      }

      if (data?.users && data.users.length > 0) {
        const user = data.users.find((u) => u.email === email)
        if (user) {
          this.logger.debug('User exists in Supabase', { email, userId: user.id })
          return {
            exists: true,
            userId: user.id,
          }
        }
      }

      this.logger.debug('User does not exist in Supabase', { email })
      return {
        exists: false,
      }
    } catch (error) {
      this.logger.error('Error checking if user exists in Supabase', {
        email,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      })

      return {
        exists: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }
    }
  }

  async signInUser(email: string, password: string): Promise<string | null> {
    if (!this.isConfigured) {
      this.logger.warn('Cannot sign in user - Supabase admin service not configured')
      return null
    }

    try {
      this.logger.debug('Signing in user', { email })

      const { data, error } = await this.anonClient.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        this.logger.error('Failed to sign in user', {
          email,
          error: error.message,
        })
        return null
      }

      if (!data.session?.access_token) {
        this.logger.error('No access token returned from sign in', { email })
        return null
      }

      this.logger.debug('User signed in successfully', { email })
      return data.session.access_token
    } catch (error) {
      this.logger.error('Error signing in user', {
        email,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      return null
    }
  }

  async generateAccessToken(userId: string): Promise<string | null> {
    this.logger.warn('generateAccessToken is deprecated - use signInUser instead', { userId })
    return null
  }
}
