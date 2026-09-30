import nodemailer from "nodemailer";

export const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export const sendCodeEmail = async (to: string, code: string, purpose: string) => {
  await transporter.sendMail({
    from: `"BoardKeeper" <${process.env.GMAIL_USER}>`,
    to,
    subject: `Your BoardKeeper ${purpose} code`,
    text: `Your ${purpose} code is: ${code}\n\nThis code expires in 10 minutes.`,
    html: `<p>Your ${purpose} code is:</p><h2 style="letter-spacing:4px;">${code}</h2><p>This code expires in 10 minutes.</p>`,
  });
};

export const sendReservationEmail = async (to: string, firstName: string, gameTitle: string, copyNumber: string, reservedUntil: string) => {
  await transporter.sendMail({
    from: `"BoardKeeper" <${process.env.GMAIL_USER}>`,
    to,
    subject: `Reservation Confirmed: ${gameTitle}`,
    text: `Hi ${firstName},\n\nYour reservation for "${gameTitle}" (Copy #${copyNumber}) is confirmed.\nIt will be held until the end of the day on ${reservedUntil}.\n\nThis is an automated email. Please do not reply.`,
    html: `
      <p>Hi ${firstName},</p>
      <p>Your reservation for <strong>${gameTitle}</strong> (Copy #${copyNumber}) is confirmed.</p>
      <p>It will be held until <strong>the end of the day on ${reservedUntil}</strong>.</p>
      <p>This is an automated email. Please do not reply.</p>
    `,
  });
};