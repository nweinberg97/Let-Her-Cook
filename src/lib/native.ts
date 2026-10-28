import { Capacitor, CapacitorHttp } from '@capacitor/core';

/**
 * Everything that behaves differently inside the iPhone/iPad app (Capacitor)
 * versus the website lives here, so the rest of the app just calls one
 * function either way. On the web every helper falls back to the browser API.
 */

export const isNativeApp = Capacitor.isNativePlatform();
export const isIOSApp = isNativeApp && Capacitor.getPlatform() === 'ios';

/** How to refer to where recipes live: "this app" in the iPhone app, "this browser" on the web. */
export const PLACE = isNativeApp ? 'this app' : 'this browser';

/** Status bar, splash screen. Safe to call on the web (does nothing). */
export async function initNativeShell(): Promise<void> {
  if (!isNativeApp) return;
  document.documentElement.classList.add('is-native-app');
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    // Style.Light = dark text for our light backgrounds.
    await StatusBar.setStyle({ style: Style.Light });
  } catch {
    /* status bar styling is cosmetic */
  }
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide({ fadeOutDuration: 250 });
  } catch {
    /* ignore */
  }
}

/** A small tap of the Taptic Engine for satisfying moments (favorite, save, step done). */
export async function haptic(kind: 'tap' | 'success' | 'warning' = 'tap'): Promise<void> {
  if (!isNativeApp) return;
  try {
    const { Haptics, ImpactStyle, NotificationType } = await import('@capacitor/haptics');
    if (kind === 'tap') await Haptics.impact({ style: ImpactStyle.Light });
    else await Haptics.notification({ type: kind === 'success' ? NotificationType.Success : NotificationType.Warning });
  } catch {
    /* haptics are a nicety */
  }
}

export function canUseShareSheet(): boolean {
  return isNativeApp || (typeof navigator !== 'undefined' && typeof navigator.share === 'function');
}

/** Opens the share sheet. Resolves false if the person cancelled. */
export async function shareContent(opts: { title: string; text: string; url?: string | null }): Promise<boolean> {
  try {
    if (isNativeApp) {
      const { Share } = await import('@capacitor/share');
      await Share.share({ title: opts.title, text: opts.text, ...(opts.url ? { url: opts.url } : {}), dialogTitle: opts.title });
      return true;
    }
    await navigator.share({ title: opts.title, text: opts.text, ...(opts.url ? { url: opts.url } : {}) });
    return true;
  } catch (err) {
    const msg = String((err as { message?: string })?.message ?? err);
    if ((err as { name?: string })?.name === 'AbortError' || /cancel/i.test(msg)) return false;
    throw err;
  }
}

/**
 * In the app there's no "Downloads" folder, so files (backups, recipe text)
 * are written to the app's cache and handed to the share sheet, where the
 * person can pick "Save to Files", AirDrop, Mail, etc.
 */
export async function saveFileNative(content: string, fileName: string): Promise<void> {
  const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
  const { Share } = await import('@capacitor/share');
  const written = await Filesystem.writeFile({ path: fileName, data: content, directory: Directory.Cache, encoding: Encoding.UTF8 });
  try {
    await Share.share({ title: fileName, files: [written.uri], dialogTitle: 'Save or send' });
  } catch (err) {
    // Closing the share sheet without picking anything isn't an error.
    if (!/cancel/i.test(String((err as { message?: string })?.message ?? err))) throw err;
  }
}

/**
 * Recipe sites block browsers from reading their pages (CORS), but the app can
 * fetch them natively — the request goes straight from the phone to the site,
 * exactly as if you opened it, so link import works far more often in the app.
 */
export async function fetchPageNative(url: string, timeoutMs: number): Promise<{ status: number; contentType: string; body: string }> {
  const res = await CapacitorHttp.get({
    url,
    responseType: 'text',
    headers: { Accept: 'text/html,application/xhtml+xml', 'Accept-Language': navigator.language || 'en' },
    connectTimeout: timeoutMs,
    readTimeout: timeoutMs
  });
  const headers = Object.fromEntries(Object.entries(res.headers ?? {}).map(([k, v]) => [k.toLowerCase(), String(v)]));
  return { status: res.status, contentType: headers['content-type'] ?? '', body: typeof res.data === 'string' ? res.data : JSON.stringify(res.data ?? '') };
}
