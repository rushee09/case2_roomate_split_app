import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendGroupInviteEmail({
  to,
  inviterName,
  groupName,
  acceptUrl,
}: {
  to: string;
  inviterName: string;
  groupName: string;
  acceptUrl: string;
}) {
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "Pocket";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  await transporter.sendMail({
    from: `"${appName}" <${process.env.SMTP_USER}>`,
    to,
    subject: `${inviterName} invited you to join "${groupName}" on ${appName}`,
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Group Invite</title>
      </head>
      <body style="margin:0;padding:0;background:#0d1117;font-family:system-ui,sans-serif;color:#e6edf3;">
        <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
          <tr><td align="center">
            <table width="560" cellpadding="0" cellspacing="0"
              style="background:#161b22;border:1px solid #30363d;border-radius:12px;overflow:hidden;">
              <!-- Header -->
              <tr>
                <td style="background:#10b981;padding:24px 32px;">
                  <table cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="background:#064e3b;border-radius:8px;width:36px;height:36px;text-align:center;
                                 vertical-align:middle;">
                        <span style="color:#10b981;font-weight:700;font-size:16px;">P</span>
                      </td>
                      <td style="padding-left:12px;">
                        <span style="color:#064e3b;font-weight:700;font-size:18px;">${appName}</span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <!-- Body -->
              <tr>
                <td style="padding:32px;">
                  <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;">You're invited!</h2>
                  <p style="margin:0 0 24px;color:#8b949e;font-size:15px;line-height:1.6;">
                    <strong style="color:#e6edf3;">${inviterName}</strong> invited you to join the expense
                    group <strong style="color:#e6edf3;">${groupName}</strong> on ${appName}.
                  </p>
                  <a href="${acceptUrl}"
                     style="display:inline-block;background:#10b981;color:#064e3b;font-weight:600;
                            font-size:15px;padding:12px 24px;border-radius:8px;text-decoration:none;">
                    Accept Invitation →
                  </a>
                  <p style="margin:24px 0 0;color:#6e7681;font-size:12px;">
                    This link expires in 7 days. If you didn't expect this invite, you can ignore this email.
                    <br/>
                    Or paste this URL: <a href="${acceptUrl}" style="color:#58a6ff;">${acceptUrl}</a>
                  </p>
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td style="border-top:1px solid #30363d;padding:16px 32px;">
                  <p style="margin:0;color:#6e7681;font-size:12px;">
                    © ${new Date().getFullYear()} ${appName} · <a href="${appUrl}" style="color:#58a6ff;">${appUrl}</a>
                  </p>
                </td>
              </tr>
            </table>
          </td></tr>
        </table>
      </body>
      </html>
    `,
  });
}
