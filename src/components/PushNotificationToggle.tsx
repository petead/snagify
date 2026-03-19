'use client';

import { useState, useEffect } from 'react';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const base64 = base64String
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const padded = base64 + padding;
  
  try {
    const rawData = window.atob(padded);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  } catch (e) {
    console.error('[Push] VAPID key decode error:', e, 'key was:', base64String);
    throw new Error('Invalid VAPID key format');
  }
}

async function getOrRegisterSW(): Promise<ServiceWorkerRegistration> {
  const allRegs = await navigator.serviceWorker.getRegistrations();

  const pushReg = allRegs.find(r => !!r.pushManager);
  if (pushReg) return pushReg;

  try {
    const newReg = await navigator.serviceWorker.register('/sw-push.js', {
      scope: '/',
      updateViaCache: 'none',
    });
    await new Promise<void>((resolve) => {
      if (newReg.active) { resolve(); return; }
      const sw = newReg.installing || newReg.waiting;
      if (!sw) { resolve(); return; }
      sw.addEventListener('statechange', (e) => {
        if ((e.target as ServiceWorker).state === 'activated') resolve();
      });
      setTimeout(resolve, 5000);
    });
    return newReg;
  } catch (err) {
    console.error('[Push] Failed to register sw-push.js:', err);
    throw err;
  }
}

export default function PushNotificationToggle() {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
    setSupported(true);
    setPermission(Notification.permission);
    checkSubscription();
  }, []);

  async function checkSubscription() {
    try {
      const allRegs = await navigator.serviceWorker.getRegistrations();
      for (const reg of allRegs) {
        const sub = await reg.pushManager?.getSubscription();
        if (sub) { setIsSubscribed(true); return; }
      }
      setIsSubscribed(false);
    } catch (err) {
      console.error('[Push] checkSubscription error:', err);
    }
  }

  async function handleToggle() {
    if (isLoading) return;
    setIsLoading(true);
    setError(null);

    try {
      if (isSubscribed) {
        const allRegs = await navigator.serviceWorker.getRegistrations();
        for (const reg of allRegs) {
          const sub = await reg.pushManager?.getSubscription();
          if (sub) {
            await fetch('/api/push/subscribe', {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ endpoint: sub.endpoint }),
            });
            await sub.unsubscribe();
            break;
          }
        }
        setIsSubscribed(false);
        return;
      }

      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') {
        setError('Permission denied. Enable notifications in iOS Settings → Safari → Notifications.');
        return;
      }

      let reg: ServiceWorkerRegistration;
      try {
        reg = await getOrRegisterSW();
      } catch (err: unknown) {
        setError(`SW error: ${err instanceof Error ? err.message : String(err)}`);
        return;
      }

      if (!reg.pushManager) {
        setError('pushManager not available on this SW. Check console for SW details.');
        return;
      }

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        setError('VAPID key missing. Check NEXT_PUBLIC_VAPID_PUBLIC_KEY env var.');
        return;
      }

      let applicationServerKey: Uint8Array;
      try {
        applicationServerKey = urlBase64ToUint8Array(vapidKey);
      } catch (err: unknown) {
        setError(`VAPID key error: ${err instanceof Error ? err.message : String(err)}`);
        return;
      }

      let sub: PushSubscription;
      try {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey as BufferSource,
        });
      } catch (err: unknown) {
        console.error('[Push] pushManager.subscribe failed:', err);
        const msg = err instanceof Error ? err.message : String(err);
        setError(`Subscribe failed: ${msg}`);
        return;
      }

      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.error('[Push] Server error:', body);
        setError(`Server error ${res.status}: ${JSON.stringify(body)}`);
        return;
      }

      setIsSubscribed(true);

    } catch (err: unknown) {
      console.error('[Push] Unexpected error:', err);
      setError(`Unexpected: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  }

  if (!supported) return null;

  return (
    <div
      style={{
        padding: "16px 20px",
        display: "flex",
        flexDirection: "column",
        borderBottom: "1px solid #F0EFEC",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              background: isSubscribed ? "rgba(154,136,253,0.1)" : "#EEEDE9",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke={isSubscribed ? "#9A88FD" : "#999"}
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 01-3.46 0" />
            </svg>
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#1A1A1A", margin: 0 }}>
              Push Notifications
            </p>
            <p style={{ fontSize: 11, color: "#BBB", margin: "2px 0 0" }}>
              {permission === 'denied'
                ? 'Blocked — check iOS Settings'
                : isSubscribed
                ? 'Active — receiving alerts'
                : 'Get notified for reports'}
            </p>
          </div>
        </div>

        <button
          onClick={handleToggle}
          disabled={isLoading || permission === 'denied'}
          aria-label="Toggle push notifications"
          style={{
            position: "relative",
            width: 48,
            height: 26,
            borderRadius: 13,
            border: "none",
            flexShrink: 0,
            transition: "background-color 0.2s ease",
            background: isSubscribed ? "#9A88FD" : "#E5E5E5",
            opacity: permission === 'denied' || isLoading ? 0.4 : 1,
            cursor: permission === 'denied' || isLoading ? "not-allowed" : "pointer",
          }}
        >
          {isLoading ? (
            <span
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span
                style={{
                  width: 12,
                  height: 12,
                  border: "2px solid #999",
                  borderTopColor: "transparent",
                  borderRadius: "50%",
                  animation: "spin 0.6s linear infinite",
                }}
              />
            </span>
          ) : (
            <span
              style={{
                position: "absolute",
                top: 2,
                left: isSubscribed ? 24 : 2,
                width: 22,
                height: 22,
                background: "#fff",
                borderRadius: "50%",
                boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                transition: "left 0.2s ease",
              }}
            />
          )}
        </button>
      </div>

      {error && (
        <p style={{ marginTop: 8, fontSize: 11, color: "#EF4444", wordBreak: "break-all" }}>{error}</p>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
