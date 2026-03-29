// src/lib/email/templates/base.ts
export function renderEmailShell(params: {
  title: string;
  preview?: string;
  bodyHtml: string;
}) {
  const { title, preview, bodyHtml } = params;

  return `
<!doctype html>
<html>
  <head>
    <meta charSet="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
      ${escapeHtml(preview || title)}
    </div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
            <tr>
              <td style="background:#0f172a;padding:20px 24px;">
                <div style="font-size:20px;font-weight:700;color:#ffffff;">UWI Study Space</div>
              </td>
            </tr>
            <tr>
              <td style="padding:24px;">
                <h1 style="margin:0 0 16px;font-size:24px;line-height:1.3;color:#0f172a;">
                  ${escapeHtml(title)}
                </h1>
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:0 24px 24px;color:#64748b;font-size:12px;line-height:1.6;">
                This is an automated message from UWI Study Space.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}