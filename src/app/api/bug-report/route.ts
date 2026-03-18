import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { Resend } from 'resend'

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const resend = new Resend(process.env.RESEND_API_KEY)

const TYPE_LABELS: Record<string, string> = {
  crash: '🔴 Something crashed',
  ui: '🟡 Something looks wrong',
  feature: '🔵 Feature not working',
  other: '⚪ Other',
}

interface BreadcrumbEntry {
  action: string
  page?: string
  timestamp?: string
}

interface DeviceInfo {
  platform?: string
  userAgent?: string
  screenWidth?: number
  screenHeight?: number
  language?: string
  online?: boolean
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const {
      type,
      message,
      currentPage,
      breadcrumb,
      deviceInfo,
      screenshotBase64,
    } = body as {
      type: string
      message?: string
      currentPage?: string
      breadcrumb?: BreadcrumbEntry[]
      deviceInfo?: DeviceInfo
      screenshotBase64?: string
    }

    let screenshotUrl: string | null = null
    if (screenshotBase64) {
      try {
        const base64Data = screenshotBase64.replace(/^data:image\/\w+;base64,/, '')
        const buffer = Buffer.from(base64Data, 'base64')
        const fileName = `bug-reports/${user.id}/${Date.now()}.png`

        const { error: upErr } = await supabaseAdmin.storage
          .from('avatars')
          .upload(fileName, buffer, {
            contentType: 'image/png',
            upsert: false,
          })

        if (!upErr) {
          const { data: { publicUrl } } = supabaseAdmin.storage
            .from('avatars')
            .getPublicUrl(fileName)
          screenshotUrl = publicUrl
        }
      } catch (e) {
        console.error('Screenshot upload failed:', e)
      }
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('full_name, role, account_type, company:companies(name, plan)')
      .eq('id', user.id)
      .single()

    const company = profile?.company as { name?: string; plan?: string } | null

    const { data: report } = await supabaseAdmin
      .from('bug_reports')
      .insert({
        user_id: user.id,
        type,
        message: message || null,
        current_page: currentPage,
        breadcrumb: breadcrumb || [],
        device_info: deviceInfo || {},
        screenshot_url: screenshotUrl,
      })
      .select('id')
      .single()

    const crumbLines = (breadcrumb || [])
      .slice(-5)
      .reverse()
      .map((c: BreadcrumbEntry, i: number) =>
        i === 0
          ? `→ <strong>[bug reported here]</strong>`
          : `→ ${c.action}${c.page ? ` <span style="color:#9B9BA8">(${c.page})</span>` : ''}`
      )
      .join('<br/>')

    const html = `
<div style="font-family:-apple-system,sans-serif;max-width:580px;margin:0 auto;
  padding:32px 24px;background:#F8F7F4;border-radius:16px;">

  <!-- Header -->
  <div style="background:#1A1A2E;border-radius:16px;padding:20px 24px;
    margin-bottom:24px;display:flex;align-items:center;gap:12px;">
    <div style="width:40px;height:40px;background:#9A88FD;border-radius:12px;
      display:flex;align-items:center;justify-content:center;">
      <span style="font-size:20px;">🐛</span>
    </div>
    <div>
      <div style="font-size:18px;font-weight:800;color:white;">
        Bug Report — Snagify
      </div>
      <div style="font-size:12px;color:rgba(255,255,255,0.5);margin-top:2px;">
        ${new Date().toLocaleDateString('en-AE', {
          day: 'numeric', month: 'long', year: 'numeric',
          hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dubai'
        })} · Dubai
      </div>
    </div>
  </div>

  <!-- Type badge -->
  <div style="margin-bottom:20px;">
    <span style="display:inline-block;background:#EDE9FF;color:#6B4FE8;
      font-size:14px;font-weight:700;padding:8px 16px;border-radius:20px;">
      ${TYPE_LABELS[type] || type}
    </span>
  </div>

  <!-- User info -->
  <div style="background:white;border-radius:14px;padding:16px;
    margin-bottom:16px;border:1px solid #EEECFF;">
    <div style="font-size:11px;font-weight:700;color:#9B9BA8;
      text-transform:uppercase;letter-spacing:0.6px;margin-bottom:12px;">
      Reporter
    </div>
    <table style="width:100%;font-size:13px;border-collapse:collapse;">
      <tr>
        <td style="color:#9B9BA8;padding:4px 0;">Name</td>
        <td style="color:#1A1A2E;font-weight:600;text-align:right;">
          ${profile?.full_name || 'Unknown'}
        </td>
      </tr>
      <tr>
        <td style="color:#9B9BA8;padding:4px 0;">Email</td>
        <td style="text-align:right;">
          <a href="mailto:${user.email}" style="color:#9A88FD;">
            ${user.email}
          </a>
        </td>
      </tr>
      <tr>
        <td style="color:#9B9BA8;padding:4px 0;">Role</td>
        <td style="color:#1A1A2E;font-weight:600;text-align:right;
          text-transform:capitalize;">
          ${profile?.role || '—'} · ${profile?.account_type || '—'}
        </td>
      </tr>
      <tr>
        <td style="color:#9B9BA8;padding:4px 0;">Agency</td>
        <td style="color:#1A1A2E;font-weight:600;text-align:right;">
          ${company?.name || '—'} (${company?.plan || 'free'})
        </td>
      </tr>
      <tr>
        <td style="color:#9B9BA8;padding:4px 0;">Page</td>
        <td style="color:#1A1A2E;font-weight:600;text-align:right;
          font-family:monospace;font-size:12px;">
          ${currentPage || '—'}
        </td>
      </tr>
    </table>
  </div>

  <!-- Device info -->
  <div style="background:white;border-radius:14px;padding:16px;
    margin-bottom:16px;border:1px solid #EEECFF;">
    <div style="font-size:11px;font-weight:700;color:#9B9BA8;
      text-transform:uppercase;letter-spacing:0.6px;margin-bottom:12px;">
      Device
    </div>
    <table style="width:100%;font-size:13px;border-collapse:collapse;">
      <tr>
        <td style="color:#9B9BA8;padding:4px 0;">Platform</td>
        <td style="color:#1A1A2E;font-weight:600;text-align:right;">
          ${deviceInfo?.platform || '—'}
        </td>
      </tr>
      <tr>
        <td style="color:#9B9BA8;padding:4px 0;">User agent</td>
        <td style="color:#1A1A2E;font-weight:600;text-align:right;
          font-size:11px;max-width:200px;word-break:break-all;">
          ${deviceInfo?.userAgent?.slice(0, 80) || '—'}
        </td>
      </tr>
      <tr>
        <td style="color:#9B9BA8;padding:4px 0;">Screen</td>
        <td style="color:#1A1A2E;font-weight:600;text-align:right;">
          ${deviceInfo?.screenWidth || '?'}×${deviceInfo?.screenHeight || '?'}
        </td>
      </tr>
      <tr>
        <td style="color:#9B9BA8;padding:4px 0;">Language</td>
        <td style="color:#1A1A2E;font-weight:600;text-align:right;">
          ${deviceInfo?.language || '—'}
        </td>
      </tr>
    </table>
  </div>

  ${message ? `
  <!-- Message -->
  <div style="background:white;border-radius:14px;padding:16px;
    margin-bottom:16px;border:1px solid #EEECFF;">
    <div style="font-size:11px;font-weight:700;color:#9B9BA8;
      text-transform:uppercase;letter-spacing:0.6px;margin-bottom:10px;">
      Message
    </div>
    <p style="font-size:14px;color:#1A1A2E;line-height:1.6;margin:0;">
      "${message}"
    </p>
  </div>` : ''}

  ${crumbLines ? `
  <!-- Breadcrumb -->
  <div style="background:white;border-radius:14px;padding:16px;
    margin-bottom:16px;border:1px solid #EEECFF;">
    <div style="font-size:11px;font-weight:700;color:#9B9BA8;
      text-transform:uppercase;letter-spacing:0.6px;margin-bottom:10px;">
      Last actions
    </div>
    <div style="font-size:13px;color:#1A1A2E;line-height:2;">
      ${crumbLines}
    </div>
  </div>` : ''}

  ${screenshotUrl ? `
  <!-- Screenshot -->
  <div style="background:white;border-radius:14px;padding:16px;
    margin-bottom:16px;border:1px solid #EEECFF;">
    <div style="font-size:11px;font-weight:700;color:#9B9BA8;
      text-transform:uppercase;letter-spacing:0.6px;margin-bottom:10px;">
      Screenshot
    </div>
    <img src="${screenshotUrl}" alt="screenshot"
      style="width:100%;border-radius:10px;border:1px solid #EEECFF;" />
  </div>` : ''}

  <!-- Report ID -->
  <div style="text-align:center;font-size:11px;color:#C4C4C4;margin-top:16px;">
    Report ID: ${report?.id || 'N/A'} · Snagify Bug Tracker
  </div>
</div>`

    await resend.emails.send({
      from: 'Snagify Bugs <noreply@snagify.net>',
      to: 'contact@snagify.net',
      replyTo: user.email || undefined,
      subject: `[Bug] ${TYPE_LABELS[type] || type} — ${profile?.full_name || user.email}`,
      html,
    })

    return NextResponse.json({ success: true, reportId: report?.id })
  } catch (err) {
    console.error('Bug report error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
