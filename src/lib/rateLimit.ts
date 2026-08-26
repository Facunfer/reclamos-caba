// Rate limit simple en memoria para el login público.
// Vive por instancia de proceso (PM2 fork mode = un solo proceso), no es
// compartido ni persistente: se resetea si la app reinicia. Suficiente para
// encarecer un ataque de fuerza bruta contra el gate de /public.

const WINDOW_MS = 15 * 60 * 1000; // 15 min
const MAX_ATTEMPTS = 5;

const attempts = new Map<string, { count: number; resetAt: number }>();

export function isRateLimited(key: string): boolean {
  const rec = attempts.get(key);
  if (!rec || Date.now() > rec.resetAt) return false;
  return rec.count >= MAX_ATTEMPTS;
}

export function registerFailedAttempt(key: string): void {
  const now = Date.now();
  const rec = attempts.get(key);
  if (!rec || now > rec.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    rec.count += 1;
  }
}

export function clearAttempts(key: string): void {
  attempts.delete(key);
}

export function getClientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}
