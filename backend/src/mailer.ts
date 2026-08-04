import nodemailer from "nodemailer";

export const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export const sendResetCodeEmail = async (to: string, code: string) => {
  await transporter.sendMail({
    from: `"BoardKeeper" <${process.env.GMAIL_USER}>`,
    to,
    subject: "Your BoardKeeper password reset code",
    text: `Your password reset code is: ${code}\n\nThis code expires in 10 minutes.`,
    html: `<p>Your password reset code is:</p><h2 style="letter-spacing:4px;">${code}</h2><p>This code expires in 10 minutes.</p>`,
  });
};