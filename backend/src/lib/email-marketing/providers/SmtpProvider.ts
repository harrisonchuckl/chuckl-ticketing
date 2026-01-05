import nodemailer from 'nodemailer';
import type { IEmailProvider, SendEmailRequest, SendEmailResult } from './IEmailProvider.js';

export type SmtpProviderConfig = {
  host: string;
  port: number;
  secure: boolean;
  authUser: string;
  authPass: string;
};

export class SmtpProvider implements IEmailProvider {
  private transporter;

  constructor(private config: SmtpProviderConfig) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.authUser,
        pass: config.authPass,
      },
    });
  }

  async sendEmail(request: SendEmailRequest): Promise<SendEmailResult> {
    const info = await this.transporter.sendMail({
      to: request.to,
      subject: request.subject,
      html: request.html,
      from: `${request.fromName} <${request.fromEmail}>`,
      replyTo: request.replyTo || undefined,
      headers: request.headers || undefined,
    });

    const messageId = info?.messageId || 'smtp:ok';
    return { id: messageId, status: 250, response: null };
  }
}
