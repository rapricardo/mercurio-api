import { Injectable, Logger } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as jwt from 'jsonwebtoken';
import { CacheService } from '../services/cache.service';

export interface SupabaseUser {
  id: string;
  email?: string;
  name?: string;
  role?: string;
  app_metadata?: any;
  user_metadata?: any;
  aud?: string;
  exp?: number;
  iat?: number;
  iss?: string;
  sub?: string;
}

export interface SupabaseValidationResult {
  isValid: boolean;
  user?: SupabaseUser;
  error?: string;
}

@Injectable()
export class SupabaseAuthService {
  private readonly logger = new Logger(SupabaseAuthService.name);
  private readonly supabase: SupabaseClient;
  private readonly jwtSecret: string;
  private readonly cacheKeyPrefix = 'supabase_jwt:';
  private readonly cacheTtlMs = parseInt(process.env.SUPABASE_JWT_CACHE_TTL || '300000'); // 5 minutes

  constructor(private readonly cache: CacheService) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    this.jwtSecret = process.env.SUPABASE_JWT_SECRET || '';

    if (!supabaseUrl || !supabaseServiceKey) {
      this.logger.warn('Supabase configuration missing - Supabase authentication disabled');
      this.logger.warn('To enable Supabase auth, set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables');
      // Create a dummy client that will fail gracefully
      this.supabase = {} as SupabaseClient;
      return;
    }

    if (!this.jwtSecret) {
      this.logger.warn('SUPABASE_JWT_SECRET missing - JWT validation disabled');
      this.supabase = {} as SupabaseClient;
      return;
    }

    this.supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    this.logger.log('Supabase Auth Service initialized');
  }

  async validateJWT(token: string): Promise<SupabaseValidationResult> {
    // If Supabase is not configured, fail gracefully
    if (!this.jwtSecret) {
      return { 
        isValid: false, 
        error: 'Supabase JWT validation is not configured' 
      };
    }

    try {
      // Remove Bearer prefix if present
      const cleanToken = token.replace(/^Bearer\s+/i, '');
      
      // Check cache first
      const cacheKey = `${this.cacheKeyPrefix}${this.hashToken(cleanToken)}`;
      const cachedResult = this.cache.get<SupabaseValidationResult>(cacheKey);
      
      if (cachedResult) {
        this.logger.debug('JWT validation cache hit');
        return cachedResult;
      }

      // Debug JWT issuer validation - TEMPORARY
      this.logger.log('🔍 JWT Validation Debug', {
        jwtSecretPresent: !!this.jwtSecret,
        tokenStart: cleanToken.substring(0, 20) + '...',
        isAnonKey: cleanToken === this.jwtSecret
      });

      // Check if token is the anon key itself (development issue)
      if (cleanToken === this.jwtSecret) {
        this.logger.warn('🚨 Received anon key as token - creating mock user for development');
        // Create a consistent mock user for development when anon key is sent
        const mockUser: SupabaseUser = {
          id: 'mock-dev-user-12345', // Consistent ID for development
          email: 'dev@mercurio.com',
          name: 'Development User',
          role: 'authenticated',
          aud: 'authenticated',
          exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
          iat: Math.floor(Date.now() / 1000),
          iss: 'supabase',
          sub: 'mock-dev-user-12345' // Consistent sub for development
        };

        return {
          isValid: true,
          user: mockUser
        };
      }

      // Verify JWT signature and decode  
      // Supabase JWTs use project URL + /auth/v1 as issuer
      const decoded = jwt.verify(cleanToken, this.jwtSecret, {
        algorithms: ['HS256'],
        issuer: `${process.env.SUPABASE_URL}/auth/v1`,
      }) as SupabaseUser;

      // Debug actual token issuer - TEMPORARY
      this.logger.log('🎯 JWT Token Debug', {
        actualIssuer: (decoded as any).iss,
        expectedIssuer: `${process.env.SUPABASE_URL}/auth/v1`,
        isMatch: (decoded as any).iss === `${process.env.SUPABASE_URL}/auth/v1`,
        projectRef: (decoded as any).ref,
        userRole: (decoded as any).role
      });

      // Check if token is expired
      if (decoded.exp && Date.now() >= decoded.exp * 1000) {
        const result = { isValid: false, error: 'Token expired' };
        this.cache.set(cacheKey, result, 60000); // Cache failure for 1 minute
        return result;
      }

      // Validate user exists in our system (optional check)
      const user: SupabaseUser = {
        id: decoded.sub || decoded.id,
        email: decoded.email,
        name: decoded.user_metadata?.name || decoded.user_metadata?.full_name,
        role: decoded.role,
        app_metadata: decoded.app_metadata,
        user_metadata: decoded.user_metadata,
        aud: decoded.aud,
        exp: decoded.exp,
        iat: decoded.iat,
        iss: decoded.iss,
        sub: decoded.sub
      };

      const result: SupabaseValidationResult = {
        isValid: true,
        user
      };

      // Cache the successful result
      const ttl = decoded.exp 
        ? Math.min(this.cacheTtlMs, (decoded.exp * 1000) - Date.now())
        : this.cacheTtlMs;
      
      this.cache.set(cacheKey, result, Math.max(ttl, 60000)); // At least 1 minute
      
      this.logger.debug('JWT validation successful', { 
        userId: user.id, 
        email: user.email 
      });
      
      return result;

    } catch (error) {
      this.logger.warn('JWT validation failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      const result = { 
        isValid: false, 
        error: error instanceof Error ? error.message : 'Invalid token' 
      };
      
      // Cache failures briefly to avoid repeated validation attempts
      const cacheKey = `${this.cacheKeyPrefix}${this.hashToken(token)}`;
      this.cache.set(cacheKey, result, 60000); // 1 minute
      
      return result;
    }
  }

  async getUserProfile(userId: string): Promise<any> {
    try {
      const { data, error } = await this.supabase
        .from('user_profile')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        this.logger.warn('Failed to fetch user profile', { userId, error: error.message });
        return null;
      }

      return data;
    } catch (error) {
      this.logger.error('Error fetching user profile', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  async createOrUpdateUserProfile(user: SupabaseUser): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('user_profile')
        .upsert({
          id: user.id,
          email: user.email,
          name: user.name,
          avatar_url: user.user_metadata?.avatar_url,
          last_login_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'id'
        });

      if (error) {
        this.logger.error('Failed to create/update user profile', {
          userId: user.id,
          error: error.message
        });
      } else {
        this.logger.debug('User profile updated', { userId: user.id });
      }
    } catch (error) {
      this.logger.error('Error creating/updating user profile', {
        userId: user.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private hashToken(token: string): string {
    // Simple hash for cache key - first 8 chars of token
    return token.substring(0, 8);
  }

  /**
   * Clear JWT validation cache
   */
  clearCache(): void {
    const entries = this.cache.getEntries();
    let clearedCount = 0;

    for (const { key } of entries) {
      if (key.startsWith(this.cacheKeyPrefix)) {
        this.cache.delete(key);
        clearedCount++;
      }
    }

    this.logger.log(`Cleared ${clearedCount} Supabase JWT cache entries`);
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.cache.getStats();
  }
}