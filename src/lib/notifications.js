import { supabase } from './supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)))
}

export async function registerPushNotifications(userId) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false
  if (!VAPID_PUBLIC_KEY) return false

  try {
    const reg = await navigator.serviceWorker.ready
    const existing = await reg.pushManager.getSubscription()
    if (existing) {
      await savePushSubscription(userId, existing)
      return true
    }

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return false

    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })

    await savePushSubscription(userId, subscription)
    return true
  } catch (err) {
    console.error('Push registration error:', err)
    return false
  }
}

async function savePushSubscription(userId, subscription) {
  const sub = subscription.toJSON()
  await supabase.from('push_subscriptions').upsert({
    user_id: userId,
    endpoint: sub.endpoint,
    p256dh: sub.keys.p256dh,
    auth: sub.keys.auth,
  })
}

export function showLocalNotification(title, body, icon = '/icons/icon-192.png') {
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon })
  }
}
