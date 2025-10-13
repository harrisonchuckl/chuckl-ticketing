import nodemailer from 'nodemailer';
const from = process.env.EMAIL_FROM || '"Chuckl" <tickets@chuckl.club>';
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'localhost',
  port: Number(process.env.SMTP_PORT || 1025),
  secure: false,
  auth: (process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined),
});
export async function sendEmail(to: string, subject: string, html: string, attachments: any[] = []){
  return transporter.sendMail({ from, to, subject, html, attachments });
}