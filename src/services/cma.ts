/**
 * cma.ts — Integration API CMA-CGM Track & Trace
 *
 * Pattern identique a dpworld.ts : appel via Worker Cloudflare proxy
 * (cma-proxy.ozmanm10.workers.dev) qui detient la cle API en secret.
 *
 * Quota CMA strict : 20 appels/heure. Le Worker cache 1h + rate limit
 * 3min/BL. Cote client : on ne fait JAMAIS de Sync All auto pour CMA.
 */

// URL Worker — modifiable via setCMAProxy() pour tests ou dev local
var PROXY_URL = 'https://cma-proxy.ozmanm10.workers.dev';

export function setCMAProxy(url: string): void {
  PROXY_URL = url;
}

export interface CMAResponse {
  ok: boolean;
  data?: any;
  error?: string;
  detail?: string;
  cached?: boolean;
  cacheAge?: number;
  rateLimited?: boolean;
  fetchedAt?: number;
}

/**
 * Appel Track & Trace par BL ou n° TC. Le Worker normalise la reponse.
 */
export async function fetchCMA(query: { bl?: string; container?: string }): Promise<CMAResponse> {
  if (!query.bl && !query.container) {
    return { ok: false, error: 'bl ou container requis' };
  }
  var ctrl = new AbortController();
  var timer = setTimeout(function () { ctrl.abort(); }, 20000);
  try {
    var params = new URLSearchParams();
    if (query.bl) params.set('bl', query.bl);
    if (query.container) params.set('container', query.container);
    var url = PROXY_URL + '?' + params.toString();
    var res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok && res.status !== 502) {
      return { ok: false, error: 'Worker HTTP ' + res.status };
    }
    var json = await res.json();
    return json as CMAResponse;
  } catch (e: any) {
    clearTimeout(timer);
    if (e && e.name === 'AbortError') return { ok: false, error: 'CMA: timeout (20s)' };
    return { ok: false, error: 'Reseau: ' + (e.message || 'inconnu') };
  }
}

// Normalisation : extraire les infos utiles depuis la reponse CMA brute
// La structure exacte de la reponse CMA peut varier — on essaie plusieurs
// chemins courants (containerStatuses, items, data.containers, etc.).

interface CmaContainer {
  number?: string;       // ex: TGHU6321812
  type?: string;         // ex: 40HC
  status?: string;       // ex: "On board" / "Discharged" / etc.
  events?: CmaEvent[];   // historique evenements
}

interface CmaEvent {
  date?: string;        // ISO 8601
  type?: string;        // ex: "GATE_OUT" / "LOAD" / "DISCHARGE" / "DELIVERY"
  location?: string;    // ex: "DAKAR (SN)"
}

function extractContainersFromCMA(raw: any): CmaContainer[] {
  if (!raw) return [];

  // Format possible 1 : { containers: [...] }
  if (Array.isArray(raw.containers)) return raw.containers;

  // Format possible 2 : { data: { containers: [...] } }
  if (raw.data && Array.isArray(raw.data.containers)) return raw.data.containers;

  // Format possible 3 : { items: [...] }
  if (Array.isArray(raw.items)) return raw.items;

  // Format possible 4 : { containerStatuses: [...] }
  if (Array.isArray(raw.containerStatuses)) return raw.containerStatuses;

  // Format possible 5 : reponse direct array
  if (Array.isArray(raw)) return raw;

  // Format possible 6 : { TransportDocument: { Containers: [...] } } (style ancien CMA)
  if (raw.TransportDocument && Array.isArray(raw.TransportDocument.Containers)) {
    return raw.TransportDocument.Containers;
  }

  return [];
}

function normalizeContainerNumber(c: any): string {
  return String(c.number || c.containerNumber || c.containerId || c.id || c.ContainerNumber || '').toUpperCase().trim();
}

function normalizeContainerStatus(c: any): string {
  return String(c.status || c.statusCode || c.currentStatus || c.Status || '').toUpperCase();
}

function normalizeEvents(c: any): CmaEvent[] {
  var raw = c.events || c.history || c.statusHistory || c.Events || [];
  if (!Array.isArray(raw)) return [];
  return raw.map(function (e: any): CmaEvent {
    return {
      date: e.date || e.eventDate || e.timestamp || e.Date || '',
      type: String(e.type || e.eventType || e.code || e.Type || '').toUpperCase(),
      location: e.location || e.locationName || e.place || e.Location || '',
    };
  });
}

/**
 * Mapping CMA -> patches Sapurai (meme contrat que mapDPWorldToPatches).
 *
 * Regles :
 *  - Ne JAMAIS ecraser un champ deja renseigne (sauf si l'info CMA est plus
 *    recente, comme la date BAD chez DPWorld).
 *  - Pour les TCs : matcher par numero conteneur normalise.
 */

interface TcUpdate {
  id: string;
  st?: string;
  dsp?: string;
  dtk?: string;
  dak?: string;
  dab?: string;
  dr?: string;
}

interface CMAPatches {
  dosPatches: Record<string, any>;
  tcUpdates: TcUpdate[];
  summary: string;
  changes: string[];
}

function norm(s: string): string {
  return (s || '').replace(/[\s\-]/g, '').toUpperCase().trim();
}

// Mapping evenement CMA -> statut Sapurai
function eventToStatus(eventType: string): string | null {
  var t = (eventType || '').toUpperCase();
  // Discharge = decharge au port destination
  if (t.indexOf('DISCHARGE') >= 0 || t.indexOf('DEBARQ') >= 0) return 'PORT';
  // Gate out / Delivery / Pick up = sortie du port
  if (t.indexOf('GATE_OUT') >= 0 || t.indexOf('GATE OUT') >= 0 || t.indexOf('PICK') >= 0) return 'DISPATCHE';
  // Empty return / Empty back = retour vide
  if (t.indexOf('EMPTY') >= 0 || t.indexOf('RETURN') >= 0) return 'RETURNED';
  return null;
}

export function mapCMAToPatches(cmaRaw: any, dosTcs: any[], dos: any): CMAPatches {
  var dosPatches: Record<string, any> = {};
  var tcUpdates: TcUpdate[] = [];
  var changes: string[] = [];

  var cmaContainers = extractContainersFromCMA(cmaRaw);

  // 1. Date arrivee (da) : prendre le premier evenement DISCHARGE le plus tot
  if (!dos.da) {
    var earliestDischarge: string | null = null;
    cmaContainers.forEach(function (c: any) {
      var events = normalizeEvents(c);
      events.forEach(function (e) {
        if (e.type && (e.type.indexOf('DISCHARGE') >= 0 || e.type.indexOf('DEBARQ') >= 0) && e.date) {
          var d = e.date.split('T')[0];
          if (!earliestDischarge || d < earliestDischarge) earliestDischarge = d;
        }
      });
    });
    if (earliestDischarge) {
      dosPatches.da = earliestDischarge;
      changes.push('Date arrivee ' + earliestDischarge + ' (CMA)');
    }
  }

  // 2. TCs : matcher par numero conteneur
  cmaContainers.forEach(function (cmaTc: any) {
    var cmaNum = normalizeContainerNumber(cmaTc);
    if (!cmaNum) return;
    var match = dosTcs.find(function (tc) { return norm(tc.n) === cmaNum; });
    if (!match) return;

    var events = normalizeEvents(cmaTc);
    var sortedEvents = events.slice().sort(function (a, b) {
      return (a.date || '') < (b.date || '') ? -1 : 1;
    });

    // Statut le plus recent qui mappe vers un statut Sapurai
    var latestStatus: string | null = null;
    var latestStatusDate: string | null = null;
    sortedEvents.forEach(function (e) {
      var s = eventToStatus(e.type || '');
      if (s) {
        latestStatus = s;
        latestStatusDate = e.date ? e.date.split('T')[0] : null;
      }
    });

    if (latestStatus && latestStatus !== match.st) {
      var update: TcUpdate = { id: match.id, st: latestStatus };
      // Si on passe a DISPATCHE et qu'on a la date, l'inscrire
      if (latestStatus === 'DISPATCHE' && latestStatusDate && !match.dsp) {
        update.dsp = latestStatusDate;
      }
      // Si on passe a RETURNED et qu'on a la date
      if (latestStatus === 'RETURNED' && latestStatusDate && !match.dr) {
        update.dr = latestStatusDate;
      }
      tcUpdates.push(update);
      changes.push((match.n || '?') + ' -> ' + latestStatus + ' (CMA)');
    }
  });

  var summary = changes.length > 0
    ? changes.length + ' maj CMA: ' + changes.slice(0, 3).join(', ') + (changes.length > 3 ? '...' : '')
    : 'Aucune nouveaute CMA';

  return { dosPatches: dosPatches, tcUpdates: tcUpdates, summary: summary, changes: changes };
}
