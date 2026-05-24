interface Env {
  RESEND_API_KEY: string;
}

const ALLOWED_ORIGINS = [
  'https://creativoatwork.com',
  'https://www.creativoatwork.com',
  'https://creativoatwork-54e65.web.app',
  'https://creativoatwork-54e65.firebaseapp.com',
];

const LOCALHOST_RE = /^http:\/\/(?:localhost|127\.0\.0\.1):\d+$/;

const MAIL_TO = 'hello@creativoatwork.com';
const MAIL_FROM = 'Creativo@Work <hello@creativoatwork.com>';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ContactPayload {
  name?: unknown;
  email?: unknown;
  message?: unknown;
  company?: unknown;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function validateString(value: unknown, min: number, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) return null;
  return trimmed;
}

function corsHeaders(origin: string | null): Record<string, string> {
  const allow =
    origin && (ALLOWED_ORIGINS.includes(origin) || LOCALHOST_RE.test(origin))
      ? origin
      : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function jsonResponse(body: unknown, status: number, extra: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extra },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin');
    const cors = corsHeaders(origin);
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    if (url.pathname !== '/contact') {
      return jsonResponse({ ok: false, error: 'not_found' }, 404, cors);
    }

    if (request.method !== 'POST') {
      return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405, cors);
    }

    let body: ContactPayload;
    try {
      body = (await request.json()) as ContactPayload;
    } catch {
      return jsonResponse({ ok: false, error: 'invalid_json' }, 400, cors);
    }

    if (typeof body.company === 'string' && body.company.trim().length > 0) {
      console.log('honeypot triggered');
      return jsonResponse({ ok: true }, 200, cors);
    }

    const name = validateString(body.name, 1, 100);
    const email = validateString(body.email, 5, 200);
    const message = validateString(body.message, 5, 5000);

    if (!name || !email || !message) {
      return jsonResponse({ ok: false, error: 'invalid_input' }, 400, cors);
    }

    if (!EMAIL_RE.test(email)) {
      return jsonResponse({ ok: false, error: 'invalid_email' }, 400, cors);
    }

    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safeMessage = escapeHtml(message);

    const html = `<!doctype html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1f2937;line-height:1.55;margin:0;padding:24px;">
  <div style="max-width:580px;margin:0 auto;">
    <p style="font-family:ui-monospace,Menlo,monospace;font-size:11px;letter-spacing:0.04em;text-transform:uppercase;color:#6b7280;margin:0 0 8px;">New brief · creativoatwork.com</p>
    <h1 style="font-size:22px;font-weight:500;letter-spacing:-0.02em;color:#111827;margin:0 0 24px;">${safeName}</h1>
    <table style="border-collapse:collapse;font-size:14px;margin-bottom:24px;">
      <tr><td style="padding:4px 16px 4px 0;color:#6b7280;">From</td><td style="padding:4px 0;"><a href="mailto:${safeEmail}" style="color:#1f2937;">${safeEmail}</a></td></tr>
    </table>
    <div style="white-space:pre-wrap;background:#f9fafb;padding:16px 20px;border-radius:8px;border:1px solid #e5e7eb;font-size:14px;line-height:1.6;">${safeMessage}</div>
    <p style="font-size:12px;color:#9ca3af;margin:24px 0 0;">Reply directly to this email to respond.</p>
  </div>
</body></html>`;

    const text = `New brief — creativoatwork.com\n\nFrom: ${name} <${email}>\n\n${message}\n\n— Reply directly to this email to respond.`;

    try {
      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: MAIL_FROM,
          to: [MAIL_TO],
          reply_to: email,
          subject: `New brief from ${name}`,
          html,
          text,
        }),
      });

      if (!resendRes.ok) {
        const errBody = await resendRes.text();
        console.error('Resend error', resendRes.status, errBody);
        return jsonResponse({ ok: false, error: 'send_failed' }, 502, cors);
      }

      return jsonResponse({ ok: true }, 200, cors);
    } catch (err) {
      console.error('Worker error', err);
      return jsonResponse({ ok: false, error: 'internal_error' }, 500, cors);
    }
  },
} satisfies ExportedHandler<Env>;
