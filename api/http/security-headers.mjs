/** Defaults for every response; specialized pages may supply a stricter CSP. */
export function applySecurityHeaders(response) {
  response.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
}
