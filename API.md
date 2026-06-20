# LeakLens Edge Function API Documentation

Base URL: `https://<project-ref>.supabase.co/functions/v1`

Authentication: All requests require a valid Supabase `anon` or `service_role` JWT in the `Authorization` header.

---

## Table of Contents

- [verify-domain](#verify-domain)
- [run-scan](#run-scan)
- [scheduled-scans](#scheduled-scans)
- [site-health-check](#site-health-check)

---

## verify-domain

`POST /verify-domain`

Verifies domain ownership using the method previously selected by the user (DNS TXT, HTML meta tag, or file upload). The verification token is checked against the live domain before marking the website as verified in the database.

### Request Headers

| Header | Value |
|--------|-------|
| `Authorization` | `Bearer <supabase-anon-key>` |
| `Content-Type` | `application/json` |

### Request Body

```json
{
  "website_id": "string"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `website_id` | `string` (uuid) | Yes | The website ID to verify |

### Response Body — Success (200)

```json
{
  "verified": true
}
```

| Field | Type | Description |
|-------|------|-------------|
| `verified` | `boolean` | `true` if ownership was confirmed |

### Response Body — Not Verified (200)

```json
{
  "verified": false,
  "error": "Verification token not found via dns_txt"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `verified` | `boolean` | Always `false` |
| `error` | `string` | Human-readable reason for failure |

### Response Body — Error

```json
{
  "error": "Website not found"
}
```

| Status | Meaning |
|--------|---------|
| `400` | Missing `website_id` |
| `404` | Website not found in database |
| `500` | Internal server error |

### Verification Methods

| Method | Check Description |
|--------|-------------------|
| `dns_txt` | Queries Cloudflare DNS-over-HTTPS for a TXT record containing `securye-verification=<token>` |
| `meta_tag` | Fetches `https://<domain>` and checks for `<meta name="securye-verification" content="<token>">` |
| `file_upload` | Fetches `https://<domain>/securye-verification-<token-slice>.txt` and compares content |

---

## run-scan

`POST /run-scan`

Triggers a deep security scan against a verified domain. The scan runs asynchronously in the background and returns immediately with a scan ID. The caller should poll the scan status via the database or listen for completion.

### Request Headers

| Header | Value |
|--------|-------|
| `Authorization` | `Bearer <supabase-anon-key>` |
| `Content-Type` | `application/json` |

### Request Body

```json
{
  "website_id": "string",
  "triggered_by": "manual",
  "scan_mode": "quick"
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `website_id` | `string` (uuid) | Yes | — | Target website ID |
| `triggered_by` | `string` | No | `"manual"` | Source of trigger (`manual`, `scheduled`, `api`) |
| `scan_mode` | `"quick" \| "full"` | No | `"quick"` | Scan depth — `quick` (~20s) or `full` (~45s) |

### Response Body — Success (200)

```json
{
  "scan_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "running",
  "scan_mode": "quick"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `scan_id` | `string` (uuid) | Unique scan identifier |
| `status` | `"running"` | Initial scan status |
| `scan_mode` | `"quick" \| "full"` | Confirmed scan mode |

### Response Body — Error

```json
{
  "error": "Domain must be verified before scanning"
}
```

| Status | Meaning |
|--------|---------|
| `400` | Missing `website_id` |
| `403` | Domain not verified |
| `404` | Website not found |
| `500` | Failed to create scan record or internal error |

### Scan Stages (Background)

| Stage | Duration | Description |
|-------|----------|-------------|
| 1. Connectivity | ~3s | HTTP/HTTPS probe, redirect chain capture |
| 2. SSL/TLS | ~5s | Certificate validity, expiry, issuer, protocol |
| 3. Security Headers | ~4s | CSP, HSTS, X-Frame-Options, etc. |
| 4. DNS Security | ~4s | A, MX, SPF, DKIM, DMARC, NS records |
| 5. Cookie & Tech | ~3s | Cookie flags, framework fingerprinting |
| 6. Public Files | ~3s | robots.txt, security.txt, sitemap.xml |
| 7. Advanced Checks | ~12s (full) | Exposure finder, WAF detection, CORS, mixed content |
| 8. Scoring | ~2s | Weighted sub-score calculation + compliance |

### Scan Result Stored Fields

The background process writes the following to `scan_results`:

| Field | Type | Description |
|-------|------|-------------|
| `status` | `"completed" \| "failed"` | Final status |
| `score` | `number` (0–100) | Composite security score |
| `risk_level` | `"low" \| "medium" \| "high" \| "critical"` | Overall risk |
| `ssl_score` | `number` (0–100) | SSL/TLS sub-score |
| `headers_score` | `number` (0–100) | Security headers sub-score |
| `cookies_score` | `number` (0–100) | Cookie security sub-score |
| `dns_score` | `number` (0–100) | DNS health sub-score |
| `domain_score` | `number` (0–100) | Domain security sub-score |
| `exposure_score` | `number` (0–100) | Exposed files sub-score |
| `availability_score` | `number` (0–100) | Uptime/response sub-score |
| `ssl_valid` | `boolean` | Certificate validity |
| `ssl_expiry_date` | `string \| null` | ISO 8601 expiry timestamp |
| `ssl_issuer` | `string \| null` | Certificate authority name |
| `https_enforced` | `boolean` | HTTPS redirect detected |
| `http_status` | `number` | Final HTTP status code |
| `response_time_ms` | `number` | Total scan elapsed time |
| `redirect_chain` | `RedirectStep[]` | Array of redirect hops |
| `security_headers` | `SecurityHeaders` | Parsed header values |
| `technologies` | `string[]` | Detected tech stack |
| `dns_records` | `DnsRecords` | DNS query results |
| `exposed_files` | `ExposedFiles` | Public file presence |
| `compliance_findings` | `ComplianceResult` | GDPR, PCI DSS, SOC 2, ISO 27001 |
| `share_token` | `string` | Public report token |
| `error_message` | `string \| null` | Failure reason |

### Sub-Schemas

```typescript
interface RedirectStep {
  url: string;
  status: number;
}

interface SecurityHeaders {
  'Content-Security-Policy': string | null;
  'Strict-Transport-Security': string | null;
  'X-Frame-Options': string | null;
  'X-Content-Type-Options': string | null;
  'Referrer-Policy': string | null;
  'Permissions-Policy': string | null;
  'X-XSS-Protection': string | null;
}

interface DnsRecords {
  a: string[];
  mx: string[];
  spf: string | null;
  dkim: string | null;
  txt: string[];
  dmarc: string | null;
  ns: string[];
}

interface ExposedFiles {
  robots_txt: boolean;
  security_txt: boolean;
  sitemap_xml: boolean;
}
```

---

## scheduled-scans

`POST /scheduled-scans`

Triggered internally by a Supabase cron job every hour. Finds all verified websites with `scan_enabled=true` and `next_scan_at` in the past, then queues a `run-scan` for each. No external client should call this directly unless simulating a cron run.

### Request Headers

| Header | Value |
|--------|-------|
| `Authorization` | `Bearer <supabase-anon-key>` |
| `Content-Type` | `application/json` |

### Request Body

Empty body accepted. Cron-triggered invocations pass no body.

### Response Body — Success (200)

```json
{
  "triggered": 12,
  "total": 15
}
```

| Field | Type | Description |
|-------|------|-------------|
| `triggered` | `number` | Number of scans successfully queued |
| `total` | `number` | Total websites evaluated |

```json
{
  "triggered": 0,
  "message": "No scans due"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `triggered` | `number` | Always `0` |
| `message` | `string` | Human-readable status |

### Response Body — Error (500)

```json
{
  "error": "Database query failed"
}
```

### Failure Handling

When a scheduled scan fails to trigger, a `scan_failed` notification is automatically created for the site owner:

| Notification Field | Value |
|-------------------|-------|
| `type` | `"scan_failed"` |
| `title` | `"Scheduled Scan Failed"` |
| `message` | Failure reason including domain name |

---

## site-health-check

`POST /site-health-check`

Performs a live, synchronous health check on any domain. Measures real HTTP response time and performs a TLS handshake to extract SSL certificate metadata. No database write occurs — this is a pure probe function.

### Request Headers

| Header | Value |
|--------|-------|
| `Authorization` | `Bearer <supabase-anon-key>` |
| `Content-Type` | `application/json` |

### Request Body

```json
{
  "domain": "example.com"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `domain` | `string` | Yes | Domain to check. Protocol (`https://`) is optional and will be stripped. |

### Response Body — Success (200)

```json
{
  "domain": "example.com",
  "url": "https://example.com",
  "reachable": true,
  "statusCode": 200,
  "responseTimeMs": 124,
  "redirectsToHttps": true,
  "sslValid": true,
  "sslDaysLeft": 89,
  "sslExpiryDate": "2026-09-15T12:00:00.000Z",
  "sslIssuer": "Cloudflare, Inc.",
  "sslProtocol": "TLSv1.3",
  "serverHeader": "cloudflare",
  "poweredByHeader": null,
  "checkedAt": "2026-06-12T14:32:10.123Z",
  "error": null
}
```

| Field | Type | Description |
|-------|------|-------------|
| `domain` | `string` | Normalized domain name |
| `url` | `string` | HTTPS URL used for the probe |
| `reachable` | `boolean` | `true` if HTTP status < 500 |
| `statusCode` | `number \| null` | Final HTTP status code |
| `responseTimeMs` | `number \| null` | Round-trip time in milliseconds |
| `redirectsToHttps` | `boolean` | Final URL starts with `https://` |
| `sslValid` | `boolean` | Certificate is present and not expired |
| `sslDaysLeft` | `number \| null` | Days until certificate expiry |
| `sslExpiryDate` | `string \| null` | ISO 8601 certificate expiry |
| `sslIssuer` | `string \| null` | Certificate authority |
| `sslProtocol` | `string \| null` | Negotiated TLS version |
| `serverHeader` | `string \| null` | `Server` response header |
| `poweredByHeader` | `string \| null` | `X-Powered-By` response header |
| `checkedAt` | `string` | ISO 8601 timestamp of the check |
| `error` | `string \| null` | Human-readable error message |

### Response Body — Error (400)

```json
{
  "error": "Missing required parameter: domain"
}
```

### Response Body — Error (500)

```json
{
  "error": "Internal error"
}
```

### Error Scenarios

| Scenario | `reachable` | `sslValid` | `error` |
|----------|-------------|------------|---------|
| Domain resolves, HTTP 200 | `true` | `true` | `null` |
| Domain resolves, HTTP 404 | `true` | `true` | `null` |
| Domain unreachable (timeout) | `false` | `false` | `"Connection timed out"` |
| TLS handshake fails | `false`* | `false` | `"TLS: ..."` |
| DNS resolution fails | `false` | `false` | `"Fetch failed"` |

*Note: If TLS fails but DNS resolves, `reachable` may still be `false` because the HTTPS fetch also fails.

---

## Shared Utilities

All Edge Functions import from `supabase/functions/_shared/cors.ts`:

```typescript
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export function corsResponse(): Response;
export function jsonResponse(data: unknown, status?: number): Response;
export function errorResponse(message: string, status?: number): Response;
```

### CORS Preflight

Every function responds to `OPTIONS` requests with a `204 No Content` and the shared CORS headers. No authentication is required for preflight requests.

---

## Error Format

All errors follow this consistent JSON structure:

```json
{
  "error": "Human-readable message"
}
```

HTTP status codes:

| Code | Usage |
|------|-------|
| `204` | CORS preflight |
| `200` | Successful response |
| `400` | Bad request (missing/invalid parameters) |
| `403` | Forbidden (e.g. unverified domain) |
| `404` | Resource not found |
| `500` | Internal server error |

---

## TypeScript Client Types

```typescript
// Verify Domain
interface VerifyDomainResponse {
  verified: boolean;
  error?: string;
}

// Run Scan
interface RunScanRequest {
  website_id: string;
  triggered_by?: string;
  scan_mode?: 'quick' | 'full';
}
interface RunScanResponse {
  scan_id: string;
  status: 'running';
  scan_mode: 'quick' | 'full';
}

// Scheduled Scans
interface ScheduledScansResponse {
  triggered: number;
  total: number;
  message?: string;
  error?: string;
}

// Site Health Check
interface SiteHealthCheckRequest {
  domain: string;
}
interface SiteHealthCheckResponse {
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
```
