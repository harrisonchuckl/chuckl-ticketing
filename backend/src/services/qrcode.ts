import QRCode from 'qrcode';
export async function makeTicketQR(data: string){ return await QRCode.toDataURL(data, { width: 320, margin: 1 }); }
