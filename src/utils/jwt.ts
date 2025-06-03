import { createHmac } from 'crypto';

interface JwtOptions {
  expiresIn?: string | number;
}

function base64url(input: Buffer | string) {
  return Buffer.from(input).toString('base64url');
}

function parseExpiry(val: string): number {
  const match = val.match(/^(\d+)([smhd])$/);
  if (!match) throw new Error('Invalid expiresIn format');
  const num = parseInt(match[1], 10);
  switch (match[2]) {
    case 's': return num;
    case 'm': return num * 60;
    case 'h': return num * 3600;
    case 'd': return num * 86400;
    default: throw new Error('Invalid expiresIn unit');
  }
}

export function signJwt(payload: Record<string, any>, secret: string, options: JwtOptions = {}): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const iat = Math.floor(Date.now() / 1000);
  const fullPayload: Record<string, any> = { ...payload, iat };
  if (options.expiresIn) {
    const expSeconds = typeof options.expiresIn === 'string' ? parseExpiry(options.expiresIn) : options.expiresIn;
    fullPayload.exp = iat + expSeconds;
  }
  const headerPart = base64url(JSON.stringify(header));
  const payloadPart = base64url(JSON.stringify(fullPayload));
  const signature = createHmac('sha256', secret)
    .update(`${headerPart}.${payloadPart}`)
    .digest('base64url');
  return `${headerPart}.${payloadPart}.${signature}`;
}

export function verifyJwt<T = any>(token: string, secret: string): T {
  const [headerB64, payloadB64, signature] = token.split('.');
  const expected = createHmac('sha256', secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest('base64url');
  if (expected !== signature) throw new Error('Invalid signature');
  const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expired');
  }
  return payload as T;
}
