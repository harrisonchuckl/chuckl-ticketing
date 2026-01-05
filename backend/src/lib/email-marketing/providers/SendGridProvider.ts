import type { IEmailProvider, SendEmailRequest, SendEmailResult } from './IEmailProvider.js';

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || '';
const SENDGRID_ENDPOINT = 'https://api.sendgrid.com/v3/mail/send';

export class SendGridProvider implements IEmailProvider {
  async sendEmail(request: SendEmailRequest): Promise<SendEmailResult> {
    if (!SENDGRID_API_KEY) {
      throw new Error('SendGrid not configured. Set SENDGRID_API_KEY.');
    }

    const payload = {
      personalizations: [
        {
          to: [{ email: request.to }],
          custom_args: request.customArgs || undefined,
        },
      ],
      from: {
        email: request.fromEmail,
        name: request.fromName,
      },
      reply_to: request.replyTo ? { email: request.replyTo } : undefined,
      subject: request.subject,
      content: [{ type: 'text/html', value: request.html }],
      headers: request.headers || undefined,
    };

    const res = await fetch(SENDGRID_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseText = await res.text();
    if (!res.ok) {
      throw new Error(`SendGrid error: ${res.status} ${responseText}`);
    }

    const messageId = res.headers.get('x-message-id') || 'sendgrid:ok';
    return { id: messageId, status: res.status, response: responseText || null };
  }
}
