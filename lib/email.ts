import nodemailer from 'nodemailer'

function createMailgridTransporter() {
  const host = process.env.MAILGRID_SMTP_HOST
  const user = process.env.MAILGRID_SMTP_USER
  const pass = process.env.MAILGRID_SMTP_PASS

  if (!host || !user || !pass) {
    throw new Error(
      'Variáveis de ambiente do Mailgrid ausentes: MAILGRID_SMTP_HOST, MAILGRID_SMTP_USER, MAILGRID_SMTP_PASS',
    )
  }

  return nodemailer.createTransport({
    host,
    port: 587,
    secure: false,
    auth: { user, pass },
  })
}

export interface SendEmailOptions {
  to: string | string[]
  subject: string
  html: string
  text?: string
  replyTo?: string
  from?: string
}

/**
 * Envia um e-mail via SMTP Mailgrid.
 * Usa variáveis de ambiente:
 *   MAILGRID_SMTP_HOST
 *   MAILGRID_SMTP_USER
 *   MAILGRID_SMTP_PASS
 *   MAILGRID_FROM_NAME  (nome remetente, opcional)
 *   MAILGRID_FROM_EMAIL (e-mail remetente, opcional — fallback para MAILGRID_SMTP_USER)
 */
export async function sendEmail(options: SendEmailOptions): Promise<void> {
  const transporter = createMailgridTransporter()

  const fromName = process.env.MAILGRID_FROM_NAME ?? 'Sistema'
  const fromEmail = process.env.MAILGRID_FROM_EMAIL ?? process.env.MAILGRID_SMTP_USER!
  const from = options.from ?? `"${fromName}" <${fromEmail}>`

  await transporter.sendMail({
    from,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
    ...(options.replyTo ? { replyTo: options.replyTo } : {}),
  })
}

/**
 * Envia e-mail de boas-vindas para novo cliente.
 */
export async function sendWelcomeEmail(params: {
  to: string
  customerName: string
  storeName?: string
}): Promise<void> {
  const store = params.storeName ?? 'Nossa Loja'
  await sendEmail({
    to: params.to,
    subject: `Bem-vindo(a) à ${store}, ${params.customerName}!`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <h2>Olá, ${params.customerName}!</h2>
        <p>Seu cadastro em <strong>${store}</strong> foi realizado com sucesso.</p>
        <p>Em breve nossa equipe entrará em contato.</p>
        <br/>
        <p style="color:#888;font-size:12px">Esta é uma mensagem automática, não responda a este e-mail.</p>
      </div>
    `,
  })
}

/**
 * Envia e-mail de confirmação de pedido.
 */
export async function sendOrderConfirmedEmail(params: {
  to: string
  customerName: string
  orderNumber: string | number
  orderValue: string
  storeName?: string
}): Promise<void> {
  const store = params.storeName ?? 'Nossa Loja'
  await sendEmail({
    to: params.to,
    subject: `Pedido #${params.orderNumber} confirmado — ${store}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <h2>Pedido confirmado! 🎉</h2>
        <p>Olá, <strong>${params.customerName}</strong>.</p>
        <p>Seu pedido <strong>#${params.orderNumber}</strong> foi confirmado com sucesso.</p>
        <table style="border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:4px 12px 4px 0;color:#666">Pedido:</td><td><strong>#${params.orderNumber}</strong></td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#666">Valor Total:</td><td><strong>${params.orderValue}</strong></td></tr>
        </table>
        <p>Acompanhe o andamento diretamente em nossa loja.</p>
        <br/>
        <p style="color:#888;font-size:12px">Esta é uma mensagem automática, não responda a este e-mail.</p>
      </div>
    `,
  })
}

/**
 * Envia e-mail com código de rastreio do pedido.
 */
export async function sendOrderShippedEmail(params: {
  to: string
  customerName: string
  orderNumber: string | number
  trackingCode: string
  storeName?: string
}): Promise<void> {
  const store = params.storeName ?? 'Nossa Loja'
  await sendEmail({
    to: params.to,
    subject: `Pedido #${params.orderNumber} enviado — ${store}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <h2>Seu pedido está a caminho! 📦</h2>
        <p>Olá, <strong>${params.customerName}</strong>.</p>
        <p>Seu pedido <strong>#${params.orderNumber}</strong> foi despachado.</p>
        <div style="background:#f4f4f4;border-radius:8px;padding:16px;margin:16px 0">
          <p style="margin:0;color:#666;font-size:13px">Código de Rastreio</p>
          <p style="margin:4px 0 0;font-size:18px;font-weight:bold;font-family:monospace">${params.trackingCode}</p>
        </div>
        <br/>
        <p style="color:#888;font-size:12px">Esta é uma mensagem automática, não responda a este e-mail.</p>
      </div>
    `,
  })
}

/**
 * Verifica se a configuração SMTP está presente nas variáveis de ambiente.
 */
export function isEmailConfigured(): boolean {
  return Boolean(
    process.env.MAILGRID_SMTP_HOST &&
    process.env.MAILGRID_SMTP_USER &&
    process.env.MAILGRID_SMTP_PASS,
  )
}
