Step 1 — Make sure the build has all email/QR/PDF deps

Run these once locally in your backend folder (so Railway will install them on the next deploy):

cd backend
npm i qrcode pdfkit nodemailer bcryptjs resend
npm i -D @types/pdfkit


Add a tiny type shim so TypeScript stops warning about qrcode (there’s no official @types for it):

backend/src/types/qrcode.d.ts
declare module 'qrcode' {
  const QRCode: any;
  export default QRCode;
}


Commit & push:

git add backend/package*.json backend/src/types/qrcode.d.ts
git commit -m "deps: qrcode/pdfkit/nodemailer/resend + qrcode type shim"
git push


Watch Railway → it should build cleanly and say “API running on port 4000”.
