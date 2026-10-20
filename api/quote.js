// api/quote.js - Handler for Quote Requests using Resend
// Compatible with Vercel Serverless Functions and Node.js dev server

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { name, email, phone, services, details, _hp } = req.body || {};

    // Silent drop for automated honeypot spam bots
    if (_hp) {
      return res.status(200).json({ ok: true });
    }

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'El nombre es obligatorio.' });
    }

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'El email proporcionado no es válido.' });
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error('RESEND_API_KEY missing from environment.');
      return res.status(500).json({ error: 'RESEND_API_KEY no configurada en el servidor.' });
    }

    // Default recipient is the Resend account owner (bazanlucas28@gmail.com)
    const toEmail = process.env.QUOTE_TO_EMAIL || 'bazanlucas28@gmail.com';
    const fromAddress = process.env.RESEND_FROM || 'Portfolio Cotizaciones <onboarding@resend.dev>';

    const servicesList = Array.isArray(services) && services.length > 0
      ? services.join(', ')
      : 'No especificado';

    const cleanName = name.trim();
    const cleanEmail = email.trim();
    const cleanPhone = phone ? phone.trim() : '';
    const cleanDetails = details ? details.trim() : '';

    const subject = `Nueva cotización: ${cleanName} - ${servicesList.slice(0, 60)}`;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #0f172a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden;">
    <tr>
      <td style="padding: 24px 28px; background: #090b10; color: #ffffff;">
        <h1 style="margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.02em;">Nueva solicitud de cotización</h1>
        <p style="margin: 6px 0 0 0; font-size: 13px; color: #94a3b8;">Recibida desde tu portfolio (lucasbazan.com)</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 28px;">
        <h2 style="margin: 0 0 12px 0; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b;">1. Datos del solicitante</h2>
        <table width="100%" cellpadding="6" cellspacing="0" style="font-size: 14px; margin-bottom: 24px;">
          <tr>
            <td width="140" style="color: #64748b;"><strong>Nombre / Empresa:</strong></td>
            <td style="color: #0f172a; font-weight: 600;">${escapeHtml(cleanName)}</td>
          </tr>
          <tr>
            <td style="color: #64748b;"><strong>Email:</strong></td>
            <td><a href="mailto:${escapeHtml(cleanEmail)}" style="color: #0284c7; text-decoration: none; font-weight: 600;">${escapeHtml(cleanEmail)}</a></td>
          </tr>
          <tr>
            <td style="color: #64748b;"><strong>Teléfono / WhatsApp:</strong></td>
            <td style="color: #0f172a;">${cleanPhone ? `<a href="https://wa.me/${cleanPhone.replace(/[^0-9]/g, '')}" style="color: #059669; text-decoration: none;">${escapeHtml(cleanPhone)}</a>` : '<span style="color: #94a3b8;">No especificado</span>'}</td>
          </tr>
        </table>

        <h2 style="margin: 0 0 12px 0; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b;">2. ¿Qué busca?</h2>
        <div style="padding: 12px 16px; background: #f1f5f9; border-radius: 8px; font-size: 14px; color: #0f172a; font-weight: 500; margin-bottom: 24px;">
          ${escapeHtml(servicesList)}
        </div>

        <h2 style="margin: 0 0 12px 0; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b;">3. Detalles del proyecto</h2>
        <div style="padding: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; line-height: 1.6; color: #334155; white-space: pre-wrap; margin-bottom: 24px;">
${cleanDetails ? escapeHtml(cleanDetails) : '<span style="color: #94a3b8; font-style: italic;">Sin comentarios adicionales proporcionados.</span>'}
        </div>

        <p style="margin: 0; font-size: 12px; color: #94a3b8; line-height: 1.5; border-top: 1px solid #f1f5f9; padding-top: 16px;">
          Podés hacer clic en <strong>Responder</strong> para responder directamente a <strong>${escapeHtml(cleanEmail)}</strong>.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();

    const textContent = `
NUEVA SOLICITUD DE COTIZACIÓN - PORTFOLIO LUCAS BAZAN
======================================================

1. DATOS DEL SOLICITANTE
------------------------
Nombre / Empresa: ${cleanName}
Email: ${cleanEmail}
Teléfono / WhatsApp: ${cleanPhone || 'No especificado'}

2. SERVICIOS DE INTERÉS
-----------------------
${servicesList}

3. DETALLES O COMENTARIOS
-------------------------
${cleanDetails || 'Sin comentarios adicionales.'}

======================================================
Responde a este correo para escribir directamente al solicitante.
    `.trim();

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [toEmail],
        reply_to: cleanEmail,
        subject: subject,
        html: htmlContent,
        text: textContent
      })
    });

    const data = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error('Error de Resend API:', data);
      return res.status(resendResponse.status).json({
        error: data.message || 'Error al enviar el email a través de Resend.'
      });
    }

    return res.status(200).json({ ok: true, id: data.id });
  } catch (error) {
    console.error('Quote handler unexpected exception:', error);
    return res.status(500).json({ error: 'Error interno del servidor al procesar la cotización.' });
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

