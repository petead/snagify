import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { sendPushNotification } from '@/lib/push';

export async function POST(req: Request) {
  const secret = req.headers.get('x-internal-secret');
  if (secret !== process.env.INTERNAL_API_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { user_id, title, body, icon, url } = await req.json();

  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', user_id);

  if (!subscriptions?.length) return NextResponse.json({ sent: 0 });

  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      sendPushNotification(sub, { title, body, icon, url })
    )
  );

  const expired = results
    .map((r, i) => (r.status === 'fulfilled' && (r.value as any).expired ? subscriptions[i].endpoint : null))
    .filter(Boolean);

  if (expired.length > 0) {
    await supabase.from('push_subscriptions').delete().in('endpoint', expired as string[]);
  }

  return NextResponse.json({ sent: subscriptions.length - expired.length });
}
