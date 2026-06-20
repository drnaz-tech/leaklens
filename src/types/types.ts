export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: "user" | "admin";
  email_alerts: boolean;
  alert_score_drop_threshold: number;
}

export interface Website {
  id: string;
  user_id: string;
  domain: string;
  display_name: string | null;
  verification_status: "pending" | "verified" | "failed";
  verification_method: "dns_txt" | "meta_tag" | "file_upload";
  verification_token: string;
  scan_frequency: "hourly" | "daily" | "weekly" | "monthly" | "custom";
  scan_enabled: boolean;
  last_score: number | null;
  last_risk_level: "low" | "medium" | "high" | "critical" | null;
  last_scan_at: string | null;
  created_at: string;
}

export interface ScanResult {
  id: string;
  website_id: string;
  status: "pending" | "running" | "completed" | "failed";
  score: number | null;
  risk_level: "low" | "medium" | "high" | "critical" | null;
  ssl_score: number | null;
  headers_score: number | null;
  cookies_score: number | null;
  dns_score: number | null;
  domain_score: number | null;
  exposure_score: number | null;
  availability_score: number | null;
  ssl_valid: boolean | null;
  ssl_expiry_date: string | null;
  ssl_issuer: string | null;
  https_enforced: boolean | null;
  http_status: number | null;
  response_time_ms: number | null;
  security_headers: Record<string, string | null> | null;
  technologies: string[] | null;
  exposed_files: Record<string, boolean> | null;
  scan_mode: "quick" | "full";
  share_token: string | null;
  share_enabled: boolean;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  created_at: string;
}

export interface Vulnerability {
  id: string;
  scan_id: string;
  severity: "info" | "low" | "medium" | "high" | "critical";
  title: string;
  description: string;
  category: string;
  remediation: string | null;
  cve_id: string | null;
  fixed: boolean;
}

export interface Notification {
  id: string;
  user_id: string;
  type: "critical_issue" | "score_drop" | "ssl_expiry" | "scan_complete" | "scan_failed";
  title: string;
  message: string;
  website_id: string | null;
  read: boolean;
  created_at: string;
}

export interface SiteHealthCheckResponse {
  domain: string;
  url: string;
  reachable: boolean;
  statusCode: number | null;
  responseTimeMs: number | null;
  redirectsToHttps: boolean;
  sslValid: boolean;
  sslDaysLeft: number | null;
  sslExpiryDate: string | null;
  sslIssuer: string | null;
  sslProtocol: string | null;
  serverHeader: string | null;
  poweredByHeader: string | null;
  checkedAt: string;
  error: string | null;
}

export interface RunScanResponse {
  scan_id: string;
  status: "running";
  scan_mode: "quick" | "full";
}

export interface VerifyDomainResponse {
  verified: boolean;
  error?: string;
}
