import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
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

async function sendToUser(userId: string, payload: {
  title: string;
  body: string;
  url?: string;
}) {
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
  const in30Days = new Date(today);
  in30Days.setDate(today.getDate() + 30);
  const target = in30Days.toISOString().split('T')[0];

  const { data: tenancies, error } = await supabase
    .from('tenancies')
    .select(`
      id,
      agent_id,
      tenant_name,
      contract_to,
      properties (building_name, unit_number, location)
    `)
    .eq('contract_to', target)
    .eq('status', 'active');

  if (error) {
    console.error('[Cron] lease expiry query error:', error);
    return;
  }

  console.log(`[Cron] Lease expiry: ${tenancies?.length ?? 0} tenancies expiring in 30 days`);

  for (const tenancy of tenancies ?? []) {
    const prop = (tenancy as { properties?: { building_name?: string; unit_number?: string; location?: string } }).properties;
    const propLabel = formatPropertyBuildingUnit(prop ?? null);
    const placeLabel = propLabel !== '—' ? propLabel : 'your property';
    const tenantName = (tenancy as { tenant_name?: string }).tenant_name || 'Your tenant';
    const agentId = (tenancy as { agent_id?: string }).agent_id;
    const contractTo = (tenancy as { contract_to?: string }).contract_to;

    if (agentId) {
      await sendToUser(agentId, {
        title: 'Lease Expiring in 30 Days',
        body: `${tenantName}'s lease at ${placeLabel} ends on ${contractTo}. Time to schedule a check-out inspection.`,
        url: '/properties',
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
        });
      }
    }
  }

  console.log(`[Cron] Inactivity check done for ${userIds.length} subscribers`);
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
