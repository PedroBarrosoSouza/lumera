import type {
  AppSettings,
  CatalogProduct,
  UserProfile,
  UserWorkspaceData,
} from '../types';
import { getMondayOfWeek, getTodayStr } from './dateUtils';

const SESSION_TOKEN_KEY = 'creamy-session-token-v2';
const SESSION_USER_KEY = 'lumera-session-user-v2';
const USER_CACHE_PREFIX = 'creamy-user-cache-v2:';
const CATALOG_CACHE_KEY = 'lumera-catalog-cache-v2';
const TIMER_PREFIX = 'creamy-timer-v2:';
const NOTIFIED_PREFIX = 'creamy-notified-v2:';

export function getDefaultSettings(): AppSettings {
  return {
    startDate: getMondayOfWeek(getTodayStr()),
    morningTime: '07:30',
    nightTime: '21:30',
    webNotificationsEnabled: false,
    laserSessions: [],
  };
}

export function normalizeSettings(
  partial?: Partial<AppSettings> | null,
): AppSettings {
  const defaults = getDefaultSettings();
  if (!partial) return defaults;
  return {
    ...defaults,
    ...partial,
    laserSessions: Array.isArray(partial.laserSessions)
      ? partial.laserSessions
      : [],
  };
}

export function loadSessionToken(): string | null {
  try {
    return localStorage.getItem(SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function saveSessionToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(SESSION_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(SESSION_TOKEN_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

export function loadCachedUser(): UserProfile | null {
  try {
    const raw = localStorage.getItem(SESSION_USER_KEY);
    return raw ? (JSON.parse(raw) as UserProfile) : null;
  } catch {
    return null;
  }
}

export function saveCachedUser(user: UserProfile | null): void {
  try {
    if (user) {
      localStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(SESSION_USER_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

export function loadUserCache(userId: string): UserWorkspaceData | null {
  try {
    const raw = localStorage.getItem(`${USER_CACHE_PREFIX}${userId}`);
    if (!raw) return null;
    return JSON.parse(raw) as UserWorkspaceData;
  } catch {
    return null;
  }
}

export function saveUserCache(userId: string, data: UserWorkspaceData): void {
  try {
    localStorage.setItem(`${USER_CACHE_PREFIX}${userId}`, JSON.stringify(data));
  } catch {
    // Ignore storage errors
  }
}

export function loadCatalogCache(): CatalogProduct[] | null {
  try {
    const raw = localStorage.getItem(CATALOG_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CatalogProduct[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

export function saveCatalogCache(catalog: CatalogProduct[]): void {
  try {
    localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify(catalog));
  } catch {
    // Ignore storage errors
  }
}

export function loadCalmingTimerEnd(userId: string): number | null {
  try {
    const raw = localStorage.getItem(`${TIMER_PREFIX}${userId}`);
    if (!raw) return null;
    const val = Number(raw);
    return Number.isFinite(val) ? val : null;
  } catch {
    return null;
  }
}

export function saveCalmingTimerEnd(userId: string, value: number | null): void {
  try {
    if (value === null) {
      localStorage.removeItem(`${TIMER_PREFIX}${userId}`);
    } else {
      localStorage.setItem(`${TIMER_PREFIX}${userId}`, String(value));
    }
  } catch {
    // Ignore storage errors
  }
}

export function loadNotifiedToday(userId: string): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(`${NOTIFIED_PREFIX}${userId}`);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

export function saveNotifiedToday(
  userId: string,
  map: Record<string, boolean>,
): void {
  try {
    localStorage.setItem(`${NOTIFIED_PREFIX}${userId}`, JSON.stringify(map));
  } catch {
    // Ignore storage errors
  }
}
