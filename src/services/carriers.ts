/**
 * carriers.ts — Sync armateur unifie (scraping + API officielle)
 *
 * Strategie : un seul bouton "Sync armateur" cote UI, qui :
 *  1. Detecte l'armateur depuis dos.cp ou prefixe BL
 *  2. Pour CMA : appelle cma-proxy (API officielle, donnees riches)
 *  3. Pour Maersk/MSC/Hapag/ONE/Grimaldi : appelle carrier-proxy (scraping HTML)
 *  4. Mappe le resultat vers les patches Sapurai (dos.da uniquement)
 *
 * Scope minimal : on ne recupere QUE la date d'arrivee, pas les events,
 * pas les statuts TC. Les BAD/BAE/Pregate continuent via Sync DPWorld.
 */

var CARRIER_PROXY_URL = 'https://carrier-proxy.ozmanm10.workers.dev';
var CMA_PROXY_URL = 'https://cma-proxy.ozmanm10.workers.dev';

export function setCarrierProxy(url: string): void { CARRIER_PROXY_URL = url; }
export function setCMAProxy(url: string): void { CMA_PROXY_URL = url; }

export type CarrierKey = 'cma' | 'maersk' | 'msc' | 'hapag' | 'one' | 'grimaldi' | null;

/**
 * Detecte l'armateur depuis cp (compagnie maritime du dossier) ou prefixe BL.
 * Synchrone car c'est juste de la regex.
 */
export function detectCarrier(bl: string, cp?: string): CarrierKey {
  var b = (bl || '').toUpperCase().trim();
  var h = (cp || '').toUpperCase();
  if (h.indexOf('CMA') >= 0) return 'cma';
  if (h.indexOf('MAERSK') >= 0) return 'maersk';
  if (h.indexOf('MSC') >= 0) return 'msc';
  if (h.indexOf('HAPAG') >= 0 || h.indexOf('HLAG') >= 0) return 'hapag';
  if (h.indexOf('GRIMALDI') >= 0) return 'grimaldi';
  if (h.indexOf('ONE') >= 0 || h.indexOf('OCEAN NETWORK') >= 0) return 'one';
  // Fallback prefixe BL
  if (/^MEDU/.test(b)) return 'msc';
  if (/^HLCU/.test(b) || /^HLAG/.test(b)) return 'hapag';
  if (/^MAEU/.test(b) || /^MRSU/.test(b) || /^26[0-9]{7}$/.test(b)) return 'maersk';
  if (/^CMA/.test(b) || /^CHN/.test(b) || /^CAN/.test(b) || /^GGZ/.test(b) || /^NGP/.test(b)) return 'cma';
  if (/^NK[0-9A-Z]/.test(b) || /^NBOG/.test(b) || /^ONEY/.test(b)) return 'one';
  if (/^S[0-9]{7,}/.test(b)) return 'grimaldi';
  return null;
}

export var CARRIER_LABELS: Record<string, string> = {
  cma: 'CMA-CGM',
  maersk: 'Maersk',
  msc: 'MSC',
  hapag: 'Hapag-Lloyd',
  one: 'ONE',
  grimaldi: 'Grimaldi',
};

export interface CarrierResponse {
  ok: boolean;
  carrier?: string;
  arrivalDate?: string | null;
  containers?: Array<{ n?: string; ty?: string }>;
  error?: string;
  note?: string;
  cached?: boolean;
}

/**
 * Sync principal : appelle le bon Worker selon l'armateur detecte.
 */
export async function fetchCarrier(bl: string, cp?: string): Promise<CarrierResponse> {
  if (!bl) return { ok: false, error: 'BL requis' };
  var carrier = detectCarrier(bl, cp);
  if (!carrier) {
    return { ok: false, error: 'Armateur non detecte (ni depuis BL ni depuis compagnie). Sync DPWorld pour BAD/BAE.' };
  }

  var ctrl = new AbortController();
  var timer = setTimeout(function () { ctrl.abort(); }, 18000);
  try {
    var url: string;
    if (carrier === 'cma') {
      // CMA : API officielle via cma-proxy
      url = CMA_PROXY_URL + '?bl=' + encodeURIComponent(bl);
    } else {
      // Autres : scraping via carrier-proxy
      url = CARRIER_PROXY_URL + '?bl=' + encodeURIComponent(bl) + '&carrier=' + carrier + (cp ? '&cp=' + encodeURIComponent(cp) : '');
    }
    var res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    var json = await res.json();

    // Normalisation : extraire la date d'arrivee selon la source
    if (carrier === 'cma' && json.ok && json.data) {
      var raw = json.data;
      var arrivalDate = extractCMAArrivalDate(raw);
      return {
        ok: true,
        carrier: 'cma',
        arrivalDate: arrivalDate,
        containers: extractCMAContainers(raw),
        cached: !!json.cached,
      };
    }

    // Realite 2026 : seul CMA expose une vraie API publique. Les autres armateurs
    // sont soit en SPA pure (Hapag, ONE) soit en anti-bot strict (MSC, Maersk,
    // Grimaldi). On retourne un message clair plutot qu'une erreur reseau brute.
    if (carrier !== 'cma' && (!json.ok || (json.ok && json.arrivalDate === null))) {
      return {
        ok: false,
        carrier: carrier,
        error: 'Synchronisation auto indisponible pour ' + (CARRIER_LABELS[carrier] || carrier) + '. Utilisez Sync DPWorld pour les statuts BAD/BAE/Pregate. Le suivi armateur officiel sera disponible avec l\'abonnement premium.',
      };
    }

    return json as CarrierResponse;
  } catch (e: any) {
    clearTimeout(timer);
    if (e && e.name === 'AbortError') return { ok: false, error: 'Timeout (18s)' };
    return { ok: false, error: 'Reseau : ' + (e.message || 'inconnu') };
  }
}

// CMA reponse parsing minimal
function extractCMAArrivalDate(raw: any): string | null {
  if (!raw) return null;
  var containers: any[] = [];
  if (Array.isArray(raw.containers)) containers = raw.containers;
  else if (raw.data && Array.isArray(raw.data.containers)) containers = raw.data.containers;
  else if (Array.isArray(raw)) containers = raw;
  // Cherche la 1ere date DISCHARGE
  for (var i = 0; i < containers.length; i++) {
    var c = containers[i];
    var events = c.events || c.history || [];
    for (var j = 0; j < events.length; j++) {
      var e = events[j];
      var t = String(e.type || e.eventType || '').toUpperCase();
      if ((t.indexOf('DISCHARGE') >= 0 || t.indexOf('DEBARQ') >= 0) && (e.date || e.eventDate)) {
        var dt = String(e.date || e.eventDate).split('T')[0];
        if (/^\d{4}-\d{2}-\d{2}$/.test(dt)) return dt;
      }
    }
  }
  return null;
}

function extractCMAContainers(raw: any): Array<{ n?: string; ty?: string }> {
  if (!raw) return [];
  var containers: any[] = [];
  if (Array.isArray(raw.containers)) containers = raw.containers;
  else if (raw.data && Array.isArray(raw.data.containers)) containers = raw.data.containers;
  return containers.map(function (c: any) {
    return {
      n: String(c.number || c.containerNumber || c.id || '').toUpperCase().trim(),
      ty: String(c.type || c.size || c.containerType || '20GP'),
    };
  }).filter(function (x: any) { return !!x.n; });
}

/**
 * Mapping vers patches Sapurai (compatible avec dos+tcs).
 * Scope minimal : pose dos.da si pas deja set, ajoute TC manquants.
 */
export function mapCarrierToPatches(resp: CarrierResponse, dosTcs: any[], dos: any) {
  var dosPatches: Record<string, any> = {};
  var newTcs: any[] = [];
  var changes: string[] = [];

  if (!dos.da && resp.arrivalDate) {
    dosPatches.da = resp.arrivalDate;
    changes.push('Date arrivee ' + resp.arrivalDate);
  }

  // Ajout TC manquants si l'armateur en a remonte
  if (Array.isArray(resp.containers) && resp.containers.length > 0) {
    var existing: Record<string, boolean> = {};
    dosTcs.forEach(function (t: any) { if (t.n) existing[String(t.n).toUpperCase().trim().replace(/[\s\-]/g, '')] = true; });
    resp.containers.forEach(function (c: any) {
      if (!c.n) return;
      var key = String(c.n).toUpperCase().trim().replace(/[\s\-]/g, '');
      if (existing[key]) return;
      newTcs.push({ n: c.n, ty: c.ty || '20GP' });
      changes.push('+ TC ' + c.n);
    });
  }

  var summary = changes.length > 0
    ? changes.length + ' maj : ' + changes.slice(0, 3).join(', ') + (changes.length > 3 ? '...' : '')
    : 'Aucune nouveaute (' + (resp.note || 'site rendu cote JS') + ')';

  return { dosPatches: dosPatches, newTcs: newTcs, summary: summary, changes: changes };
}
