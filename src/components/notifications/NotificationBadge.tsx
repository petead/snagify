'use client'
import { useState, useEffect, useCallback } from 'react'
import { Bell } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { NotificationPanel } from './NotificationPanel'

export function NotificationBadge() {
  const supabase = createClient()
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)

  const fetchUnread = useCallback(async () => {
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .is('read_at', null)
    setUnreadCount(count ?? 0)
  }, [supabase])

  useEffect(() => {
    void fetchUnread()

    const channel = supabase
      .channel('notifications-badge')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
        },
        () => {
          void fetchUnread()
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [supabase, fetchUnread])

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative flex flex-col items-center gap-1 flex-1 h-full justify-center transition-all active:scale-95"
        aria-label="Notifications"
      >
        <div className="relative">
          <Bell
            size={22}
            className={unreadCount > 0 ? 'text-[#9A88FD]' : 'text-[#9B9BA8]'}
          />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-[#EF4444] text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
        <span
          className={`text-[10px] font-medium ${
            unreadCount > 0 ? 'text-[#9A88FD]' : 'text-[#9B9BA8]'
          }`}
        >
          Alerts
        </span>
      </button>

      <NotificationPanel
        open={open}
        onClose={() => setOpen(false)}
        onUnreadChange={setUnreadCount}
      />
    </>
  )
}
