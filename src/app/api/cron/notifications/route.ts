import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { sendPushNotification } from '@/lib/push';
import {
  notifyOpenedNotSigned,
  notifyExpiringSignatures,
} from '@/lib/pushSignatureNotifications';
import { formatPropertyBuildingUnit } from '@/lib/formatPropertyAddress';

export const runtime = 'nodejs';
export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const resend = new Resend(process.env.RESEND_API_KEY);

async function sendToUser(
  userId: string,
  payload: { title: string; body: string; url?: string; type?: string }
) {
  await supabase
    .from('notifications')
    .insert({
      user_id: userId,
      title: payload.title,
      body: payload.body,
      url: payload.url ?? null,
      type: payload.type ?? 'general',
    });

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', userId);

  if (!subs?.length) return;

  const results = await Promise.allSettled(
    subs.map((sub) => sendPushNotification(sub, payload))
  );

  const expired = results
    .map((r, i) =>
      r.status === 'fulfilled' && (r.value as { expired?: boolean }).expired
        ? subs[i].endpoint
        : null
    )
    .filter(Boolean) as string[];

  if (expired.length > 0) {
    await supabase
      .from('push_subscriptions')
      .delete()
      .in('endpoint', expired);
  }
}

async function notifyLeaseExpiry() {
  const today = new Date();

  const from30 = new Date(today);
  from30.setDate(today.getDate() + 29);
  const to30 = new Date(today);
  to30.setDate(today.getDate() + 31);

  const { data: tenancies, error } = await supabase
    .from('tenancies')
    .select(`
      id,
      agent_id,
      tenant_name,
      contract_to,
      properties (building_name, unit_number, location)
    `)
    .gte('contract_to', from30.toISOString().split('T')[0])
    .lte('contract_to', to30.toISOString().split('T')[0])
    .eq('status', 'active');

  if (error) {
    console.error('[Cron] lease expiry query error:', error);
    return;
  }

  const filteredTenancies: NonNullable<typeof tenancies> = [];
  for (const tenancy of tenancies ?? []) {
    const agentId = (tenancy as { agent_id?: string }).agent_id;
    if (!agentId) continue;
    const tenancyId = (tenancy as { id: string }).id;

    const fiveDaysAgo = new Date(today);
    fiveDaysAgo.setDate(today.getDate() - 5);
    const { data: existing } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', agentId)
      .eq('type', 'lease')
      .ilike('body', `%${tenancyId}%`)
      .gte('created_at', fiveDaysAgo.toISOString())
      .maybeSingle();

    if (!existing) {
      filteredTenancies.push(tenancy);
    }
  }

  console.log(
    `[Cron] Lease expiry: ${filteredTenancies.length} tenancies (after dedup, ${tenancies?.length ?? 0} in window)`
  );

  for (const tenancy of filteredTenancies) {
    const prop = (tenancy as { properties?: { building_name?: string; unit_number?: string; location?: string } }).properties;
    const propLabel = formatPropertyBuildingUnit(prop ?? null);
    const placeLabel = propLabel !== '—' ? propLabel : 'your property';
    const tenantName = (tenancy as { tenant_name?: string }).tenant_name || 'Your tenant';
    const agentId = (tenancy as { agent_id?: string }).agent_id;
    const contractTo = (tenancy as { contract_to?: string }).contract_to;

    if (agentId) {
      await sendToUser(agentId, {
        title: 'Lease Expiring in 30 Days',
        body: `${tenantName}'s lease at ${placeLabel} ends on ${contractTo}. Time to schedule a check-out inspection. [ref:${(tenancy as { id: string }).id}]`,
        url: '/properties',
        type: 'lease',
      });
    }
  }
}

async function notifyInactivity() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: subscribers } = await supabase
    .from('push_subscriptions')
    .select('user_id');

  if (!subscribers?.length) return;

  const userIds = Array.from(new Set(subscribers.map((s) => s.user_id)));

  for (const userId of userIds) {
    const { data: recentInspections } = await supabase
      .from('inspections')
      .select('id')
      .eq('agent_id', userId)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .limit(1);

    if (!recentInspections?.length) {
      const { data: properties } = await supabase
        .from('properties')
        .select('id')
        .eq('agent_id', userId)
        .limit(1);

      if (properties?.length) {
        await sendToUser(userId, {
          title: 'Stay on top of your portfolio',
          body: "You haven't conducted any inspection in 30 days. Keep your records up to date.",
          url: '/properties',
          type: 'general',
        });
      }
    }
  }

  console.log(`[Cron] Inactivity check done for ${userIds.length} subscribers`);
}

async function sendReminder24h() {
  try {
    const now = new Date();
    const threshold = new Date(now.getTime() - 20 * 60 * 60 * 1000).toISOString();

    const { data: sigs } = await supabase
      .from('signatures')
      .select(`
        id, email, signer_name, signer_type, sign_url, refuse_token,
        inspection_id, expires_at,
        inspections:inspection_id (
          agent_id,
          type, created_at,
          properties:property_id (building_name, unit_number, location),
          agent:agent_id (
            company:companies (name, logo_url, primary_color)
          )
        )
      `)
      .eq('signing_mode', 'remote')
      .is('signed_at', null)
      .is('refused_at', null)
      .is('reminder_24h_sent_at', null)
      .lt('created_at', threshold);

    console.log(`[Cron] Reminder 24h: ${sigs?.length ?? 0} signatures`);

    for (const sig of sigs ?? []) {
      if (!sig.email || !sig.sign_url) continue;

      const insp = (Array.isArray(sig.inspections) ? sig.inspections[0] : sig.inspections) as {
        agent_id?: string | null
        type?: string
        created_at?: string
        properties?:
          | { building_name?: string; unit_number?: string; location?: string }
          | { building_name?: string; unit_number?: string; location?: string }[]
        agent?:
          | { company?: { name?: string; logo_url?: string; primary_color?: string } | { name?: string; logo_url?: string; primary_color?: string }[] }
          | { company?: { name?: string; logo_url?: string; primary_color?: string } | { name?: string; logo_url?: string; primary_color?: string }[] }[]
      } | null
      const prop = Array.isArray(insp?.properties) ? insp.properties[0] : insp?.properties;
      const agentRaw = Array.isArray(insp?.agent) ? insp.agent[0] : insp?.agent;
      const company = Array.isArray(agentRaw?.company) ? agentRaw.company[0] : agentRaw?.company;

      const agencyName = company?.name || 'Snagify';
      const primaryColor = company?.primary_color || '#9A88FD';
      const agencyLogo = company?.logo_url;
      const propLabel = formatPropertyBuildingUnit(prop ?? null);
      const propertyAddress = propLabel !== '—' ? propLabel : 'the property';
      const expiresDate = sig.expires_at
        ? new Date(sig.expires_at).toLocaleDateString('en-AE', {
            day: 'numeric', month: 'long', year: 'numeric',
          })
        : '7 days from now';

      const agencyHeader = agencyLogo
        ? `<img src="${agencyLogo}" alt="${agencyName}" style="height:44px;border-radius:10px;object-fit:contain;" />`
        : `<div style="font-size:18px;font-weight:800;color:white;">${agencyName}</div>`;

      await resend.emails.send({
        from: `${agencyName} <noreply@snagify.net>`,
        to: sig.email,
        subject: `Reminder: Your signature is needed — ${propertyAddress}`,
        html: `
          <div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">

            <div style="background:${primaryColor};border-radius:16px;padding:20px 24px;margin-bottom:24px;">
              ${agencyHeader}
            </div>

            <h2 style="font-size:20px;font-weight:800;color:#1A1A2E;margin:0 0 8px;">
              Your signature is still needed
            </h2>
            <p style="font-size:14px;color:#6B7280;margin:0 0 24px;line-height:1.6;">
              Hi ${sig.signer_name || 'there'}, this is a friendly reminder that the inspection
              report for <strong style="color:#1A1A2E;">${propertyAddress}</strong> is awaiting
              your signature.
            </p>

            <div style="background:#FEF3C7;border-radius:12px;padding:16px 20px;margin-bottom:24px;
              border-left:4px solid #F59E0B;">
              <div style="font-size:13px;font-weight:700;color:#92400E;margin-bottom:6px;">
                ⏳ Signature deadline: ${expiresDate}
              </div>
              <p style="font-size:13px;color:#78350F;margin:0;line-height:1.6;">
                After this date, the link will expire and you will no longer be able to sign
                or contest this report. The report will be automatically marked as
                <strong>expired</strong> and filed as-is — without your signature or objection
                on record.
              </p>
            </div>

            <div style="background:#F8F7F4;border-radius:12px;padding:16px 20px;margin-bottom:24px;">
              <div style="font-size:12px;font-weight:700;color:#374151;
                text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;">
                What happens if you don't sign?
              </div>
              <ul style="margin:0;padding:0 0 0 16px;font-size:13px;color:#6B7280;line-height:1.8;">
                <li>The inspection report remains legally valid without your signature</li>
                <li>You lose the ability to formally contest any findings</li>
                <li>In case of a dispute, the report may be submitted to the RERA Dispute Centre
                    without your input on record</li>
                <li>Your landlord or tenant will be notified of your non-response</li>
              </ul>
            </div>

            <a href="${sig.sign_url}"
              style="display:block;background:${primaryColor};color:white;text-align:center;
              padding:16px 24px;border-radius:14px;font-size:15px;font-weight:800;
              text-decoration:none;margin-bottom:16px;">
              Review &amp; Sign Report →
            </a>

            <p style="font-size:11px;color:#9B9BA8;text-align:center;line-height:1.5;margin:0 0 24px;">
              By signing, you confirm you have read and agree with the inspection findings.
            </p>

            <div style="margin-top:32px;padding-top:16px;border-top:1px solid #F3F3F8;
              text-align:center;font-size:11px;color:#C4C4C4;">
              Powered by <a href="https://www.snagify.net"
              style="color:#9A88FD;text-decoration:none;font-weight:600;">Snagify</a>
            · Dubai Property Inspections
            </div>
          </div>
        `,
      });

      await supabase
        .from('signatures')
        .update({ reminder_24h_sent_at: new Date().toISOString() })
        .eq('id', sig.id);

      if (insp?.agent_id) {
        await sendToUser(insp.agent_id, {
          title: 'Reminder sent',
          body: `24h reminder sent to ${sig.signer_name || sig.signer_type} for ${propertyAddress}.`,
          url: `/inspection/${sig.inspection_id}/report`,
          type: 'signature',
        });
      }
    }
  } catch (error) {
    console.error('[Cron] Reminder 24h error:', error);
  }
}

async function sendReminder72h() {
  try {
    const now = new Date();
    const threshold = new Date(now.getTime() - 68 * 60 * 60 * 1000).toISOString();

    const { data: sigs } = await supabase
      .from('signatures')
      .select(`
        id, email, signer_name, signer_type, sign_url, refuse_token,
        inspection_id, expires_at,
        inspections:inspection_id (
          agent_id,
          type, created_at,
          properties:property_id (building_name, unit_number, location),
          agent:agent_id (
            company:companies (name, logo_url, primary_color)
          )
        )
      `)
      .eq('signing_mode', 'remote')
      .is('signed_at', null)
      .is('refused_at', null)
      .not('reminder_24h_sent_at', 'is', null)
      .is('reminder_72h_sent_at', null)
      .lt('created_at', threshold);

    console.log(`[Cron] Reminder 72h: ${sigs?.length ?? 0} signatures`);

    for (const sig of sigs ?? []) {
      if (!sig.email || !sig.sign_url) continue;

      const insp = (Array.isArray(sig.inspections) ? sig.inspections[0] : sig.inspections) as {
        agent_id?: string | null
        type?: string
        created_at?: string
        properties?:
          | { building_name?: string; unit_number?: string; location?: string }
          | { building_name?: string; unit_number?: string; location?: string }[]
        agent?:
          | { company?: { name?: string; logo_url?: string; primary_color?: string } | { name?: string; logo_url?: string; primary_color?: string }[] }
          | { company?: { name?: string; logo_url?: string; primary_color?: string } | { name?: string; logo_url?: string; primary_color?: string }[] }[]
      } | null
      const prop = Array.isArray(insp?.properties) ? insp.properties[0] : insp?.properties;
      const agentRaw = Array.isArray(insp?.agent) ? insp.agent[0] : insp?.agent;
      const company = Array.isArray(agentRaw?.company) ? agentRaw.company[0] : agentRaw?.company;

      const agencyName = company?.name || 'Snagify';
      const primaryColor = company?.primary_color || '#9A88FD';
      const agencyLogo = company?.logo_url;
      const propLabel = formatPropertyBuildingUnit(prop ?? null);
      const propertyAddress = propLabel !== '—' ? propLabel : 'the property';
      const expiresDate = sig.expires_at
        ? new Date(sig.expires_at).toLocaleDateString('en-AE', {
            day: 'numeric', month: 'long', year: 'numeric',
          })
        : 'very soon';

      const agencyHeader = agencyLogo
        ? `<img src="${agencyLogo}" alt="${agencyName}" style="height:44px;border-radius:10px;object-fit:contain;" />`
        : `<div style="font-size:18px;font-weight:800;color:white;">${agencyName}</div>`;

      await resend.emails.send({
        from: `${agencyName} <noreply@snagify.net>`,
        to: sig.email,
        subject: `⚠️ Final reminder: Sign before ${expiresDate} — ${propertyAddress}`,
        html: `
          <div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">

            <div style="background:${primaryColor};border-radius:16px;padding:20px 24px;margin-bottom:24px;">
              ${agencyHeader}
            </div>

            <div style="background:#FEF2F2;border:2px solid #FECACA;border-radius:12px;
              padding:14px 18px;margin-bottom:24px;text-align:center;">
              <div style="font-size:14px;font-weight:800;color:#DC2626;">
                ⚠️ Action required — 4 days remaining
              </div>
              <div style="font-size:12px;color:#EF4444;margin-top:4px;">
                Deadline: ${expiresDate}
              </div>
            </div>

            <h2 style="font-size:20px;font-weight:800;color:#1A1A2E;margin:0 0 8px;">
              This is your final reminder
            </h2>
            <p style="font-size:14px;color:#6B7280;margin:0 0 24px;line-height:1.6;">
              Hi ${sig.signer_name || 'there'}, the inspection report for
              <strong style="color:#1A1A2E;">${propertyAddress}</strong> still requires
              your action. You have <strong style="color:#DC2626;">4 days left</strong>
              before this link expires permanently.
            </p>

            <div style="background:#1A1A2E;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
              <div style="font-size:12px;font-weight:700;color:#9A88FD;
                text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px;">
                What happens if you ignore this
              </div>
              <ul style="margin:0;padding:0 0 0 16px;font-size:13px;
                color:rgba(255,255,255,0.75);line-height:2;">
                <li>Your signature window closes <strong style="color:white;">permanently</strong>
                    on ${expiresDate}</li>
                <li>The report is filed <strong style="color:white;">as-is</strong>,
                    without your input on record</li>
                <li>You <strong style="color:white;">cannot contest</strong> any findings
                    after expiry</li>
                <li>In a RERA dispute, your non-response may be held against you</li>
              </ul>
            </div>

            <a href="${sig.sign_url}"
              style="display:block;background:${primaryColor};color:white;text-align:center;
              padding:16px 24px;border-radius:14px;font-size:15px;font-weight:800;
              text-decoration:none;margin-bottom:16px;">
              Sign Now — ${expiresDate} deadline →
            </a>

            <div style="margin-top:32px;padding-top:16px;border-top:1px solid #F3F3F8;
              text-align:center;font-size:11px;color:#C4C4C4;">
              Powered by <a href="https://www.snagify.net"
              style="color:#9A88FD;text-decoration:none;font-weight:600;">Snagify</a>
            · Dubai Property Inspections
            </div>
          </div>
        `,
      });

      await supabase
        .from('signatures')
        .update({ reminder_72h_sent_at: new Date().toISOString() })
        .eq('id', sig.id);

      if (insp?.agent_id) {
        await sendToUser(insp.agent_id, {
          title: 'Final reminder sent',
          body: `72h urgent reminder sent to ${sig.signer_name || sig.signer_type} for ${propertyAddress}. 4 days left.`,
          url: `/inspection/${sig.inspection_id}/report`,
          type: 'signature',
        });
      }
    }
  } catch (error) {
    console.error('[Cron] Reminder 72h error:', error);
  }
}

async function processExpiredSignatures() {
  try {
    const now = new Date().toISOString();

    const { data: sigs } = await supabase
      .from('signatures')
      .select(`
        id, email, signer_name, signer_type, inspection_id,
        inspections:inspection_id (
          id, type, created_at, report_url, status, agent_id,
          properties:property_id (building_name, unit_number, location),
          tenancies:tenancy_id (
            tenant_name, tenant_email,
            landlord_name, landlord_email
          ),
          agent:agent_id (
            full_name, email, receive_signed_report_email,
            company:companies (name, logo_url, primary_color)
          )
        )
      `)
      .eq('signing_mode', 'remote')
      .is('signed_at', null)
      .is('refused_at', null)
      .lt('expires_at', now);

    console.log(`[Cron] Expired signatures: ${sigs?.length ?? 0}`);

    const byInspection = new Map<string, typeof sigs>();
    for (const sig of sigs ?? []) {
      const group = byInspection.get(sig.inspection_id) ?? [];
      group.push(sig);
      byInspection.set(sig.inspection_id, group);
    }

    for (const [inspectionId, inspSigs] of Array.from(byInspection.entries())) {
      if (!inspSigs?.length) continue
      const firstSig = inspSigs[0];
      const insp = Array.isArray(firstSig.inspections)
        ? firstSig.inspections[0]
        : firstSig.inspections;

      if (!insp) continue;
      if (insp.status === 'expired' || insp.status === 'signed') continue;

      const prop = Array.isArray(insp.properties) ? insp.properties[0] : insp.properties;
      const tenancy = Array.isArray(insp.tenancies) ? insp.tenancies[0] : insp.tenancies;
      const agentRaw = Array.isArray(insp.agent) ? insp.agent[0] : insp.agent;
      const company = Array.isArray(agentRaw?.company)
        ? agentRaw.company[0]
        : agentRaw?.company;

      const agencyName = company?.name || 'Snagify';
      const primaryColor = company?.primary_color || '#9A88FD';
      const agencyLogo = company?.logo_url;
      const propLabel = formatPropertyBuildingUnit(prop ?? null);
      const propertyAddress = propLabel !== '—' ? propLabel : 'the property';
      const inspectionDate = insp.created_at
        ? new Date(insp.created_at).toLocaleDateString('en-AE', {
            day: 'numeric', month: 'long', year: 'numeric',
          })
        : '—';

      const agencyHeader = agencyLogo
        ? `<img src="${agencyLogo}" alt="${agencyName}" style="height:44px;border-radius:10px;object-fit:contain;" />`
        : `<div style="font-size:18px;font-weight:800;color:white;">${agencyName}</div>`;

      await supabase
        .from('inspections')
        .update({ status: 'expired' })
        .eq('id', inspectionId);

      const recipients: { email: string; name: string; role: string }[] = [];
      for (const sig of inspSigs) {
        if (sig.email) {
          recipients.push({
            email: sig.email,
            name: sig.signer_name || sig.signer_type,
            role: sig.signer_type,
          });
        }
      }

      const includeAgent = agentRaw?.receive_signed_report_email !== false;
      if (includeAgent && agentRaw?.email) {
        recipients.push({
          email: agentRaw.email,
          name: agentRaw.full_name || 'Inspector',
          role: 'agent',
        });
      }

      const unsignedNames = inspSigs
        .map((s) => `${s.signer_name || s.signer_type} (${s.signer_type})`)
        .join(', ');

      for (const recipient of recipients) {
        const isAgent = recipient.role === 'agent';

        await resend.emails.send({
          from: `${agencyName} <noreply@snagify.net>`,
          to: recipient.email,
          subject: `Inspection report expired — ${propertyAddress}`,
          html: `
            <div style="font-family:-apple-system,sans-serif;max-width:480px;
              margin:0 auto;padding:32px 24px;">

              <div style="background:${primaryColor};border-radius:16px;
                padding:20px 24px;margin-bottom:24px;">
                ${agencyHeader}
              </div>

              <div style="background:#F3F4F6;border:2px solid #D1D5DB;border-radius:12px;
                padding:14px 18px;margin-bottom:24px;text-align:center;">
                <div style="font-size:13px;font-weight:800;color:#6B7280;
                  text-transform:uppercase;letter-spacing:1px;">
                  🔒 Signature window closed
                </div>
              </div>

              <h2 style="font-size:20px;font-weight:800;color:#1A1A2E;margin:0 0 8px;">
                ${isAgent ? 'Report expired — no signature obtained' : 'Your signature window has closed'}
              </h2>

              <p style="font-size:14px;color:#6B7280;margin:0 0 24px;line-height:1.6;">
                ${isAgent
                  ? `The 7-day signature window for the inspection report at
                     <strong style="color:#1A1A2E;">${propertyAddress}</strong>
                     (${inspectionDate}) has expired.<br/><br/>
                     The following ${inspSigs.length > 1 ? 'parties have' : 'party has'} not responded:
                     <strong style="color:#1A1A2E;">${unsignedNames}</strong>.`
                  : `Hi ${recipient.name}, the 7-day window to sign the inspection report
                     for <strong style="color:#1A1A2E;">${propertyAddress}</strong>
                     (${inspectionDate}) has now closed. You can no longer sign
                     or contest this report.`
                }
              </p>

              <div style="background:#F8F7F4;border-radius:12px;padding:16px 20px;
                margin-bottom:24px;">
                <div style="font-size:12px;font-weight:700;color:#374151;
                  text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;">
                  What this means
                </div>
                <ul style="margin:0;padding:0 0 0 16px;font-size:13px;
                  color:#6B7280;line-height:1.9;">
                  ${isAgent ? `
                  <li>The report is filed as <strong>expired</strong> — legally valid as-is</li>
                  <li>You may contact the unsigned parties directly if needed</li>
                  <li>The report can be submitted to the RERA Dispute Centre if required</li>
                  <li>Consider conducting a new inspection if a fresh baseline is needed</li>
                  ` : `
                  <li>The inspection report remains <strong>legally valid</strong>
                      without your signature</li>
                  <li>Your ability to formally contest any findings has ended</li>
                  <li>In any future RERA dispute, this report may be submitted as evidence
                      without your input on record</li>
                  <li>All parties and the inspector have been notified of your non-response</li>
                  `}
                </ul>
              </div>

              ${insp.report_url ? `
              <a href="${insp.report_url}"
                style="display:block;background:#6B7280;color:white;text-align:center;
                padding:14px 24px;border-radius:14px;font-size:14px;font-weight:700;
                text-decoration:none;margin-bottom:16px;">
                View inspection report (read only)
              </a>` : ''}

              <div style="margin-top:32px;padding-top:16px;border-top:1px solid #F3F3F8;
                text-align:center;font-size:11px;color:#C4C4C4;">
                Powered by <a href="https://www.snagify.net"
              style="color:#9A88FD;text-decoration:none;font-weight:600;">Snagify</a>
            · Dubai Property Inspections
              </div>
            </div>
          `,
        });
      }

      if (insp.agent_id) {
        await sendToUser(insp.agent_id, {
          title: 'Signature window expired',
          body: `${propertyAddress} — ${unsignedNames} did not sign within 7 days. Report marked as expired.`,
          url: `/inspection/${inspectionId}/report`,
          type: 'expired',
        });
      }

      console.log(`[Cron] Expired: inspection ${inspectionId} → status:expired, notified ${recipients.length} parties`);
    }
  } catch (error) {
    console.error('[Cron] Expired signatures error:', error);
  }
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (
    process.env.NODE_ENV === 'production' &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[Cron] Starting daily notification job...');

  try {
    await Promise.all([
      notifyLeaseExpiry(),
      notifyInactivity(),
      notifyOpenedNotSigned(),
      notifyExpiringSignatures(),
      sendReminder24h(),
      sendReminder72h(),
      processExpiredSignatures(),
    ]);

    console.log('[Cron] Daily notification job completed');
    return NextResponse.json({ ok: true, timestamp: new Date().toISOString() });
  } catch (err: unknown) {
    console.error('[Cron] Fatal error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
