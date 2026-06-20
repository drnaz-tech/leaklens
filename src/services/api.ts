import { supabase } from "@/db/supabase";
import type {
  Website,
  ScanResult,
  Profile,
  SiteHealthCheckResponse,
  RunScanResponse,
  VerifyDomainResponse,
} from "@/types/types";

declare global {
  interface Window {
    pendo?: {
      track: (eventName: string, properties?: Record<string, unknown>) => void;
    };
  }
}

// ---------------------------------------------------------------------------
// Websites
// ---------------------------------------------------------------------------

export async function addWebsite(domain: string, verificationMethod: Website["verification_method"]): Promise<Website> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error("Not authenticated");

  // Count existing websites for metadata
  const { count: existingCount } = await supabase
    .from("websites")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.user.id);

  const { data, error } = await supabase
    .from("websites")
    .insert({
      user_id: user.user.id,
      domain,
      verification_method: verificationMethod,
    })
    .select()
    .single();

  if (error) throw error;

  // Pendo Track Event: website_added
  // Fires when a user successfully adds a new domain to their monitoring portfolio
  if (window.pendo) {
    window.pendo.track("website_added", {
      domain,
      verification_method: verificationMethod,
      is_first_website: (existingCount ?? 0) === 0,
      total_websites_count: (existingCount ?? 0) + 1,
    });
  }

  return data;
}

export async function removeWebsite(websiteId: string): Promise<void> {
  // Fetch website details before deletion for tracking metadata
  const { data: website } = await supabase
    .from("websites")
    .select("domain, verification_status, last_score")
    .eq("id", websiteId)
    .single();

  const { data: scanCount } = await supabase
    .from("scan_results")
    .select("*", { count: "exact", head: true })
    .eq("website_id", websiteId);

  const { error } = await supabase
    .from("websites")
    .delete()
    .eq("id", websiteId);

  if (error) throw error;

  // Count remaining websites after deletion
  const { data: user } = await supabase.auth.getUser();
  const { count: remainingCount } = await supabase
    .from("websites")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.user?.id ?? "");

  // Pendo Track Event: website_removed
  // Fires when a user successfully removes a website from their monitoring portfolio
  if (window.pendo) {
    window.pendo.track("website_removed", {
      domain: website?.domain ?? "",
      verification_status: website?.verification_status ?? "",
      last_score: website?.last_score ?? null,
      total_scans_count: scanCount?.length ?? 0,
      remaining_websites_count: remainingCount ?? 0,
    });
  }
}

// ---------------------------------------------------------------------------
// Domain Verification
// ---------------------------------------------------------------------------

export async function verifyDomain(websiteId: string): Promise<VerifyDomainResponse> {
  // Fetch website info for tracking metadata
  const { data: website } = await supabase
    .from("websites")
    .select("domain, verification_method")
    .eq("id", websiteId)
    .single();

  const { data, error } = await supabase.functions.invoke("verify-domain", {
    body: { website_id: websiteId },
  });

  if (error) throw error;

  const result = data as VerifyDomainResponse;

  if (result.verified) {
    // Pendo Track Event: domain_verification_completed
    // Fires when domain ownership verification succeeds
    if (window.pendo) {
      window.pendo.track("domain_verification_completed", {
        domain: website?.domain ?? "",
        verification_method: website?.verification_method ?? "",
      });
    }
  } else {
    // Pendo Track Event: domain_verification_failed
    // Fires when domain ownership verification fails
    if (window.pendo) {
      window.pendo.track("domain_verification_failed", {
        domain: website?.domain ?? "",
        verification_method: website?.verification_method ?? "",
        error_reason: result.error ?? "unknown",
      });
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Scans
// ---------------------------------------------------------------------------

export async function runScan(
  websiteId: string,
  scanMode: "quick" | "full" = "quick",
  triggeredBy: string = "manual"
): Promise<RunScanResponse> {
  // Fetch website info for tracking metadata
  const { data: website } = await supabase
    .from("websites")
    .select("domain")
    .eq("id", websiteId)
    .single();

  const { data, error } = await supabase.functions.invoke("run-scan", {
    body: { website_id: websiteId, triggered_by: triggeredBy, scan_mode: scanMode },
  });

  if (error) throw error;

  const result = data as RunScanResponse;

  // Pendo Track Event: security_scan_initiated
  // Fires when a user manually triggers a security scan on a verified domain
  if (window.pendo) {
    window.pendo.track("security_scan_initiated", {
      website_id: websiteId,
      domain: website?.domain ?? "",
      scan_mode: result.scan_mode,
      triggered_by: triggeredBy,
      scan_id: result.scan_id,
    });
  }

  return result;
}

export async function getScanResult(scanId: string): Promise<ScanResult> {
  const { data, error } = await supabase
    .from("scan_results")
    .select("*")
    .eq("id", scanId)
    .single();

  if (error) throw error;
  return data;
}

// Module-level Set to prevent duplicate scan completion/failure tracking
// across component remounts and polling cycles
const trackedScanCompletions = new Set<string>();
const trackedScanFailures = new Set<string>();

export async function pollScanProgress(scanId: string): Promise<ScanResult> {
  const { data, error } = await supabase
    .from("scan_results")
    .select("*")
    .eq("id", scanId)
    .single();

  if (error) throw error;

  const scan = data as ScanResult;

  if (scan.status === "completed" && !trackedScanCompletions.has(scanId)) {
    trackedScanCompletions.add(scanId);

    // Fetch website info for tracking metadata
    const { data: website } = await supabase
      .from("websites")
      .select("domain")
      .eq("id", scan.website_id)
      .single();

    // Count vulnerabilities for this scan
    const { count: vulnCount } = await supabase
      .from("vulnerabilities")
      .select("*", { count: "exact", head: true })
      .eq("scan_id", scanId);

    const durationMs =
      scan.started_at && scan.completed_at
        ? new Date(scan.completed_at).getTime() - new Date(scan.started_at).getTime()
        : null;

    // Pendo Track Event: security_scan_completed
    // Fires when a security scan finishes and results are available
    if (window.pendo) {
      window.pendo.track("security_scan_completed", {
        scan_id: scanId,
        website_id: scan.website_id,
        domain: website?.domain ?? "",
        scan_mode: scan.scan_mode,
        score: scan.score,
        risk_level: scan.risk_level ?? "",
        ssl_score: scan.ssl_score,
        headers_score: scan.headers_score,
        cookies_score: scan.cookies_score,
        dns_score: scan.dns_score,
        vulnerabilities_count: vulnCount ?? 0,
        duration_ms: durationMs,
      });
    }
  }

  if (scan.status === "failed" && !trackedScanFailures.has(scanId)) {
    trackedScanFailures.add(scanId);

    // Fetch website info for tracking metadata
    const { data: website } = await supabase
      .from("websites")
      .select("domain")
      .eq("id", scan.website_id)
      .single();

    // Pendo Track Event: security_scan_failed
    // Fires when a security scan fails during execution
    if (window.pendo) {
      window.pendo.track("security_scan_failed", {
        scan_id: scanId,
        website_id: scan.website_id,
        domain: website?.domain ?? "",
        scan_mode: scan.scan_mode,
        error_message: scan.error_message?.substring(0, 200) ?? "",
      });
    }
  }

  return scan;
}

// ---------------------------------------------------------------------------
// Scan Sharing
// ---------------------------------------------------------------------------

export async function toggleScanSharing(scanId: string, enabled: boolean): Promise<ScanResult> {
  const { data, error } = await supabase
    .from("scan_results")
    .update({ share_enabled: enabled })
    .eq("id", scanId)
    .select()
    .single();

  if (error) throw error;

  const scan = data as ScanResult;

  if (enabled) {
    // Fetch website info for tracking metadata
    const { data: website } = await supabase
      .from("websites")
      .select("domain")
      .eq("id", scan.website_id)
      .single();

    // Pendo Track Event: scan_report_shared
    // Fires when a user enables public sharing on a scan report
    if (window.pendo) {
      window.pendo.track("scan_report_shared", {
        scan_id: scanId,
        website_id: scan.website_id,
        domain: website?.domain ?? "",
        score: scan.score,
        risk_level: scan.risk_level ?? "",
        share_token: scan.share_token ?? "",
      });
    }
  }

  return scan;
}

// ---------------------------------------------------------------------------
// Scan Comparison
// ---------------------------------------------------------------------------

export async function getScansForComparison(
  websiteId: string,
  scanId1: string,
  scanId2: string
): Promise<{ scan1: ScanResult; scan2: ScanResult }> {
  const [{ data: scan1, error: err1 }, { data: scan2, error: err2 }] = await Promise.all([
    supabase.from("scan_results").select("*").eq("id", scanId1).single(),
    supabase.from("scan_results").select("*").eq("id", scanId2).single(),
  ]);

  if (err1) throw err1;
  if (err2) throw err2;

  // Fetch website info for tracking metadata
  const { data: website } = await supabase
    .from("websites")
    .select("domain")
    .eq("id", websiteId)
    .single();

  // Pendo Track Event: scan_comparison_performed
  // Fires when a user performs a side-by-side comparison of two scan results
  if (window.pendo) {
    window.pendo.track("scan_comparison_performed", {
      website_id: websiteId,
      domain: website?.domain ?? "",
      scan_id_1: scanId1,
      scan_id_2: scanId2,
      score_1: scan1.score,
      score_2: scan2.score,
      score_delta: (scan2.score ?? 0) - (scan1.score ?? 0),
    });
  }

  return { scan1, scan2 };
}

// ---------------------------------------------------------------------------
// Scan Schedule
// ---------------------------------------------------------------------------

export async function updateScanSchedule(
  websiteId: string,
  scanEnabled: boolean,
  scanFrequency: Website["scan_frequency"]
): Promise<Website> {
  // Fetch current settings for tracking metadata
  const { data: currentWebsite } = await supabase
    .from("websites")
    .select("domain, scan_frequency")
    .eq("id", websiteId)
    .single();

  const { data, error } = await supabase
    .from("websites")
    .update({ scan_enabled: scanEnabled, scan_frequency: scanFrequency })
    .eq("id", websiteId)
    .select()
    .single();

  if (error) throw error;

  // Pendo Track Event: scan_schedule_configured
  // Fires when a user configures or changes the automated scan schedule
  if (window.pendo) {
    window.pendo.track("scan_schedule_configured", {
      website_id: websiteId,
      domain: currentWebsite?.domain ?? "",
      scan_enabled: scanEnabled,
      scan_frequency: scanFrequency,
      previous_frequency: currentWebsite?.scan_frequency ?? "",
    });
  }

  return data;
}

// ---------------------------------------------------------------------------
// Site Health Check
// ---------------------------------------------------------------------------

export async function checkSiteHealth(domain: string): Promise<SiteHealthCheckResponse> {
  const { data, error } = await supabase.functions.invoke("site-health-check", {
    body: { domain },
  });

  if (error) throw error;

  const result = data as SiteHealthCheckResponse;

  // Pendo Track Event: health_check_completed
  // Fires when a user performs a live site health check and receives results
  if (window.pendo) {
    window.pendo.track("health_check_completed", {
      domain: result.domain,
      reachable: result.reachable,
      status_code: result.statusCode,
      response_time_ms: result.responseTimeMs,
      ssl_valid: result.sslValid,
      ssl_days_left: result.sslDaysLeft,
      ssl_protocol: result.sslProtocol ?? "",
      redirects_to_https: result.redirectsToHttps,
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export async function updateProfile(updates: Partial<Pick<Profile, "full_name" | "avatar_url" | "email">>): Promise<Profile> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.user.id)
    .select()
    .single();

  if (error) throw error;

  // Pendo Track Event: profile_updated
  // Fires when a user successfully updates their profile settings
  if (window.pendo) {
    window.pendo.track("profile_updated", {
      fields_updated: Object.keys(updates).join(","),
    });
  }

  return data;
}

// ---------------------------------------------------------------------------
// Alert Preferences
// ---------------------------------------------------------------------------

export async function updateAlertPreferences(
  emailAlerts: boolean,
  alertScoreDropThreshold: number
): Promise<Profile> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error("Not authenticated");

  // Fetch current settings for tracking metadata
  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("alert_score_drop_threshold")
    .eq("id", user.user.id)
    .single();

  const { data, error } = await supabase
    .from("profiles")
    .update({
      email_alerts: emailAlerts,
      alert_score_drop_threshold: alertScoreDropThreshold,
    })
    .eq("id", user.user.id)
    .select()
    .single();

  if (error) throw error;

  // Pendo Track Event: alert_preferences_updated
  // Fires when a user changes their notification/alert preferences
  if (window.pendo) {
    window.pendo.track("alert_preferences_updated", {
      email_alerts_enabled: emailAlerts,
      alert_score_drop_threshold: alertScoreDropThreshold,
      previous_threshold: currentProfile?.alert_score_drop_threshold ?? null,
    });
  }

  return data;
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export async function markNotificationsRead(notificationIds: string[]): Promise<void> {
  // Fetch notification types before marking as read for tracking metadata
  const { data: notifications } = await supabase
    .from("notifications")
    .select("type")
    .in("id", notificationIds);

  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .in("id", notificationIds);

  if (error) throw error;

  const types = notifications
    ? [...new Set(notifications.map((n: { type: string }) => n.type))]
    : [];

  // Pendo Track Event: notifications_marked_read
  // Fires when a user marks one or more notifications as read
  if (window.pendo) {
    window.pendo.track("notifications_marked_read", {
      notification_count: notificationIds.length,
      notification_types: types.join(","),
      is_bulk_action: notificationIds.length > 1,
    });
  }
}

// ---------------------------------------------------------------------------
// Pricing
// ---------------------------------------------------------------------------

export async function selectPricingPlan(
  planName: string,
  planPrice: number,
  billingPeriod: string,
  currentPlan: string | null
): Promise<void> {
  // Pendo Track Event: pricing_plan_selected
  // Fires when a user selects a pricing plan and initiates checkout
  if (window.pendo) {
    window.pendo.track("pricing_plan_selected", {
      plan_name: planName,
      plan_price: planPrice,
      billing_period: billingPeriod,
      is_trial: currentPlan === null,
      previous_plan: currentPlan ?? "none",
    });
  }
}
