export const DAEMON_URL_KEY = 'gx-portal-daemon-url';

export const DAEMON_PRESETS = [
  { id: 'prod', label: 'gx-daemon (prod)', port: 8010 },
  { id: 'dev', label: 'gx-daemon (dev)', port: 8011 },
] as const;

export type DaemonPreset = (typeof DAEMON_PRESETS)[number];

export function resolveDaemonPreset(url: string): DaemonPreset | null {
  if (!url) return null;
  return DAEMON_PRESETS.find((p) => url.includes(`:${p.port}`)) ?? null;
}

export function activeDaemonUrl(savedUrl: string | null, configUrl?: string): string {
  return savedUrl ?? configUrl ?? '';
}
