import { Injectable } from '@nestjs/common'
import { ServerClient } from 'postmark'
import { MercurioLogger, LogContext } from './logger.service'
import { MetricsService } from './metrics.service'

export interface InvitationData {
  id: string
  email: string
  role: string
  tenantName: string
  workspaceName: string
  inviterName?: string
  inviterEmail?: string
  createdAt: Date
  expiresAt: Date
}

export interface EmailSendResult {
  success: boolean
  messageId?: string
  error?: string
}

@Injectable()
export class EmailService {
  private readonly mercurioLogger: MercurioLogger
  private readonly metricsService: MetricsService
  private readonly postmarkClient: ServerClient | null = null
  private readonly isEnabled: boolean

  constructor(mercurioLogger: MercurioLogger, metricsService: MetricsService) {
    this.mercurioLogger = mercurioLogger
    this.metricsService = metricsService
    const postmarkEnabled = process.env.POSTMARK_ENABLED === 'true'

    if (postmarkEnabled) {
      const serverToken = process.env.POSTMARK_SERVER_TOKEN
      const fromEmail = process.env.POSTMARK_FROM_EMAIL

      if (!serverToken || !fromEmail) {
        this.mercurioLogger.error(
          'Invalid Postmark configuration - required environment variables missing',
          new Error('Missing Postmark config'),
          {
            serverTokenProvided: !!serverToken,
            fromEmailProvided: !!fromEmail,
          },
          {
            category: 'email_service_config',
          }
        )

        this.isEnabled = false
        this.mercurioLogger.warn(
          'Email service disabled due to invalid configuration',
          {},
          {
            category: 'email_service_config',
          }
        )
      } else {
        try {
          this.postmarkClient = new ServerClient(serverToken)
          this.isEnabled = true
          this.mercurioLogger.log(
            'Email service initialized with Postmark',
            {},
            {
              category: 'email_service_config',
              fromEmail,
            }
          )
        } catch (error) {
          this.mercurioLogger.error(
            'Failed to initialize Postmark client',
            error as Error,
            {},
            {
              category: 'email_service_config',
            }
          )
          this.isEnabled = false
        }
      }
    } else {
      this.isEnabled = false
      this.mercurioLogger.log(
        'Email service initialized (disabled - emails will be logged only)',
        {},
        {
          category: 'email_service_config',
        }
      )
    }
  }

  /**
   * Check if email service is enabled
   */
  isEmailEnabled(): boolean {
    return this.isEnabled && this.postmarkClient !== null
  }

  /**
   * Send invitation email to user
   */
  async sendInvitationEmail(
    invitation: InvitationData,
    inviteLink: string,
    context: LogContext = {}
  ): Promise<EmailSendResult> {
    const startTime = Date.now()

    try {
      // Log invitation email attempt
      this.mercurioLogger.log(
        'Sending invitation email',
        {
          ...context,
          invitationId: invitation.id,
        },
        {
          category: 'email_sending',
          email: invitation.email,
          role: invitation.role,
          tenantName: invitation.tenantName,
        }
      )

      // If email is disabled, just log and return success
      if (!this.isEmailEnabled()) {
        this.mercurioLogger.warn(
          `Email disabled - would send invitation to ${invitation.email}`,
          {
            ...context,
            invitationId: invitation.id,
          },
          {
            category: 'email_sending_disabled',
            email: invitation.email,
          }
        )
        this.mercurioLogger.warn(
          `Invitation link: ${inviteLink.substring(0, inviteLink.lastIndexOf('/') + 7)}...`,
          {
            ...context,
            invitationId: invitation.id,
          },
          {
            category: 'email_sending_disabled',
          }
        )

        this.metricsService.incrementCounter('email.disabled_sends')
        return { success: true, messageId: 'disabled' }
      }

      // Generate email content
      const { subject, htmlBody, textBody } = this.generateInvitationEmailContent(
        invitation,
        inviteLink
      )

      // Send via Postmark
      const response = await this.postmarkClient!.sendEmail({
        From: `${process.env.POSTMARK_FROM_NAME || 'Mercurio'} <${process.env.POSTMARK_FROM_EMAIL}>`,
        To: invitation.email,
        Subject: subject,
        HtmlBody: htmlBody,
        TextBody: textBody,
        MessageStream: 'outbound',
      })

      // Record success metrics
      const latency = Date.now() - startTime
      this.metricsService.incrementCounter('email.sent_success')
      this.metricsService.recordLatency('email.send_latency', latency)

      this.mercurioLogger.log(
        'Invitation email sent successfully',
        {
          ...context,
          invitationId: invitation.id,
        },
        {
          category: 'email_sending',
          messageId: response.MessageID,
          latencyMs: latency,
        }
      )

      return { success: true, messageId: response.MessageID }
    } catch (error) {
      // Record error metrics
      const latency = Date.now() - startTime
      this.metricsService.incrementCounter('email.sent_errors')
      this.metricsService.recordLatency('email.send_latency', latency)

      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      this.mercurioLogger.error(
        'Failed to send invitation email',
        error as Error,
        {
          ...context,
          invitationId: invitation.id,
        },
        {
          category: 'email_sending',
          email: invitation.email,
          latencyMs: latency,
        }
      )

      return { success: false, error: errorMessage }
    }
  }

  /**
   * Generate invitation email content
   */
  private generateInvitationEmailContent(
    invitation: InvitationData,
    inviteLink: string
  ): { subject: string; htmlBody: string; textBody: string } {
    const subject = `You're invited to join ${invitation.tenantName} on Mercurio`

    const htmlBody = this.generateInvitationHtmlTemplate(invitation, inviteLink)
    const textBody = this.generateInvitationTextTemplate(invitation, inviteLink)

    return { subject, htmlBody, textBody }
  }

  /**
   * Calculate expiry message in days
   */
  private getExpiryMessage(expiresAt: Date): string {
    const now = new Date()
    const diffTime = expiresAt.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays <= 1) {
      return '1 day'
    }
    return `${diffDays} days`
  }

  /**
   * Generate HTML email template for invitation
   */
  private generateInvitationHtmlTemplate(invitation: InvitationData, inviteLink: string): string {
    const tenantName = invitation.tenantName
    const role = invitation.role
    const expiryMessage = this.getExpiryMessage(invitation.expiresAt)
    const inviterInfo = invitation.inviterName
      ? `${invitation.inviterName} (${invitation.inviterEmail})`
      : 'the team'

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invitation to ${tenantName}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f4f4f4;
            margin: 0;
            padding: 20px;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 600;
        }
        .content {
            padding: 40px 30px;
        }
        .invitation-details {
            background-color: #f8f9fa;
            border-left: 4px solid #667eea;
            padding: 20px;
            margin: 20px 0;
            border-radius: 4px;
        }
        .invitation-details h3 {
            margin: 0 0 10px 0;
            color: #667eea;
            font-size: 18px;
        }
        .invitation-details p {
            margin: 5px 0;
            color: #666;
        }
        .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px 30px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            font-size: 16px;
            margin: 20px 0;
            transition: transform 0.2s;
        }
        .cta-button:hover {
            transform: translateY(-1px);
        }
        .footer {
            background-color: #f8f9fa;
            padding: 20px 30px;
            text-align: center;
            color: #666;
            font-size: 14px;
            border-top: 1px solid #eee;
        }
        .security-note {
            background-color: #fff3cd;
            border: 1px solid #ffeaa7;
            color: #856404;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
            font-size: 14px;
        }
        @media (max-width: 600px) {
            .container {
                margin: 0;
                border-radius: 0;
            }
            .header, .content {
                padding: 30px 20px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>You're Invited!</h1>
        </div>
        
        <div class="content">
            <p>Hello,</p>
            
            <p>You've been invited by ${inviterInfo} to join <strong>${tenantName}</strong> on the Mercurio analytics platform.</p>
            
            <div class="invitation-details">
                <h3>Invitation Details</h3>
                <p><strong>Organization:</strong> ${tenantName}</p>
                <p><strong>Role:</strong> ${role}</p>
                <p><strong>Email:</strong> ${invitation.email}</p>
            </div>
            
            <p>Click the button below to accept your invitation and set up your account:</p>
            
            <p style="text-align: center;">
                <a href="${inviteLink}" class="cta-button">Accept Invitation</a>
            </p>
            
            <div class="security-note">
                <strong>Security Note:</strong> This invitation link is unique to you and will expire after ${expiryMessage}. 
                If you weren't expecting this invitation, you can safely ignore this email.
            </div>
            
            <p>If the button above doesn't work, you can copy and paste this link into your browser:</p>
            <p style="word-break: break-all; background-color: #f8f9fa; padding: 10px; border-radius: 4px; font-family: monospace; font-size: 14px;">
                ${inviteLink}
            </p>
            
            <p>Welcome to Mercurio!</p>
        </div>
        
        <div class="footer">
            <p>This email was sent by Mercurio Analytics Platform</p>
            <p>If you have any questions, please contact your organization administrator.</p>
        </div>
    </div>
</body>
</html>`
  }

  /**
   * Generate plain text email template for invitation
   */
  private generateInvitationTextTemplate(invitation: InvitationData, inviteLink: string): string {
    const tenantName = invitation.tenantName
    const role = invitation.role
    const expiryMessage = this.getExpiryMessage(invitation.expiresAt)
    const inviterInfo = invitation.inviterName
      ? `${invitation.inviterName} (${invitation.inviterEmail})`
      : 'the team'

    return `
You're Invited to Join ${tenantName}!

Hello,

You've been invited by ${inviterInfo} to join ${tenantName} on the Mercurio analytics platform.

Invitation Details:
- Organization: ${tenantName}
- Role: ${role}
- Email: ${invitation.email}

To accept your invitation and set up your account, please visit:
${inviteLink}

SECURITY NOTE: This invitation link is unique to you and will expire after ${expiryMessage}. 
If you weren't expecting this invitation, you can safely ignore this email.

Welcome to Mercurio!

---
This email was sent by Mercurio Analytics Platform
If you have any questions, please contact your organization administrator.
`
  }
}
