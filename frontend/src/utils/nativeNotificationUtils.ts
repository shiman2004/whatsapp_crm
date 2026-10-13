/**
 * Native Windows / macOS Desktop Notification Utility
 * Delivers OS notifications to the Windows Action Center even when on other websites or apps.
 */

let swRegistration: ServiceWorkerRegistration | null = null;

/**
 * Registers the Service Worker to allow background OS push & notification delivery
 */
export async function registerNotificationServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    swRegistration = reg;
    return reg;
  } catch (err) {
    console.warn('[Notification SW] Service Worker registration failed:', err);
    return null;
  }
}

/**
 * Requests native desktop notification permission from the user
 */
export async function requestDesktopNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      await registerNotificationServiceWorker();
    }
    return permission;
  } catch (err) {
    console.error('[Notification Permission] Request error:', err);
    return 'denied';
  }
}

/**
 * Dispatches a native desktop notification that pops up on Windows / Mac over other websites and apps
 */
export async function showDesktopNativeNotification(
  title: string, 
  options: {
    body: string;
    icon?: string;
    badge?: string;
    leadId?: string;
    tag?: string;
    onClick?: () => void;
  }
): Promise<void> {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const notifOptions: any = {
    body: options.body,
    icon: options.icon || '/logo.png',
    badge: '/favicon.png',
    tag: options.tag || 'wa-crm-msg',
    renotify: true,
    data: { leadId: options.leadId },
    silent: false,
  };

  try {
    // 1. Preferred modern method: Service Worker showNotification (Bypasses background tab throttling)
    if ('serviceWorker' in navigator) {
      const reg = swRegistration || await navigator.serviceWorker.ready.catch(() => null);
      if (reg) {
        await reg.showNotification(title, notifOptions);
        return;
      }
    }

    // 2. Fallback: Classic Notification constructor
    const notif = new Notification(title, notifOptions);
    if (options.onClick) {
      notif.onclick = () => {
        window.focus();
        options.onClick?.();
        notif.close();
      };
    }
  } catch (err) {
    console.warn('[Desktop Notification] Could not display native notification:', err);
    try {
      // Secondary fallback
      const notif = new Notification(title, notifOptions);
      if (options.onClick) {
        notif.onclick = () => {
          window.focus();
          options.onClick?.();
          notif.close();
        };
      }
    } catch (e2) {}
  }
}
