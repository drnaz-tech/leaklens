/**
 * Pendo SDK lifecycle helpers for LeakLens.
 *
 * Usage:
 *   - Call `initializePendo()` once at app entry (e.g. in main.tsx before rendering).
 *   - Call `identifyPendoVisitor(profile)` after the user signs in.
 *   - Call `clearPendoSession()` when the user signs out.
 */

interface PendoProfile {
  id: string;
  email: string;
  full_name: string;
  role: string;
  email_alerts: boolean;
  alert_score_drop_threshold: number;
}

/** Boot the Pendo SDK with an anonymous visitor. Call exactly once at app entry. */
export function initializePendo(): void {
  pendo.initialize({
    visitor: {
      id: '',
    },
  });
}

/** Identify the signed-in user. Call after authentication succeeds. */
export function identifyPendoVisitor(profile: PendoProfile): void {
  pendo.identify({
    visitor: {
      id: profile.id,
      email: profile.email,
      full_name: profile.full_name,
      role: profile.role,
      email_alerts: profile.email_alerts,
      alert_score_drop_threshold: profile.alert_score_drop_threshold,
    },
  });
}

/** Clear the Pendo session. Call when the user signs out. */
export function clearPendoSession(): void {
  pendo.clearSession();
}
