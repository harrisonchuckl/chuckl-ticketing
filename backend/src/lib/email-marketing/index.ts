import { SendGridProvider } from './providers/SendGridProvider.js';
import { SmtpProvider } from './providers/SmtpProvider.js';
import type { IEmailProvider } from './providers/IEmailProvider.js';
import type { MarketingSettingsSnapshot } from '../../services/marketing/settings.js';
import { MarketingSenderMode } from '@prisma/client';
import { decryptToken } from '../token-crypto.js';

export function getEmailProvider(settings?: MarketingSettingsSnapshot | null): IEmailProvider {
  if (settings?.sendingMode === MarketingSenderMode.SMTP) {
    const host = String(settings.smtpHost || '').trim();
    const port = Number(settings.smtpPort || 587);
    const secure = settings.smtpSecure ?? port === 465;
    const userEncrypted = String(settings.smtpUserEncrypted || '').trim();
    const passEncrypted = String(settings.smtpPassEncrypted || '').trim();

    if (!host || !userEncrypted || !passEncrypted) {
      throw new Error('SMTP not configured for this organiser.');
    }

    const authUser = decryptToken(userEncrypted);
    const authPass = decryptToken(passEncrypted);
    return new SmtpProvider({
      host,
      port,
      secure,
      authUser,
      authPass,
    });
  }

  return new SendGridProvider();
}
