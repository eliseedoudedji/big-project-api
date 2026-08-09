import { Injectable, Logger } from '@nestjs/common';

export type GeoResult = {
  ip: string;
  countryCode: string;
  countryName: string;
  timezone: string | null;
  utcOffset: number | null;
  vpn: boolean;
  vpnReason: string | null;
};

export type ClientInfo = {
  utcOffset?: number | null;
  timezone?: string | null;
  lang?: string | null;
};

const VPN_OFFSET_TOLERANCE_SEC = 3600;

const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.length > 0 ? v : undefined;

export function normalizeIp(raw: string | undefined | null): string {
  let ip = (raw ?? '').trim();
  if (!ip) return 'unknown';
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  if (ip === '::1') ip = '127.0.0.1';
  return ip;
}

export function clientIpOf(
  ip: string,
  forwardedFor?: string | string[] | null,
): string {
  let forwarded = forwardedFor;
  if (Array.isArray(forwarded)) forwarded = forwarded[0];
  if (typeof forwarded === 'string' && forwarded.trim().length > 0) {
    const first = forwarded.split(',')[0]?.trim();
    if (first && first !== 'unknown') {
      const normalized = normalizeIp(first);
      if (normalized !== '127.0.0.1' && normalized !== 'unknown') {
        return normalized;
      }
    }
  }
  return normalizeIp(ip);
}

function isPrivateOrLoopback(ip: string): boolean {
  if (ip === 'unknown' || ip === '127.0.0.1' || ip === '::1') return true;
  if (ip.includes(':')) {
    const lower = ip.toLowerCase();
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
    if (lower.startsWith('fe80')) return true;
    return false;
  }
  const parts = ip.split('.').map(Number);
  if (
    parts.length !== 4 ||
    parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)
  ) {
    return true;
  }
  const [a, b] = parts;
  if (a === 0) return true;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

function tzOffsetSeconds(timeZone: string, now = new Date()): number | null {
  try {
    const dtf = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const parts = dtf.formatToParts(now);
    const get = (type: string) =>
      Number(parts.find((p) => p.type === type)?.value ?? 0);
    const asUtc = Date.UTC(
      get('year'),
      get('month') - 1,
      get('day'),
      get('hour'),
      get('minute'),
      get('second'),
    );
    return Math.round((asUtc - now.getTime()) / 1000);
  } catch {
    return null;
  }
}

function parseUtcOffsetStr(value: string): number | null {
  const m = value.match(/^([+-])(\d{2}):(\d{2})$/);
  if (m) {
    return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 3600 + Number(m[3]) * 60);
  }
  const n = Number(value);
  if (Number.isFinite(n) && Math.abs(n) <= 86400) return n;
  return null;
}

function ipOffsetSeconds(data: Record<string, unknown>): number | null {
  const tz = data.timezone;
  if (tz && typeof tz === 'object') {
    const t = tz as Record<string, unknown>;
    if (typeof t.offset === 'number') return t.offset;
    const u = str(t.utc);
    if (u) {
      const parsed = parseUtcOffsetStr(u);
      if (parsed !== null) return parsed;
    }
  }
  const utcOffset = str(data.utc_offset);
  if (utcOffset) {
    const parsed = parseUtcOffsetStr(utcOffset);
    if (parsed !== null) return parsed;
  }
  if (typeof tz === 'string' && tz.length > 0) {
    return tzOffsetSeconds(tz);
  }
  return null;
}

function ipTimezoneId(data: Record<string, unknown>): string | null {
  const tz = data.timezone;
  if (tz && typeof tz === 'object')
    return str((tz as Record<string, unknown>).id) ?? null;
  if (typeof tz === 'string' && tz.length > 0) return tz;
  return null;
}

function hasTimezoneMismatch(
  data: Record<string, unknown>,
  client: ClientInfo,
): boolean {
  if (client.utcOffset !== null && client.utcOffset !== undefined) {
    const ipOffset = ipOffsetSeconds(data);
    if (
      ipOffset !== null &&
      Math.abs(ipOffset - client.utcOffset) > VPN_OFFSET_TOLERANCE_SEC
    ) {
      return true;
    }
  }
  if (client.timezone) {
    const ipTz = ipTimezoneId(data);
    if (ipTz && ipTz !== client.timezone) return true;
  }
  return false;
}

const VPN_PROVIDER_KEYWORDS = [
  'nordvpn',
  'expressvpn',
  'surfshark',
  'cyberghost',
  'ipvanish',
  'windscribe',
  'tunnelbear',
  'mullvad',
  'privateinternetaccess',
  'protonvpn',
  'proton vpn',
  'pia',
  'vyprvpn',
  'hide.me',
  'hideipvpn',
  'torguard',
  'purevpn',
  'zoogvpn',
  'ivacy',
  'vpnunlimited',
  'safervpn',
  'keepsolid',
  'hotspot shield',
  'hotspotshield',
  'private vpn',
  'megaproxy',
  'spartanvpn',
  'torvpn',
  'anonymox',
  'betternet',
  'touchvpn',
  'zenmate',
  'hola vpn',
  'spongebob vpn',
  'opnvpn',
  'private tunnel',
  'privatevpn',
  'vpnsecure',
  'virginia vpn',
  'cloudflarewarp',
];

const HOSTING_KEYWORDS = [
  'digitalocean',
  'linode',
  'vultr',
  'hetzner',
  'ovh',
  'contabo',
  'scaleway',
  'leaseweb',
  'm247',
  'choopa',
  'psychz',
  'mcore',
  'zenlayer',
  'cogent',
  'hostwinds',
  'kamatera',
  'voxility',
  'quic.cloud',
  'amazonaws',
  'amazon cloudfront',
  'amazon web services',
  'azure',
  'microsoft azure',
  'google cloud',
  'googleusercontent',
  'gcp',
  'oracle cloud',
  'ibm cloud',
  'fastly',
  'cloudflare',
  'akamai',
  'incapsula',
  'imperva',
  'sucuri',
  'datacamp',
  'hostinger',
  'namecheap',
  'bluehost',
  'siteground',
  'dreamhost',
  'a2hosting',
  '1gb.ua',
  'datahata',
  'gcore',
  'time4vps',
  'ionos',
  '1984',
  'mevspace',
  'veesp',
  'aruba',
  'stark industries',
  'ovhcloud',
];

const EXPLICIT_FLAG_KEYS = new Set([
  'vpn',
  'proxy',
  'tor',
  'relay',
  'anonymous',
  'isvpn',
  'isproxy',
  'istor',
  'isrelay',
  'isanonymous',
]);

const HOSTING_FLAG_KEYS = new Set([
  'hosting',
  'datacenter',
  'isdatacenter',
  'ishosting',
]);

function collectFlags(data: Record<string, unknown>): {
  explicit: string[];
  hosting: string[];
} {
  const explicit: string[] = [];
  const hosting: string[] = [];
  const walk = (obj: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(obj)) {
      const normalized = key.toLowerCase().replace(/[^a-z]/g, '');
      if (value === true) {
        if (EXPLICIT_FLAG_KEYS.has(normalized)) explicit.push(normalized);
        if (HOSTING_FLAG_KEYS.has(normalized)) hosting.push(normalized);
      } else if (value && typeof value === 'object') {
        walk(value as Record<string, unknown>);
      }
    }
  };
  walk(data);
  return { explicit: [...new Set(explicit)], hosting: [...new Set(hosting)] };
}

function isCompanyHosting(data: Record<string, unknown>): boolean {
  const company = data.company;
  if (company && typeof company === 'object') {
    const type = str((company as Record<string, unknown>).type)?.toLowerCase();
    if (type === 'hosting' || type === 'datacenter') return true;
  }
  return false;
}

function connectionText(data: Record<string, unknown>): string {
  const parts: string[] = [];
  const push = (v: unknown) => {
    if (typeof v === 'string' && v.length > 0) parts.push(v);
  };
  const c = data.connection;
  if (c && typeof c === 'object') {
    const record = c as Record<string, unknown>;
    push(record.org);
    push(record.isp);
    push(record.domain);
    push(record.asn);
  }
  push(data.org);
  push(data.isp);
  push(data.domain);
  push(data.as);
  push(data.hostname);
  push(data.reverse);
  push(data.provider);
  push(data.organisation);
  return parts.join(' ').toLowerCase();
}

function detectTextSignals(data: Record<string, unknown>): {
  keyword: boolean;
  datacenter: boolean;
} {
  const text = connectionText(data);
  if (!text) return { keyword: false, datacenter: false };
  const tokens = new Set(text.split(/[^a-z0-9]+/).filter(Boolean));
  const explicit =
    tokens.has('vpn') || tokens.has('proxy') || tokens.has('tor');
  if (explicit) return { keyword: true, datacenter: false };
  if (VPN_PROVIDER_KEYWORDS.some((k) => text.includes(k))) {
    return { keyword: true, datacenter: false };
  }
  if (HOSTING_KEYWORDS.some((k) => text.includes(k))) {
    return { keyword: false, datacenter: true };
  }
  return { keyword: false, datacenter: false };
}

function extractCountryRegion(lang: string | null | undefined): string | null {
  if (!lang) return null;
  const primary = lang.split(',')[0]?.trim() ?? '';
  const m = primary.match(/^[a-zA-Z]{2,3}(?:-([a-zA-Z]{2}))?/);
  if (!m) return null;
  const region = m[1];
  if (region && /^[A-Za-z]{2}$/.test(region)) return region.toUpperCase();
  return null;
}

function hasLanguageMismatch(
  acceptLanguage: string | null | undefined,
  countryCode: string | null | undefined,
): boolean {
  if (!acceptLanguage || !countryCode) return false;
  const region = extractCountryRegion(acceptLanguage);
  if (!region) return false;
  return region !== countryCode.toUpperCase();
}

const EXPLICIT_REASONS: Record<string, string> = {
  vpn: 'vpn_flag',
  proxy: 'proxy_flag',
  tor: 'tor_flag',
  relay: 'relay_flag',
  anonymous: 'anonymous_flag',
  isvpn: 'vpn_flag',
  isproxy: 'proxy_flag',
  istor: 'tor_flag',
  isrelay: 'relay_flag',
  isanonymous: 'anonymous_flag',
};

type Raw = { ip?: string; countryCode?: string; countryName?: string };

const ENDPOINTS: {
  buildUrl: (ip: string) => string;
  parse: (data: Record<string, unknown>) => Raw;
}[] = [
  {
    buildUrl: (ip) => `https://ipwho.is/${ip}`,
    parse: (data) => ({
      ip: str(data.ip),
      countryCode: (str(data.country_code) ?? '').toUpperCase() || undefined,
      countryName: str(data.country),
    }),
  },
  {
    buildUrl: (ip) =>
      ip ? `https://ipinfo.io/${ip}/json` : `https://ipinfo.io/json`,
    parse: (data) => ({
      ip: str(data.ip),
      countryCode: (str(data.country) ?? '').toUpperCase() || undefined,
      countryName: undefined,
    }),
  },
  {
    buildUrl: (ip) =>
      `http://ip-api.com/json/${ip}?fields=status,message,countryCode,country,proxy,hosting,mobile,reverse,query,as,isp,org`,
    parse: (data) => ({
      ip: str(data.query) ?? str(data.ip),
      countryCode: (str(data.countryCode) ?? '').toUpperCase() || undefined,
      countryName: str(data.country),
    }),
  },
  {
    buildUrl: (ip) => `https://proxycheck.io/v2/${ip}?vpn=1&asn=1&inf=1`,
    parse: (data) => {
      const entry = Object.values(data).find(
        (v): v is Record<string, unknown> =>
          !!v &&
          typeof v === 'object' &&
          typeof (v as Record<string, unknown>).proxy === 'string',
      );
      const e = entry ?? {};
      return {
        ip: str(data.ip),
        countryCode: (str(e.isocode) ?? '').toUpperCase() || undefined,
        countryName: str(e.country),
      };
    },
  },
];

async function fetchWithTimeout(url: string, ms = 5000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

@Injectable()
export class GeoService {
  private readonly logger = new Logger(GeoService.name);

  async lookup(
    ip: string,
    client: ClientInfo = {},
    acceptLanguage?: string | null,
  ): Promise<GeoResult> {
    const requestedIp = normalizeIp(ip);
    const selfLookup = isPrivateOrLoopback(requestedIp);
    const lookupIp = selfLookup ? '' : requestedIp;

    const endpoints = selfLookup
      ? ENDPOINTS.filter((e) => !e.buildUrl('').includes('proxycheck.io'))
      : ENDPOINTS;

    const attempts = await Promise.all(
      endpoints.map((endpoint) =>
        fetchWithTimeout(endpoint.buildUrl(lookupIp))
          .then(async (res) => {
            if (!res.ok) throw new Error(`http ${res.status}`);
            const data = (await res.json()) as Record<string, unknown>;
            if (!data || data.success === false || data.status === 'fail') {
              throw new Error('payload invalide');
            }
            const parsed = endpoint.parse(data);
            if (!parsed.countryCode && !parsed.ip)
              throw new Error('payload vide');
            if (
              !selfLookup &&
              parsed.ip &&
              normalizeIp(parsed.ip) !== requestedIp
            ) {
              throw new Error('ip incohérente (source hors sujet)');
            }
            return { data, parsed };
          })
          .catch(() => null),
      ),
    );

    const valid = attempts.filter(
      (a): a is { data: Record<string, unknown>; parsed: Raw } => a !== null,
    );

    if (valid.length === 0) {
      this.logger.warn(`Aucune source géo disponible pour ${requestedIp}`);
      return {
        ip: requestedIp,
        countryCode: '',
        countryName: '',
        timezone: null,
        utcOffset: null,
        vpn: false,
        vpnReason: null,
      };
    }

    const primary = valid[0].parsed;
    const observedIp = normalizeIp(primary.ip) || requestedIp;
    let timezone: string | null = null;
    let utcOffset: number | null = null;
    for (const { data } of valid) {
      if (!timezone) timezone = ipTimezoneId(data);
      if (utcOffset === null) utcOffset = ipOffsetSeconds(data);
      if (timezone && utcOffset !== null) break;
    }
    const reasons: string[] = [];

    for (const { data } of valid) {
      const flags = collectFlags(data);
      if (flags.explicit.length > 0) {
        for (const f of flags.explicit)
          reasons.push(EXPLICIT_REASONS[f] ?? 'vpn_flag');
      }

      const isProxyCheckYes =
        data.status === 'ok' &&
        Object.values(data).some(
          (v) =>
            !!v &&
            typeof v === 'object' &&
            (v as Record<string, unknown>).proxy === 'yes',
        );
      if (isProxyCheckYes) reasons.push('proxycheck');

      const signals = detectTextSignals(data);
      if (signals.keyword) reasons.push('keywords');
      if (
        signals.datacenter ||
        flags.hosting.length > 0 ||
        isCompanyHosting(data)
      ) {
        reasons.push('datacenter');
      }

      if (hasTimezoneMismatch(data, client)) reasons.push('timezone');
    }

    const countryCode = primary.countryCode ?? '';
    const acceptLanguageStr = acceptLanguage || client.lang || null;
    if (hasLanguageMismatch(acceptLanguageStr, countryCode))
      reasons.push('language');

    const uniqueReasons = [...new Set(reasons)];

    let vpn = false;
    let vpnReason: string | null = null;
    if (
      uniqueReasons.some(
        (r) => r !== 'timezone' && r !== 'language' && r !== 'datacenter',
      )
    ) {
      vpn = true;
      vpnReason = uniqueReasons.join(',');
    } else if (
      uniqueReasons.filter(
        (r) => r === 'datacenter' || r === 'timezone' || r === 'language',
      ).length >= 2
    ) {
      vpn = true;
      vpnReason = uniqueReasons.join(',');
    }

    return {
      ip: observedIp,
      countryCode,
      countryName: primary.countryName ?? '',
      timezone,
      utcOffset,
      vpn,
      vpnReason,
    };
  }
}
