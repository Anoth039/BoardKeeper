import nodemailer from "nodemailer";

export const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export const sendVerificationCodeEmail = async (to: string, code: string) => {
  await transporter.sendMail({
    from: `"BoardKeeper" <${process.env.GMAIL_USER}>`,
    to,
    subject: "Your BoardKeeper registration code",
    text: `Your registration verification code is: ${code}\n\nThis code expires in 10 minutes.`,
    html: `<p>Your registration verification code is:</p><h2 style="letter-spacing:4px;">${code}</h2><p>This code expires in 10 minutes.</p>`,
  });
};

export const sendReservationEmail = async (to: string, firstName: string, gameTitle: string, copyNumber: string, reservedUntil: string) => {
  await transporter.sendMail({
    from: `"BoardKeeper" <${process.env.GMAIL_USER}>`,
    to,
    subject: `Reservation Confirmed: ${gameTitle}`,
    text: `Hi ${firstName},\n\nYour reservation for "${gameTitle}" (Copy #${copyNumber}) is confirmed.\n\nIt will be held for you until the end of the day on ${reservedUntil}. Please pick it up before closing, or your reservation will automatically be canceled.\n\n*** This is an automated email. Please do not reply to this message. ***`,
    html: `
      <div style="font-family: sans-serif; line-height: 1.5; color: #333;">
        <p>Hi ${firstName},</p>
        <p>Your reservation for <strong>${gameTitle}</strong> (Copy #${copyNumber}) is confirmed!</p>
        <p>It will be held for you until <strong>the end of the day on ${reservedUntil}</strong>. Please pick it up before closing, or your reservation will automatically be released.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="font-size: 12px; color: #777;"><em>This is an automated message. Please do not reply directly to this email.</em></p>
      </div>
    `,
  });
};

export const sendResetCodeEmail = async (to: string, code: string) => {
  await transporter.sendMail({
    from: `"BoardKeeper" <${process.env.GMAIL_USER}>`,
    to,
    subject: "Your BoardKeeper password reset code",
    text: `Your password reset code is: ${code}\n\nThis code expires in 10 minutes.`,
    html: `<p>Your password reset code is:</p><h2 style="letter-spacing:4px;">${code}</h2><p>This code expires in 10 minutes.</p>`,
  });
};