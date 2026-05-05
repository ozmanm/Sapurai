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
    // Parsing robuste : verifier qu'on recoit bien du JSON. Si le Worker
    // crash (Cloudflare error 1042 etc.), il retourne une page HTML qui
    // ferait planter res.json(). On renvoie alors un message metier clair.
    var contentType = (res.headers.get('content-type') || '').toLowerCase();
    var bodyText = await res.text();
    var json: any;
    if (contentType.indexOf('application/json') < 0 || !bodyText.trim().startsWith('{')) {
      return {
        ok: false,
        carrier: carrier,
        error: 'Service de tracking ' + (CARRIER_LABELS[carrier] || carrier) + ' temporairement indisponible. Reessayez plus tard ou utilisez Sync DPWorld.',
      };
    }
    try {
      json = JSON.parse(bodyText);
    } catch (_e) {
      return {
        ok: false,
        carrier: carrier,
        error: 'Reponse invalide du service ' + (CARRIER_LABELS[carrier] || carrier) + '. Reessayez plus tard.',
      };
    }

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

// Format DCSA v2.2.0 : data est un array d'events, chaque event a equipmentReference,
// eventDateTime, carrierSpecificData.internalEventLabel, transportCall.transportationPhase, etc.

function extractDCSAEvents(raw: any): any[] {
  if (Array.isArray(raw)) return raw;
  if (raw && Array.isArray(raw.data)) return raw.data;
  if (raw && Array.isArray(raw.events)) return raw.events;
  return [];
}

/**
 * Extrait la date d'arrivee (Discharged en Import) avec priorite :
 *  1. Event ACT (actual) en phase Import      -> date reelle d'arrivee
 *  2. Event EST/PLN (estimated/planned) Import -> ETA (date prevue)
 *  3. Fallback : tout Discharged ACT/EST/PLN
 *
 * Ainsi, meme si le TC n'est pas encore arrive (que des events EST disponibles),
 * on remonte l'ETA pour permettre au transitaire d'anticiper.
 */
function extractCMAArrivalDate(raw: any): string | null {
  var events = extractDCSAEvents(raw);

  function isDischarged(e: any): boolean {
    var lbl = String((e.carrierSpecificData && e.carrierSpecificData.internalEventLabel) || '').toLowerCase();
    var code = String((e.carrierSpecificData && e.carrierSpecificData.internalEventCode) || '').toUpperCase();
    return lbl.indexOf('discharg') >= 0 || code === 'IDF' || code === 'POD';
  }
  function isImport(e: any): boolean {
    return String((e.transportCall && e.transportCall.transportationPhase) || '').toLowerCase() === 'import';
  }
  // Filtre port de destination Dakar (DKR) : prefere les events dont le port
  // de declenchement est explicitement Dakar pour eviter de remonter une date
  // d'arrivee d'un port intermediaire dans les rares BL multi-imports
  // (cabotage Dakar->Banjul, etc.).
  function isDakar(e: any): boolean {
    var loc = e.transportCall && e.transportCall.location;
    if (!loc) return false;
    var unCode = String(loc.UNLocationCode || '').toUpperCase();
    if (unCode === 'SNDKR' || unCode === 'DKR') return true;
    var name = String(loc.locationName || '').toLowerCase();
    return name.indexOf('dakar') >= 0;
  }
  function classifier(e: any): string {
    return String(e.eventClassifierCode || '').toUpperCase();
  }

  // Priorites par categorie : on cherche d'abord a Dakar (Import), puis tout Import,
  // puis tout discharged. Au sein de chaque categorie : ACT > EST/PLN > autre.
  var actDakar = events.filter(function (e: any) { return isDischarged(e) && isImport(e) && isDakar(e) && classifier(e) === 'ACT'; });
  var estDakar = events.filter(function (e: any) { return isDischarged(e) && isImport(e) && isDakar(e) && (classifier(e) === 'EST' || classifier(e) === 'PLN'); });
  var actImport = events.filter(function (e: any) { return isDischarged(e) && isImport(e) && classifier(e) === 'ACT'; });
  var estImport = events.filter(function (e: any) { return isDischarged(e) && isImport(e) && (classifier(e) === 'EST' || classifier(e) === 'PLN'); });
  var anyImport = events.filter(function (e: any) { return isDischarged(e) && isImport(e); });
  var anyDisch = events.filter(isDischarged);

  var pool = actDakar.length > 0 ? actDakar
    : estDakar.length > 0 ? estDakar
    : actImport.length > 0 ? actImport
    : estImport.length > 0 ? estImport
    : anyImport.length > 0 ? anyImport
    : anyDisch;

  if (pool.length === 0) return null;
  // Plus recent en premier
  pool.sort(function (a: any, b: any) {
    return (a.eventDateTime || '') < (b.eventDateTime || '') ? 1 : -1;
  });
  var dt = String(pool[0].eventDateTime || '').split('T')[0];
  return /^\d{4}-\d{2}-\d{2}$/.test(dt) ? dt : null;
}

// ISO container code -> type Sapurai
var ISO_TO_TYPE_C: Record<string, string> = {
  "22G1": "20GP", "22G0": "20GP",
  "42G1": "40GP", "42G0": "40GP",
  "45G1": "40HC", "45G0": "40HC",
  "L5G1": "45HC",
  "22R1": "20RF", "42R1": "40RF", "45R1": "40HCRF",
};

function extractCMAContainers(raw: any): Array<{ n?: string; ty?: string }> {
  var events = extractDCSAEvents(raw);
  var seen: Record<string, { n: string; ty: string }> = {};
  events.forEach(function (e: any) {
    var ref = String(e.equipmentReference || '').toUpperCase().trim();
    if (!ref) return;
    var iso = String(e.ISOEquipmentCode || '').toUpperCase();
    var ty = iso ? (ISO_TO_TYPE_C[iso] || iso) : '20GP';
    // Garde le 1er type rencontre pour ce TC (les events suivants peuvent ne pas avoir l'ISO)
    if (!seen[ref]) seen[ref] = { n: ref, ty: ty };
    else if (iso && seen[ref].ty === '20GP') seen[ref].ty = ty;  // upgrade si on trouve mieux
  });
  return Object.keys(seen).map(function (k) { return seen[k]; });
}

/**
 * Mapping vers patches Sapurai (compatible avec dos+tcs).
 * Scope minimal : pose dos.da si pas deja set, ajoute TC manquants.
 */
export function mapCarrierToPatches(resp: CarrierResponse, dosTcs: any[], dos: any) {
  var dosPatches: Record<string, any> = {};
  var newTcs: any[] = [];
  var changes: string[] = [];

  // L'armateur fait foi (comme DPWorld pour l'arrivee Dakar). Si l'API renvoie
  // une date, Sapurai l'applique TOUJOURS, qu'elle soit posee ou non, manuelle
  // ou automatique. La saisie agent est seulement un "premier remplissage" en
  // attendant que l'API publique remonte la donnee officielle.
  if (resp.arrivalDate) {
    if (!dos.da) {
      dosPatches.da = resp.arrivalDate;
      dosPatches.daSrc = 'cma';
      changes.push('Date arrivee ' + resp.arrivalDate);
    } else if (dos.da !== resp.arrivalDate) {
      dosPatches.da = resp.arrivalDate;
      dosPatches.daSrc = 'cma';
      changes.push('ETA maj ' + dos.da + ' → ' + resp.arrivalDate);
    }
    // Sinon (date identique) : rien a faire, on ne pollue pas le journal
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

  // Notification claire selon le cas :
  // - Si changements : "X maj : ..."
  // - Si aucune modif mais date confirmee par l'armateur : "ETA confirmee (06/05)"
  // - Si l'API n'a meme pas de date : "Aucune date renvoyee par l'armateur"
  var summary;
  if (changes.length > 0) {
    summary = changes.length + ' maj : ' + changes.slice(0, 3).join(', ') + (changes.length > 3 ? '...' : '');
  } else if (resp.arrivalDate && resp.arrivalDate === dos.da) {
    summary = 'ETA confirmee (' + resp.arrivalDate + ')';
  } else {
    summary = 'Aucune nouveaute (' + (resp.note || 'site rendu cote JS') + ')';
  }

  return { dosPatches: dosPatches, newTcs: newTcs, summary: summary, changes: changes };
}
