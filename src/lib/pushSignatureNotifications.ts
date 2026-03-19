import { createClient } from '@supabase/supabase-js';
import { sendPushNotification } from '@/lib/push';
import { formatPropertyBuildingUnit } from '@/lib/formatPropertyAddress';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function sendToAgent(agentId: string, payload: {
  title: string;
  body: string;
  url?: string;
}) {
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', agentId);

  if (!subs?.length) return;

  const results = await Promise.allSettled(
    subs.map((sub) => sendPushNotification(sub, payload))
  );

  const expired = results
    .map((r, i) =>
      r.status === 'fulfilled' && (r.value as { expired?: boolean }).expired
        ? subs[i].endpoint : null
    )
    .filter(Boolean) as string[];

  if (expired.length > 0) {
    await supabase.from('push_subscriptions').delete().in('endpoint', expired);
  }
}

async function getInspectionContext(inspectionId: string) {
  const { data } = await supabase
    .from('inspections')
    .select(`
      id,
      agent_id,
      type,
      properties (building_name, unit_number, location)
    `)
    .eq('id', inspectionId)
    .single();
  return data;
}

export async function notifySignatureSigned(signatureId: string) {
  try {
    const { data: sig } = await supabase
      .from('signatures')
      .select('inspection_id, signer_name, signer_type, signed_at')
      .eq('id', signatureId)
      .single();

    if (!sig?.inspection_id) return;

    const inspection = await getInspectionContext(sig.inspection_id);
    if (!inspection) return;

    const prop = (inspection as { properties?: { building_name?: string; unit_number?: string; location?: string } }).properties;
    const propLabel = formatPropertyBuildingUnit(prop ?? null);
    const placeLabel = propLabel !== '—' ? propLabel : 'a property';
    const signerLabel = sig.signer_type === 'tenant' ? 'Tenant' :
                        sig.signer_type === 'landlord' ? 'Landlord' : 'A party';

    await sendToAgent(inspection.agent_id, {
      title: 'Signature Received',
      body: `${signerLabel} ${sig.signer_name || ''} just signed the inspection report for ${placeLabel}.`,
      url: `/inspection/${sig.inspection_id}/report`,
    });
  } catch (err) {
    console.error('[Push] notifySignatureSigned error:', err);
  }
}

export async function notifyAllPartiesSigned(inspectionId: string) {
  try {
    const { data: allSigs } = await supabase
      .from('signatures')
      .select('id, signed_at, signer_type, signature_data')
      .eq('inspection_id', inspectionId);

    if (!allSigs?.length) return;
    
    // Explicit check: BOTH landlord AND tenant must exist and have signed
    const landlordSig = allSigs.find(s => s.signer_type === 'landlord');
    const tenantSig = allSigs.find(s => s.signer_type === 'tenant');
    
    const allSigned =
      !!landlordSig?.signed_at &&
      !!landlordSig?.signature_data &&
      !!tenantSig?.signed_at &&
      !!tenantSig?.signature_data;
    
    if (!allSigned) return;

    const inspection = await getInspectionContext(inspectionId);
    if (!inspection) return;

    const prop = (inspection as { properties?: { building_name?: string; unit_number?: string; location?: string } }).properties;
    const propLabel = formatPropertyBuildingUnit(prop ?? null);
    const placeLabel = propLabel !== '—' ? propLabel : 'a property';

    await sendToAgent(inspection.agent_id, {
      title: 'All Parties Signed',
      body: `The inspection report for ${placeLabel} is fully signed and complete.`,
      url: `/inspection/${inspectionId}/report`,
    });
  } catch (err) {
    console.error('[Push] notifyAllPartiesSigned error:', err);
  }
}

export async function notifyOpenedNotSigned() {
  try {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    const { data: sigs } = await supabase
      .from('signatures')
      .select('id, inspection_id, signer_name, signer_type, opened_at')
      .not('opened_at', 'is', null)
      .is('signed_at', null)
      .is('push_opened_reminder_sent_at', null)
      .lt('opened_at', twoHoursAgo);

    console.log(`[Cron] Opened not signed: ${sigs?.length ?? 0} signatures`);

    for (const sig of sigs ?? []) {
      const inspection = await getInspectionContext(sig.inspection_id);
      if (!inspection) continue;

      const prop = (inspection as { properties?: { building_name?: string; unit_number?: string; location?: string } }).properties;
      const propLabel = formatPropertyBuildingUnit(prop ?? null);
      const placeLabel = propLabel !== '—' ? propLabel : 'a property';
      const signerLabel = sig.signer_type === 'tenant' ? 'Tenant' :
                          sig.signer_type === 'landlord' ? 'Landlord' : 'A party';

      await sendToAgent(inspection.agent_id, {
        title: 'Report Opened — Not Signed Yet',
        body: `${signerLabel} ${sig.signer_name || ''} opened the report for ${placeLabel} but hasn't signed yet.`,
        url: `/inspection/${sig.inspection_id}/report`,
      });

      await supabase
        .from('signatures')
        .update({ push_opened_reminder_sent_at: new Date().toISOString() })
        .eq('id', sig.id);
    }
  } catch (err) {
    console.error('[Push] notifyOpenedNotSigned error:', err);
  }
}

export async function notifyExpiringSignatures() {
  try {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

    const { data: sigs } = await supabase
      .from('signatures')
      .select('id, inspection_id, signer_name, signer_type, expires_at')
      .is('signed_at', null)
      .is('push_expiry_reminder_sent_at', null)
      .not('expires_at', 'is', null)
      .gt('expires_at', now.toISOString())
      .lt('expires_at', in24h);

    console.log(`[Cron] Expiring signatures: ${sigs?.length ?? 0}`);

    for (const sig of sigs ?? []) {
      const inspection = await getInspectionContext(sig.inspection_id);
      if (!inspection) continue;

      const prop = (inspection as { properties?: { building_name?: string; unit_number?: string; location?: string } }).properties;
      const propLabel = formatPropertyBuildingUnit(prop ?? null);
      const placeLabel = propLabel !== '—' ? propLabel : 'a property';
      const signerLabel = sig.signer_type === 'tenant' ? 'Tenant' :
                          sig.signer_type === 'landlord' ? 'Landlord' : 'A party';

      await sendToAgent(inspection.agent_id, {
        title: 'Signature Link Expiring Soon',
        body: `${signerLabel} ${sig.signer_name || ''}'s signature link for ${placeLabel} expires in less than 24 hours.`,
        url: `/inspection/${sig.inspection_id}/report`,
      });

      await supabase
        .from('signatures')
        .update({ push_expiry_reminder_sent_at: new Date().toISOString() })
        .eq('id', sig.id);
    }
  } catch (err) {
    console.error('[Push] notifyExpiringSignatures error:', err);
  }
}
