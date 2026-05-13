import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from concurrent.futures import ThreadPoolExecutor

_executor = ThreadPoolExecutor(max_workers=2)


def _send_sync(to: str, subject: str, html: str):
    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_pass = os.getenv("SMTP_PASS", "")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f'"{os.getenv("NEXT_PUBLIC_APP_NAME", "Pocket")}" <{smtp_user}>'
    msg["To"] = to
    msg.attach(MIMEText(html, "html"))

    with smtplib.SMTP(smtp_host, smtp_port) as server:
        server.ehlo()
        server.starttls()
        server.login(smtp_user, smtp_pass)
        server.sendmail(smtp_user, to, msg.as_string())


async def send_group_invite_email(
    to: str,
    inviter_name: str,
    group_name: str,
    accept_url: str,
):
    import asyncio
    app_name = os.getenv("NEXT_PUBLIC_APP_NAME", "Pocket")
    app_url = os.getenv("NEXT_PUBLIC_APP_URL", "http://localhost:3000")

    html = f"""
    <!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
    <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
    </head>
    <body style="margin:0;padding:0;background:#0d1117;font-family:system-ui,sans-serif;color:#e6edf3;">
    <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
      <tr><td align="center">
        <table width="560" cellpadding="0" cellspacing="0"
          style="background:#161b22;border:1px solid #30363d;border-radius:12px;overflow:hidden;">
          <tr><td style="background:#10b981;padding:24px 32px;">
            <span style="color:#064e3b;font-weight:700;font-size:18px;">{app_name}</span>
          </td></tr>
          <tr><td style="padding:32px;">
            <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;">You're invited!</h2>
            <p style="margin:0 0 24px;color:#8b949e;font-size:15px;line-height:1.6;">
              <strong style="color:#e6edf3;">{inviter_name}</strong> invited you to join
              <strong style="color:#e6edf3;">{group_name}</strong> on {app_name}.
            </p>
            <a href="{accept_url}"
               style="display:inline-block;background:#10b981;color:#064e3b;font-weight:600;
                      font-size:15px;padding:12px 24px;border-radius:8px;text-decoration:none;">
              Accept Invitation →
            </a>
            <p style="margin:24px 0 0;color:#6e7681;font-size:12px;">
              This link expires in 7 days.<br/>
              URL: <a href="{accept_url}" style="color:#58a6ff;">{accept_url}</a>
            </p>
          </td></tr>
          <tr><td style="border-top:1px solid #30363d;padding:16px 32px;">
            <p style="margin:0;color:#6e7681;font-size:12px;">© {app_name} · <a href="{app_url}" style="color:#58a6ff;">{app_url}</a></p>
          </td></tr>
        </table>
      </td></tr>
    </table>
    </body></html>
    """

    subject = f'{inviter_name} invited you to join "{group_name}" on {app_name}'
    loop = asyncio.get_event_loop()
    try:
        await loop.run_in_executor(_executor, _send_sync, to, subject, html)
    except Exception as e:
        print(f"[email error] {e}")
