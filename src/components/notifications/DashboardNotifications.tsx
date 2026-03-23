'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Bell, Check } from 'lucide-react'

type Notification = {
  id: string
  title: string
  body: string
  url: string | null
  type: string
  read_at: string | null
  created_at: string
}

const TYPE_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  signature: { icon: '✍️', color: '#9A88FD', bg: '#EDE9FF' },
  lease: { icon: '🔑', color: '#F59E0B', bg: '#FEF3C7' },
  expired: { icon: '🔒', color: '#6B7280', bg: '#F3F4F6' },
  disputed: { icon: '⚠️', color: '#EF4444', bg: '#FEF2F2' },
  report: { icon: '📝', color: '#16A34A', bg: '#DCFCE7' },
  general: { icon: '🔔', color: '#9A88FD', bg: '#EDE9FF' },
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-AE', {
    day: 'numeric',
    month: 'short',
  })
}

export function DashboardNotifications() {
  const supabase = createClient()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [showAll, setShowAll] = useState(false)

  const fetchNotifications = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    setNotifications(data ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    void fetchNotifications()

    const channel = supabase
      .channel('dashboard-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
        },
        () => void fetchNotifications()
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [supabase, fetchNotifications])

  async function markAsRead(id: string) {
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
    const nowIso = new Date().toISOString()
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read_at: nowIso } : n))
    )
  }

  async function markAllAsRead() {
    const unreadIds = notifications.filter((n) => !n.read_at).map((n) => n.id)
    if (!unreadIds.length) return
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .in('id', unreadIds)
    const nowIso = new Date().toISOString()
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, read_at: n.read_at ?? nowIso }))
    )
  }

  function handleClick(notif: Notification) {
    void markAsRead(notif.id)
    if (notif.url) window.location.href = notif.url
  }

  const unreadCount = notifications.filter((n) => !n.read_at).length
  const displayed = showAll ? notifications : notifications.slice(0, 5)

  return (
    <div className="mx-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Bell size={16} className="text-[#9A88FD]" />
          <span className="text-[15px] font-bold text-[#1A1A2E]">
            Notifications
          </span>
          {unreadCount > 0 && (
            <span className="text-[10px] font-bold text-white bg-[#9A88FD] rounded-full px-2 py-0.5 leading-snug">
              {unreadCount} new
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="text-[12px] font-semibold text-[#9A88FD] flex items-center gap-1"
          >
            <Check size={11} />
            Mark all read
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-[#EEECFF] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-5 h-5 border-2 border-[#9A88FD] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
            <div className="w-12 h-12 bg-[#EDE9FF] rounded-2xl flex items-center justify-center mb-3">
              <Bell size={20} className="text-[#9A88FD]" />
            </div>
            <p className="text-[13px] font-semibold text-[#1A1A2E] mb-1">
              No notifications yet
            </p>
            <p className="text-[12px] text-gray-400 leading-relaxed">
              Signature updates, lease alerts and reminders will appear here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#F3F3F8]">
            {displayed.map((notif) => {
              const config = TYPE_CONFIG[notif.type] ?? TYPE_CONFIG.general
              const isUnread = !notif.read_at
              return (
                <button
                  key={notif.id}
                  onClick={() => handleClick(notif)}
                  className="w-full text-left px-4 py-3.5 flex items-start gap-3 transition-colors active:bg-[#F8F7F4]"
                  style={{ background: isUnread ? '#FAFAFA' : 'white' }}
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-[15px] mt-0.5"
                    style={{ background: config.bg }}
                  >
                    {config.icon}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={`text-[13px] leading-snug ${
                          isUnread
                            ? 'font-bold text-[#1A1A2E]'
                            : 'font-semibold text-[#374151]'
                        }`}
                      >
                        {notif.title}
                      </span>
                      <span className="text-[10px] text-gray-400 flex-shrink-0 mt-0.5 whitespace-nowrap">
                        {timeAgo(notif.created_at)}
                      </span>
                    </div>
                    <p className="text-[12px] text-gray-500 mt-0.5 leading-relaxed line-clamp-2">
                      {notif.body}
                    </p>
                  </div>

                  {isUnread && (
                    <div className="w-2 h-2 rounded-full bg-[#9A88FD] flex-shrink-0 mt-2" />
                  )}
                </button>
              )
            })}

            {notifications.length > 5 && (
              <button
                onClick={() => setShowAll((v) => !v)}
                className="w-full py-3 text-[12px] font-semibold text-[#9A88FD] text-center"
              >
                {showAll ? 'Show less' : `Show ${notifications.length - 5} more`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
