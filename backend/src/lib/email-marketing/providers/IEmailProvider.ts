export type MarketingEmailHeaders = Record<string, string>;

export type SendEmailRequest = {
  to: string;
  subject: string;
  html: string;
  fromName: string;
  fromEmail: string;
  replyTo?: string | null;
  headers?: MarketingEmailHeaders;
  customArgs?: Record<string, string>;
};

export type SendEmailResult = {
  id: string;
};

export interface IEmailProvider {
  sendEmail(request: SendEmailRequest): Promise<SendEmailResult>;
}
