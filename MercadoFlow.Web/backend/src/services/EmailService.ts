import nodemailer from 'nodemailer';
import { ConfigService } from './ConfigService';
import { LoggerService } from './LoggerService';
import { IEmailService } from '../types/common.types';

const config = new ConfigService();
const logger = new LoggerService();

export class EmailService implements IEmailService {
  private transporter: nodemailer.Transporter | null = null;
  private enabled: boolean = false;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    const smtpHost = config.get('SMTP_HOST');
    const smtpPort = config.get('SMTP_PORT', 587);
    const smtpUser = config.get('SMTP_USER');
    const smtpPass = config.get('SMTP_PASS');

    // Only enable if SMTP credentials are provided
    if (smtpHost && smtpUser && smtpPass) {
      try {
        this.transporter = nodemailer.createTransporter({
          host: smtpHost,
          port: Number(smtpPort),
          secure: Number(smtpPort) === 465,
          auth: {
            user: smtpUser,
            pass: smtpPass,
          },
        });

        this.enabled = true;
        logger.info('Email service initialized', { host: smtpHost });
      } catch (error) {
        logger.error('Failed to initialize email service', { error });
        this.enabled = false;
      }
    } else {
      logger.warn('Email service disabled - SMTP credentials not configured');
      this.enabled = false;
    }
  }

  /**
   * Send email using template
   */
  async sendEmail(to: string | string[], subject: string, template: string, data?: any): Promise<boolean> {
    if (!this.enabled || !this.transporter) {
      logger.warn('Email service not enabled, skipping email', { to, subject });
      return false;
    }

    try {
      const recipients = Array.isArray(to) ? to : [to];
      const htmlContent = this.renderTemplate(template, data);

      const mailOptions = {
        from: config.get('SMTP_FROM', `"MercadoFlow" <${config.get('SMTP_USER')}>`),
        to: recipients.join(', '),
        subject,
        html: htmlContent,
      };

      const info = await this.transporter.sendMail(mailOptions);

      logger.info('Email sent successfully', {
        to: recipients,
        subject,
        messageId: info.messageId,
      });

      return true;
    } catch (error) {
      logger.error('Failed to send email', { error, to, subject });
      return false;
    }
  }

  /**
   * Send alert notification email
   */
  async sendAlertEmail(to: string | string[], alertTitle: string, alertMessage: string, priority: string): Promise<boolean> {
    return this.sendEmail(to, `🚨 Alerta: ${alertTitle}`, 'alert', {
      title: alertTitle,
      message: alertMessage,
      priority,
      priorityColor: this.getPriorityColor(priority),
    });
  }

  /**
   * Send welcome email to new user
   */
  async sendWelcomeEmail(to: string, userName: string): Promise<boolean> {
    return this.sendEmail(to, 'Bem-vindo ao MercadoFlow', 'welcome', {
      name: userName,
    });
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(to: string, resetToken: string): Promise<boolean> {
    const resetLink = `${config.get('FRONTEND_URL', 'http://localhost:3001')}/reset-password?token=${resetToken}`;

    return this.sendEmail(to, 'Redefinir Senha - MercadoFlow', 'password-reset', {
      resetLink,
      expiresIn: '1 hora',
    });
  }

  /**
   * Send daily report email
   */
  async sendDailyReportEmail(to: string | string[], marketName: string, reportData: any): Promise<boolean> {
    return this.sendEmail(to, `Relatório Diário - ${marketName}`, 'daily-report', {
      marketName,
      ...reportData,
    });
  }

  /**
   * Simple template renderer
   */
  private renderTemplate(template: string, data?: any): string {
    const templates: Record<string, (data: any) => string> = {
      alert: (d) => `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: ${d.priorityColor}; padding: 20px; color: white;">
            <h2>🚨 ${d.title}</h2>
          </div>
          <div style="padding: 20px; background-color: #f5f5f5;">
            <p style="font-size: 16px; line-height: 1.5;">${d.message}</p>
            <p style="margin-top: 20px;">
              <strong>Prioridade:</strong> ${d.priority}
            </p>
          </div>
          <div style="padding: 20px; text-align: center; color: #666;">
            <p>MercadoFlow Intelligence Platform</p>
          </div>
        </div>
      `,

      welcome: (d) => `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #4CAF50; padding: 20px; color: white;">
            <h2>Bem-vindo ao MercadoFlow! 🎉</h2>
          </div>
          <div style="padding: 20px;">
            <p>Olá ${d.name},</p>
            <p>Sua conta foi criada com sucesso. Agora você pode acessar nossa plataforma de intelligence para supermercados.</p>
            <p style="margin-top: 20px;">
              <a href="${config.get('FRONTEND_URL', 'http://localhost:3001')}"
                 style="background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
                Acessar Plataforma
              </a>
            </p>
          </div>
        </div>
      `,

      'password-reset': (d) => `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #2196F3; padding: 20px; color: white;">
            <h2>Redefinir Senha 🔐</h2>
          </div>
          <div style="padding: 20px;">
            <p>Você solicitou a redefinição de sua senha.</p>
            <p>Clique no botão abaixo para criar uma nova senha:</p>
            <p style="margin-top: 20px;">
              <a href="${d.resetLink}"
                 style="background-color: #2196F3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
                Redefinir Senha
              </a>
            </p>
            <p style="color: #666; margin-top: 20px;">Este link expira em ${d.expiresIn}.</p>
            <p style="color: #666;">Se você não solicitou esta alteração, ignore este email.</p>
          </div>
        </div>
      `,

      'daily-report': (d) => `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #FF9800; padding: 20px; color: white;">
            <h2>Relatório Diário - ${d.marketName} 📊</h2>
          </div>
          <div style="padding: 20px;">
            <h3>Resumo do Dia</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Vendas Totais:</strong></td>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;">R$ ${d.totalSales?.toFixed(2) || '0.00'}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Transações:</strong></td>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;">${d.totalTransactions || 0}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Ticket Médio:</strong></td>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;">R$ ${d.avgTicket?.toFixed(2) || '0.00'}</td>
              </tr>
            </table>
          </div>
        </div>
      `,
    };

    const renderer = templates[template];
    if (!renderer) {
      logger.warn('Unknown email template', { template });
      return `<p>${JSON.stringify(data)}</p>`;
    }

    return renderer(data || {});
  }

  /**
   * Get color for alert priority
   */
  private getPriorityColor(priority: string): string {
    const colors: Record<string, string> = {
      URGENT: '#D32F2F',
      HIGH: '#F57C00',
      MEDIUM: '#FBC02D',
      LOW: '#388E3C',
    };

    return colors[priority] || colors.MEDIUM;
  }

  /**
   * Test email configuration
   */
  async testConnection(): Promise<boolean> {
    if (!this.enabled || !this.transporter) {
      return false;
    }

    try {
      await this.transporter.verify();
      logger.info('Email connection test successful');
      return true;
    } catch (error) {
      logger.error('Email connection test failed', { error });
      return false;
    }
  }
}

export const emailService = new EmailService();
