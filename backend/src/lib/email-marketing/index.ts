import { SendGridProvider } from './providers/SendGridProvider.js';
import type { IEmailProvider } from './providers/IEmailProvider.js';

export function getEmailProvider(): IEmailProvider {
  return new SendGridProvider();
}
