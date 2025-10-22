// backend/src/services/qrcode.ts
import QRCode from 'qrcode';

/**
 * Make a PNG buffer for a QR code.
 * @param data - string to encode
 * @param width - pixel width of PNG (default 512)
 */
export async function qrPngBuffer(data: string, width = 512): Promise<Buffer> {
  const buf = await QRCode.toBuffer(data, {
    type: 'png',
    width,
    margin: 1,
    errorCorrectionLevel: 'M',
  });
  return buf;
}
