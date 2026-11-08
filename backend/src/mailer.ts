import nodemailer from "nodemailer";

const gmailConfigured = Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);

const transporter = gmailConfigured
  ? nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    })
  : null;

const send = async (options: nodemailer.SendMailOptions) => {
  if (!transporter) {
    console.log(
      `[mailer] Gmail is not configured, the e-mail is printed instead of sent.\n` +
      `To: ${options.to}\nSubject: ${options.subject}\n\n${options.text}\n`
    );
    return;
  }
  await transporter.sendMail(options);
};

export const sendCodeEmail = async (to: string, code: string, purpose: string) => {
  await send({
    from: `"BoardKeeper" <${process.env.GMAIL_USER}>`,
    to,
    subject: `Your BoardKeeper ${purpose} code`,
    text: `Your ${purpose} code is: ${code}\n\nThis code expires in 10 minutes.`,
    html: `<p>Your ${purpose} code is:</p><h2 style="letter-spacing:4px;">${code}</h2><p>This code expires in 10 minutes.</p>`,
  });
};

export const sendReservationEmail = async (to: string, firstName: string, gameTitle: string, copyNumber: string, reservedUntil: string) => {
  await send({
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

export const sendApprovalEmail = async (to: string, role: string) => {
  await send({
    from: `"BoardKeeper" <${process.env.GMAIL_USER}>`,
    to,
    subject: "Your BoardKeeper account has been approved",
    text: `Your BoardKeeper account has been approved with the "${role}" role. You can now log in.\n\nThis is an automated email. Please do not reply.`,
    html: `
      <p>Your BoardKeeper account has been approved with the <strong>${role}</strong> role.</p>
      <p>You can now log in.</p>
      <p>This is an automated email. Please do not reply.</p>
    `,
  });
};