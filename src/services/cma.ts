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

/**
 * Format DCSA v2.2.0 (CMA Track & Trace v1) :
 * data: [
 *   {
 *     eventType: "EQUIPMENT" | "TRANSPORT" | "SHIPMENT",
 *     eventClassifierCode: "ACT" (actual) | "EST" (estimated) | "PLN" (planned),
 *     eventDateTime: "2026-02-16T11:10:00+08:00",
 *     equipmentReference: "TGHU1234567",        // n° TC (events EQUIPMENT)
 *     ISOEquipmentCode?: "22G1" | "45G1" | ...,  // type TC ISO (22G1=20GP, 45G1=40HC)
 *     carrierSpecificData: {
 *       internalEventCode: "IDF" | "POD" | ...,
 *       internalEventLabel: "Discharged" | "Loaded on" | "Empty returned" | ...
 *     },
 *     transportCall: {
 *       UNLocationCode: "CNNBO" | "SNDKR" | ...,  // port (SNDKR = Dakar)
 *       transportationPhase: "Import" | "Transhipment" | "Export"
 *     }
 *   }
 * ]
 */

// ISO container code -> type Sapurai
var ISO_TO_TYPE: Record<string, string> = {
  "22G1": "20GP", "22G0": "20GP",
  "42G1": "40GP", "42G0": "40GP",
  "45G1": "40HC", "45G0": "40HC",
  "L5G1": "45HC",
  "22R1": "20RF", "42R1": "40RF", "45R1": "40HCRF",
};

function isoToType(iso: string | undefined): string {
  if (!iso) return "20GP";
  return ISO_TO_TYPE[iso] || iso;
}

function extractDCSAEvents(raw: any): any[] {
  if (Array.isArray(raw)) return raw;
  if (raw && Array.isArray(raw.data)) return raw.data;
  if (raw && Array.isArray(raw.events)) return raw.events;
  return [];
}

/**
 * Mapping format DCSA v2.2.0.
 * - Parcourt les events EQUIPMENT pour extraire la liste des TC uniques (ISO -> type).
 * - Date arrivee = dernier event "Discharged" en transportationPhase "Import"
 *   (= decharge a destination). Si pas trouve, prend le dernier "Discharged" tout court.
 * - Pour chaque TC du dossier : si event Discharged Import -> st = PORT.
 */
function mapDCSAEvents(events: any[], dosTcs: any[], dos: any): CMAPatches {
  var dosPatches: Record<string, any> = {};
  var tcUpdates: TcUpdate[] = [];
  var changes: string[] = [];

  // Index par n° TC (equipmentReference)
  var byTc: Record<string, any[]> = {};
  events.forEach(function (e: any) {
    var ref = String(e.equipmentReference || '').toUpperCase();
    if (ref) {
      if (!byTc[ref]) byTc[ref] = [];
      byTc[ref].push(e);
    }
  });

  // Helper : detecte un event d'arrivee a destination, au sens large.
  // Inclut TRANSPORT.ARRI (arrivee navire), EQUIPMENT.DISC (decharge TC), et
  // les labels/codes internes CMA. Sur le portail CMA, "ARRIVEE DU NAVIRE" est
  // un TRANSPORT.ARRI et non un EQUIPMENT.DISC : si on filtre uniquement sur
  // "Discharged" on rate la date affichee comme ETA officielle.
  function isDischarged(e: any): boolean {
    var lbl = String(e.carrierSpecificData?.internalEventLabel || '').toLowerCase();
    var code = String(e.carrierSpecificData?.internalEventCode || '').toUpperCase();
    var transportCode = String(e.transportEventTypeCode || '').toUpperCase();
    var equipCode = String(e.equipmentEventTypeCode || '').toUpperCase();
    if (transportCode === 'ARRI') return true;
    if (equipCode === 'DISC' || equipCode === 'DCHA') return true;
    if (lbl.indexOf('discharg') >= 0) return true;
    if (lbl.indexOf('arriv') >= 0 && lbl.indexOf('depart') < 0) return true;
    if (lbl.indexOf('debarqu') >= 0) return true;
    if (code === 'IDF' || code === 'POD' || code === 'ARR' || code === 'ARRI' || code === 'DIS' || code === 'DISC') return true;
    return false;
  }

  function isImportPhase(e: any): boolean {
    var phase = String(e.transportCall?.transportationPhase || '').toLowerCase();
    return phase === 'import';
  }

  // Filtre port destination Dakar (DKR) : evite les BL multi-imports rares
  function isDakar(e: any): boolean {
    var loc = e.transportCall?.location;
    if (!loc) return false;
    var unCode = String(loc.UNLocationCode || '').toUpperCase();
    if (unCode === 'SNDKR' || unCode === 'DKR') return true;
    var name = String(loc.locationName || '').toLowerCase();
    return name.indexOf('dakar') >= 0;
  }

  function isLoaded(e: any): boolean {
    var lbl = String(e.carrierSpecificData?.internalEventLabel || '').toLowerCase();
    return lbl.indexOf('load') >= 0;
  }

  function isEmptyReturn(e: any): boolean {
    var lbl = String(e.carrierSpecificData?.internalEventLabel || '').toLowerCase();
    return lbl.indexOf('empty') >= 0 && (lbl.indexOf('return') >= 0 || lbl.indexOf('back') >= 0);
  }

  function isGateOut(e: any): boolean {
    var lbl = String(e.carrierSpecificData?.internalEventLabel || '').toLowerCase();
    var code = String(e.carrierSpecificData?.internalEventCode || '').toUpperCase();
    return lbl.indexOf('gate out') >= 0 || lbl.indexOf('pick') >= 0 || code === 'OUT' || code === 'GTOUT';
  }

  // 1. Date arrivee : l'armateur fait foi (comme DPWorld). On prend TOUJOURS
  // la date renvoyee par l'API, qu'elle soit deja posee ou non.
  // Priorite ACT Dakar > EST Dakar > ACT Import > EST Import > tout Import > tout Discharged.
  // L'ETA (estime) est conserve pour anticiper meme si le TC n'est pas encore arrive.
  {
    function classifier(e: any): string {
      return String(e.eventClassifierCode || '').toUpperCase();
    }
    var actDakar = events.filter(function (e: any) { return isDischarged(e) && isImportPhase(e) && isDakar(e) && classifier(e) === 'ACT'; });
    var estDakar = events.filter(function (e: any) { return isDischarged(e) && isImportPhase(e) && isDakar(e) && (classifier(e) === 'EST' || classifier(e) === 'PLN'); });
    var actImport = events.filter(function (e: any) { return isDischarged(e) && isImportPhase(e) && classifier(e) === 'ACT'; });
    var estImport = events.filter(function (e: any) { return isDischarged(e) && isImportPhase(e) && (classifier(e) === 'EST' || classifier(e) === 'PLN'); });
    var anyImport = events.filter(function (e: any) { return isDischarged(e) && isImportPhase(e); });
    var anyDisch = events.filter(isDischarged);
    var pool = actDakar.length > 0 ? actDakar
      : estDakar.length > 0 ? estDakar
      : actImport.length > 0 ? actImport
      : estImport.length > 0 ? estImport
      : anyImport.length > 0 ? anyImport
      : anyDisch;
    if (pool.length > 0) {
      pool.sort(function (a: any, b: any) {
        return (a.eventDateTime || '') < (b.eventDateTime || '') ? 1 : -1;
      });
      var dt = String(pool[0].eventDateTime || '').split('T')[0];
      if (dt) {
        // ETA si event estime (EST/PLN) Dakar ou Import. Source CMA notee dans le summary.
        var isEta = pool === estDakar || pool === estImport;
        if (!dos.da) {
          dosPatches.da = dt;
          dosPatches.daSrc = 'cma';
          changes.push((isEta ? 'ETA' : 'Date arrivee') + ' ' + dt + ' (CMA)');
        } else if (dos.da !== dt) {
          dosPatches.da = dt;
          dosPatches.daSrc = 'cma';
          changes.push((isEta ? 'ETA maj ' : 'Date arrivee maj ') + dos.da + ' → ' + dt + ' (CMA)');
        }
        // Sinon (meme date) : rien a logger
      }
    }
  }

  // 2. TCs : matcher avec ceux du dossier + ajouter ceux qu'on ne connait pas
  Object.keys(byTc).forEach(function (tcRef) {
    var tcEvents = byTc[tcRef];
    var match = dosTcs.find(function (tc: any) {
      return String(tc.n || '').toUpperCase().replace(/[\s\-]/g, '') === tcRef.replace(/[\s\-]/g, '');
    });
    if (!match) return;  // TC absent du dossier : on signale via newTcs cote service

    // Determiner le statut le plus avance + dates
    var sortedEvts = tcEvents.slice().sort(function (a: any, b: any) {
      return (a.eventDateTime || '') < (b.eventDateTime || '') ? -1 : 1;
    });

    var update: TcUpdate = { id: match.id };
    sortedEvts.forEach(function (e: any) {
      var dt = String(e.eventDateTime || '').split('T')[0];
      if (isDischarged(e) && isImportPhase(e) && match.st === 'ATTENDU') {
        update.st = 'PORT';
      }
      if (isGateOut(e) && (match.st === 'PORT' || match.st === 'ATTENDU')) {
        update.st = 'DISPATCHE';
        if (dt && !match.dsp) update.dsp = dt;
      }
      if (isEmptyReturn(e)) {
        update.st = 'RETURNED';
        if (dt && !match.dr) update.dr = dt;
      }
    });

    if (update.st) {
      tcUpdates.push(update);
      changes.push((match.n || '?') + ' -> ' + update.st + ' (CMA)');
    }
  });

  var summary = changes.length > 0
    ? changes.length + ' maj CMA : ' + changes.slice(0, 3).join(', ') + (changes.length > 3 ? '...' : '')
    : 'Aucune nouveaute CMA';

  return { dosPatches: dosPatches, tcUpdates: tcUpdates, summary: summary, changes: changes };
}

export function mapCMAToPatches(cmaRaw: any, dosTcs: any[], dos: any): CMAPatches {
  var dosPatches: Record<string, any> = {};
  var tcUpdates: TcUpdate[] = [];
  var changes: string[] = [];

  // Detection format : DCSA v2.2.0 (events array) ou ancien format (containers)
  var events = extractDCSAEvents(cmaRaw);
  if (events.length > 0 && events[0].eventType !== undefined) {
    // === Format DCSA v2.2.0 ===
    return mapDCSAEvents(events, dosTcs, dos);
  }

  // Fallback : ancien format (containers/events imbriques) — garde pour compat
  var cmaContainers = extractContainersFromCMA(cmaRaw);

  // 1. Date arrivee (da) : prendre le premier evenement DISCHARGE le plus tot
  if (!dos.da) {
    var earliestDischarge: string | null = null;
    cmaContainers.forEach(function (c: any) {
      var oldEvents = normalizeEvents(c);
      oldEvents.forEach(function (e) {
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
