import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as nodemailer from 'nodemailer'

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name)
  private transporter: nodemailer.Transporter
  private from: string

  constructor(private config: ConfigService) {
    this.from = config.get('MAIL_FROM', 'noreply@marketplace.local')

    this.transporter = nodemailer.createTransport({
      host:   config.get('SMTP_HOST', 'smtp.gmail.com'),
      port:   Number(config.get('SMTP_PORT', '587')),
      secure: config.get('SMTP_PORT', '587') === '465',
      auth: {
        user: config.get('SMTP_USER', ''),
        pass: config.get('SMTP_PASS', ''),
      },
    })
  }

  async sendMagicLink(to: string, token: string) {
    const frontendUrl = this.config.get('FRONTEND_URL', 'http://localhost:3000')
    const link = `${frontendUrl}/auth/callback?token=${token}`

    try {
      await this.transporter.sendMail({
        from:    this.from,
        to,
        subject: 'Your sign-in link — Student Marketplace',
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:auto">
            <h2 style="color:#2563EB">Student Marketplace</h2>
            <p>Click the link below to sign in. This link expires in 15 minutes.</p>
            <a href="${link}"
               style="display:inline-block;padding:12px 24px;background:#2563EB;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
              Sign in
            </a>
            <p style="color:#4B5563;font-size:12px;margin-top:16px">
              Or copy this URL: ${link}
            </p>
          </div>
        `,
      })
      this.logger.log(`Magic link sent to ${to}`)
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        this.logger.warn(`[DEV] SMTP unavailable — magic link for ${to}:\n  ${link}`)
        return
      }
      this.logger.error(`Failed to send magic link to ${to}`, err)
      throw new Error('Failed to send magic link email.')
    }
  }

  async sendPasswordReset(to: string, token: string) {
    const frontendUrl = this.config.get('FRONTEND_URL', 'http://localhost:3000')
    const link = `${frontendUrl}/auth/reset-password?token=${token}`

    try {
      await this.transporter.sendMail({
        from:    this.from,
        to,
        subject: 'Reset your password — Student Marketplace',
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:auto">
            <h2 style="color:#2563EB">Student Marketplace</h2>
            <p>Click the link below to reset your password. This link expires in 15 minutes.</p>
            <a href="${link}"
               style="display:inline-block;padding:12px 24px;background:#2563EB;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
              Reset password
            </a>
          </div>
        `,
      })
      this.logger.log(`Password reset sent to ${to}`)
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        this.logger.warn(`[DEV] SMTP unavailable — reset link for ${to}:\n  ${link}`)
        return
      }
      this.logger.error(`Failed to send password reset to ${to}`, err)
      throw new Error('Failed to send password reset email.')
    }
  }
}
