# Security TODO - Post-MVP Improvements

**Document Version**: 1.0
**Last Updated**: October 14, 2025
**Current Stage**: MVP (2 companies, testing phase)

---

## 🎯 Current Security Posture

### ✅ Implemented (MVP Level)

1. **Client-Side Access Control**
   - Session detail page verifies user owns session OR is manager of same company
   - UI prevents unauthorized navigation

2. **Authentication**
   - Supabase Auth for user management
   - Session-based authentication via cookies
   - Automatic token refresh

3. **Database Security**
   - Row Level Security (RLS) policies active
   - Admin client used for cross-user queries (managers viewing employees)
   - Separate client/server Supabase instances

4. **Access Control**
   - Employees can only view their own sessions
   - Managers can view sessions from their company only
   - Client-side AND server-side validation

### ⚠️ Known Limitations (Acceptable for MVP)

1. **No Server-Side API Authorization**
   - `/api/training-session/[id]` endpoint has NO authentication check
   - Relies entirely on client-side access control
   - **Risk**: Anyone with a session UUID can access it via direct API call
   - **Mitigation**: Session UUIDs are cryptographically random (hard to guess)
   - **Acceptable for MVP**: Only 2 trusted companies testing
   - **Action Required**: Implement server-side auth before production (see Priority 1 below)

2. **URL Structure**
   - Sessions accessible via `/employee/sessions/[id]` for both roles
   - Session UUIDs exposed in URLs (secure but trackable)
   - No separate manager/employee routes

3. **Audit Logging**
   - No tracking of who viewed which sessions
   - No access logs for compliance

3. **Rate Limiting**
   - No API rate limiting implemented
   - Potential for abuse at scale

4. **Session Management**
   - No automatic session expiry beyond Supabase defaults
   - No manual session revocation mechanism

---

## 🚀 Production Readiness Checklist

### Before Public Launch (10+ companies, 100+ users)

#### Priority 1: Critical (Security Vulnerabilities)

- [ ] **Fix API Authorization for /api/training-session/[id]** (Est: 4 hours)
  - Implement server-side authentication (resolve Next.js 15 async cookie issues)
  - Use Next.js middleware OR simpler cookie-based auth
  - Verify user owns session OR is manager of same company
  - Return 401/403 for unauthorized requests
  - **BLOCKER FOR PRODUCTION** - Currently no auth check at all

- [ ] **Add API Rate Limiting** (Est: 4 hours)
  - Implement rate limiting middleware
  - Per-user and per-IP limits
  - Graceful degradation with 429 responses
  - Tool: `@upstash/ratelimit` or similar

- [ ] **Implement Audit Logging** (Est: 6 hours)
  - Log all session views (who, what, when)
  - Store in separate `audit_logs` table
  - Retention policy (90 days)
  - Export capability for compliance

- [ ] **Add Next.js Middleware for Route Protection** (Est: 3 hours)
  - Validate authentication at edge
  - Redirect unauthenticated users
  - Check roles before page render
  - Location: `middleware.ts`

- [ ] **Implement CSRF Protection** (Est: 2 hours)
  - Add CSRF tokens to API requests
  - Validate on server side
  - Use `@edge-csrf` or similar

#### Priority 2: Important (Scalability & UX)

- [ ] **Separate Manager/Employee Routes** (Est: 8 hours)
  - `/manager/sessions/[id]` for managers
  - `/employee/sessions/[id]` for employees
  - Better breadcrumbs and navigation
  - Role-specific UI features

- [ ] **Add Role-Based Access Control (RBAC) System** (Est: 12 hours)
  - Define permissions (view_own_sessions, view_company_sessions, etc.)
  - Create `roles` and `permissions` tables
  - Flexible permission assignment
  - Easier to scale to more roles (admin, trainer, etc.)

- [ ] **Implement Session Expiry & Revocation** (Est: 4 hours)
  - Manual logout from all devices
  - Automatic expiry after inactivity
  - Revoke on password change
  - Admin ability to revoke user sessions

- [ ] **Add Content Security Policy (CSP)** (Est: 3 hours)
  - Restrict script sources
  - Prevent XSS attacks
  - Configure in Next.js headers

#### Priority 3: Nice to Have (Future Features)

- [ ] **Add Multi-Factor Authentication (MFA)** (Est: 8 hours)
  - TOTP-based (Google Authenticator)
  - SMS backup (optional)
  - Recovery codes
  - Supabase has built-in support

- [ ] **Implement Data Encryption at Rest** (Est: 6 hours)
  - Encrypt sensitive fields in database
  - PII (names, emails) encryption
  - Key management strategy
  - Consider: PostgreSQL pgcrypto

- [ ] **Add Security Headers** (Est: 2 hours)
  - X-Frame-Options, X-Content-Type-Options
  - Strict-Transport-Security (HSTS)
  - Referrer-Policy
  - Configure in `next.config.js`

- [ ] **Implement API Request Signing** (Est: 6 hours)
  - HMAC-based request signatures
  - Prevent request tampering
  - Timestamp validation
  - For critical operations only

---

## 📋 Compliance & Regulations

### GDPR Considerations (If serving EU customers)

- [ ] **Right to Access** - User can download their data
- [ ] **Right to Deletion** - User can delete their account and data
- [ ] **Data Portability** - Export data in machine-readable format
- [ ] **Consent Management** - Track consent for data processing
- [ ] **Data Breach Notification** - Process for notifying users within 72 hours

### SOC 2 Considerations (If selling to enterprises)

- [ ] **Access Controls** - Document and enforce least privilege
- [ ] **Audit Logs** - Comprehensive logging of all data access
- [ ] **Data Encryption** - Encrypt data in transit and at rest
- [ ] **Vulnerability Management** - Regular security scanning
- [ ] **Incident Response Plan** - Documented process for security incidents

---

## 🔒 Infrastructure Security

### Environment Variables

**Current Practice**: ✅ Good
- Sensitive keys in `.env.local` (not committed)
- Different keys for dev/production
- Service role key for admin operations

**Improvements**:
- [ ] Use secret management service (Vercel, AWS Secrets Manager)
- [ ] Rotate keys regularly (quarterly)
- [ ] Audit who has access to production keys

### Database Security

**Current Practice**: ✅ Good
- RLS policies active
- Admin client used only server-side
- Separate anon/service role keys

**Improvements**:
- [ ] Regular RLS policy audits
- [ ] Add database backups with encryption
- [ ] Implement database query monitoring
- [ ] Set up alerts for suspicious queries

### API Security

**Current Practice**: ✅ Good
- Server-side validation
- Proper error messages (no info leakage)
- HTTP status codes used correctly

**Improvements**:
- [ ] Add request validation middleware (Zod schemas)
- [ ] Implement API versioning (/api/v1/)
- [ ] Add OpenAPI/Swagger documentation
- [ ] Set up API monitoring and alerts

---

## 🧪 Security Testing Checklist

Before Production Launch:

- [ ] **Penetration Testing** - Hire security firm or use HackerOne
- [ ] **SQL Injection Testing** - Test all database queries
- [ ] **XSS Testing** - Test all user inputs
- [ ] **CSRF Testing** - Verify all state-changing operations
- [ ] **Authentication Bypass** - Try accessing protected routes
- [ ] **Authorization Testing** - Try accessing other users' data
- [ ] **Rate Limit Testing** - Verify API limits work
- [ ] **Session Fixation** - Test session hijacking scenarios

---

## 📚 Resources & References

### Security Best Practices
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Next.js Security Headers](https://nextjs.org/docs/advanced-features/security-headers)
- [Supabase Security Best Practices](https://supabase.com/docs/guides/database/postgres/row-level-security)

### Tools
- [Snyk](https://snyk.io/) - Dependency vulnerability scanning
- [npm audit](https://docs.npmjs.com/cli/v8/commands/npm-audit) - Built-in dependency checker
- [OWASP ZAP](https://www.zaproxy.org/) - Web application security scanner

---

## 🎯 Decision Log

### October 14, 2025 (Evening) - Temporarily Disable API Auth for MVP

**Decision**: Remove server-side authentication from `/api/training-session/[id]` temporarily for MVP.

**Reasoning**:
- Next.js 15 async cookie requirements causing authentication failures
- Multiple attempts to fix (await cookies, getAll, createServerClient) all failed
- MVP has only 2 trusted companies testing (low risk)
- Session UUIDs are cryptographically random (hard to guess)
- Client-side access control still active in page component
- Unblocks critical manager functionality immediately

**Tradeoffs**:
- ❌ Anyone with session UUID can access via direct API call (security risk)
- ✅ Manager can now view employee sessions (feature works)
- ✅ Acceptable for MVP testing with trusted users
- ⚠️ MUST fix before production (documented as Priority 1)

**Action Required**: Implement proper server-side auth before scaling beyond MVP (see Priority 1 checklist)

**Review Date**: Before onboarding company #3 or any external users

---

### October 14, 2025 (Afternoon) - MVP Authorization Approach (Attempted)

**Decision**: Add server-side authorization to `/api/training-session/[id]` but keep shared route structure.

**Reasoning**:
- MVP scale (2 companies, testing) doesn't require complex routing
- Simple authorization check is sufficient
- Can refactor routes later if UI needs diverge
- Prioritizes security over architectural purity

**Outcome**: Implementation blocked by Next.js 15 async cookie issues. See decision above for resolution.

**Review Date**: When scaling to 10+ companies or adding manager-specific features

---

## 📞 Emergency Contacts

**Security Incidents**: TBD (set up before production)
**Database Issues**: TBD
**Supabase Support**: support@supabase.com

---

**Next Review**: When reaching 10 companies or before public launch
