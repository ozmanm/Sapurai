/**
 * dpworld.ts — Integration API DPWorld Dakar
 * Appel via proxy Cloudflare Worker (CORS)
 * Mapping reponse API → patches Sapurai (Lot 1 : par TC)
 */

// URL du proxy Cloudflare — a remplacer par l'URL reelle
var PROXY_URL = "https://dpworld-proxy.ozmanm10.workers.dev";

export function setDPWorldProxy(url: string): void {
  PROXY_URL = url;
}

export async function fetchDPWorld(ref: string): Promise<any> {
  var ctrl = new AbortController();
  var timer = setTimeout(function () { ctrl.abort(); }, 15000);
  try {
    var res = await fetch(PROXY_URL + "?bl=" + encodeURIComponent(ref), { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error("DPWorld: HTTP " + res.status);
    var json = await res.json();
    if (!json.success || !json.data) throw new Error("Pas de donnees DPWorld");
    return json;
  } catch (e: any) {
    clearTimeout(timer);
    if (e.name === "AbortError") throw new Error("DPWorld: timeout (15s)");
    throw e;
  }
}

// Normaliser un numero conteneur pour comparaison
function norm(s: string): string {
  return (s || "").replace(/[\s\-]/g, "").toUpperCase().trim();
}

// ===== Lot 1 : mapping par TC =====

export interface TcDPWorldPatch {
  id: string;
  st?: string;
  dsp?: string;
  dpwAta?: string;
  dpwDischarge?: string;
  dpwTimeIn?: string;
  dpwTimeOut?: string;
  dpwVisitState?: string;
  dpwSyncedAt: string;
  dpwConflict?: any;         // null pour effacer, ou objet conflit
  changes: string[];
}

export interface DPWorldPatches {
  dosPatches: Record<string, any>;
  tcUpdates: TcDPWorldPatch[];
  conflicts: Array<{ tcid: string; tcn: string | undefined; conflict: { type: string; note: string; at: string } }>;
  summary: string;
  changes: string[];
}

/**
 * mapTcDPWorld — patch unique TC a partir de la donnee DPWorld brute.
 * Priorite metier : si timeOut + 3DEPARTED, le TC peut aller a DISPATCHE
 * meme s'il etait ATTENDU (evite deux syncs).
 */
export function mapTcDPWorld(tc: any, dpTc: any): TcDPWorldPatch {
  var now = new Date().toISOString();
  var patch: TcDPWorldPatch = { id: tc.id, dpwSyncedAt: now, changes: [] };

  // Toujours capturer la verite DPWorld brute
  if (dpTc.ata) patch.dpwAta = dpTc.ata.split("T")[0];
  if (dpTc.dischargeDate) patch.dpwDischarge = dpTc.dischargeDate.split("T")[0];
  if (dpTc.timeIn) patch.dpwTimeIn = dpTc.timeIn.split("T")[0];
  if (dpTc.timeOut) patch.dpwTimeOut = dpTc.timeOut.split("T")[0];
  if (dpTc.visitState) patch.dpwVisitState = dpTc.visitState;

  // Si DPWorld confirme la sortie → transition directe possible
  if (dpTc.timeOut && dpTc.visitState === "3DEPARTED") {
    if (tc.st !== "DISPATCHE" && tc.st !== "TRANSIT" && tc.st !== "KATI" && tc.st !== "BAMAKO" && tc.st !== "RETURNED") {
      patch.st = "DISPATCHE";
      patch.dsp = dpTc.timeOut.split("T")[0];
      patch.changes.push((tc.n || "?") + " → Dispatche");
    }
  } else if (dpTc.timeIn) {
    // TC ATTENDU → PORT
    if (tc.st === "ATTENDU") {
      patch.st = "PORT";
      patch.changes.push((tc.n || "?") + " → Port");
    }
  }

  // Effacer un conflit precedent si tout va bien
  if (tc.dpwConflict && !patch.st) {
    patch.dpwConflict = null;
    patch.changes.push((tc.n || "?") + " conflit resolve");
  }

  return patch;
}

/**
 * detectTcConflict — compare l'etat local apres patch avec la verite DPWorld.
 */
export function detectTcConflict(tc: any, dpTc: any): any {
  var now = new Date().toISOString();
  var localOut = ["DISPATCHE", "TRANSIT", "KATI", "BAMAKO", "RETURNED"].indexOf(tc.st) >= 0;
  var dpwOut = dpTc.visitState === "3DEPARTED" && !!dpTc.timeOut;

  if (localOut && !dpwOut) {
    return { type: "STATUS_MISMATCH", note: "Local=" + (tc.st || "?") + " mais DPWorld n'a pas confirme la sortie (visitState=" + (dpTc.visitState || "inconnu") + ")", at: now };
  }
  if (tc.st === "DISPATCHE" && !tc.dsp) {
    return { type: "MISSING_DSP", note: "TC marque DISPATCHE sans date de dispatch", at: now };
  }
  return null;
}

/**
 * mapDossierDPWorld — patches niveau dossier (da, bs, bv, as2, bd, pn).
 * Extrait de l'ancien mapDPWorldToPatches.
 */
function mapDossierDPWorld(dpData: any[], dos: any): Record<string, any> {
  var patches: Record<string, any> = {};

  // Date arrivee — prendre la ATA la plus ancienne
  if (!dos.da && dpData.length > 0) {
    var earliest: string | null = null;
    dpData.forEach(function (tc) {
      if (tc.ata) {
        var dt = tc.ata.split("T")[0];
        if (!earliest || dt < earliest) earliest = dt;
      }
    });
    if (earliest) patches.da = earliest;
  }

  // BAD
  if (dpData.some(function (tc) { return tc.bad === "OK"; })) {
    if (dos.bs !== "OBTENU") patches.bs = "OBTENU";
    var badDateSrc = dpData.find(function (tc) { return tc.validiteDODate; });
    if (badDateSrc && badDateSrc.validiteDODate) {
      var newBv = badDateSrc.validiteDODate.split("T")[0];
      if (!dos.bv || dos.bv < newBv) patches.bv = newBv;
    }
  }

  // BAE
  if (dpData.some(function (tc) { return tc.bae === "OK"; })) {
    if (dos.as2 !== "OBTENU") patches.as2 = "OBTENU";
    if (!dos.bd) {
      var baeDateSrc = dpData.find(function (tc) { return tc.dateBae; });
      if (baeDateSrc && baeDateSrc.dateBae) patches.bd = baeDateSrc.dateBae.split("T")[0];
    }
  }

  // Pregate
  if (!dos.pn && dpData.some(function (tc) { return tc.pregateDO === "Paiment Effectif"; })) {
    var doSrc = dpData.find(function (tc) { return tc.do; });
    if (doSrc && doSrc.do) patches.pn = doSrc.do;
  }

  return patches;
}

// ===== Facade (compatible ascendante) =====

/**
 * mapDPWorldToPatches — facade qui appelle mapTcDPWorld + mapDossierDPWorld
 * pour tous les TC du dossier + dossier lui-meme. Utilisee par syncDPWorld
 * et syncAllDPWorld (hook useDPWorldSync).
 */
export function mapDPWorldToPatches(dpData: any[], dosTcs: any[], dos: any): DPWorldPatches {
  var dosPatches = mapDossierDPWorld(dpData, dos);
  var tcUpdates: TcDPWorldPatch[] = [];
  var changes: string[] = [];
  var conflicts: DPWorldPatches["conflicts"] = [];

  dosTcs.forEach(function (tc) {
    var dpN = norm(tc.n || "");
    var dpTc = dpData.find(function (x) { return norm(x.id) === dpN; });
    if (!dpTc) {
      // TC local non trouve chez DPWorld — conflit seulement si deja sync une fois
      if (tc.dpwSyncedAt) {
        conflicts.push({ tcid: tc.id, tcn: tc.n, conflict: { type: "NOT_FOUND", note: "TC absent de la reponse DPWorld", at: new Date().toISOString() } });
      }
      return;
    }

    var patch = mapTcDPWorld(tc, dpTc);
    var merged = Object.assign({}, tc, patch);
    var conflict = detectTcConflict(merged, dpTc);

    // N'inclure dpwConflict dans le patch que s'il change reellement
    // (undefined et null sont consideres equivalents = pas de conflit)
    var currentConflict = tc.dpwConflict ?? null;
    var newConflict = conflict ?? null;
    var fullPatch: any = Object.assign({}, patch);
    if (currentConflict !== newConflict) {
      fullPatch.dpwConflict = newConflict;
    }

    // N'inclure le TC dans tcUpdates que si au moins un champ a change
    var hasChange = fullPatch.changes && fullPatch.changes.length > 0;
    if (!hasChange && fullPatch.st !== undefined) hasChange = true;
    if (!hasChange && fullPatch.dpwAta !== tc.dpwAta) hasChange = true;
    if (!hasChange && fullPatch.dpwDischarge !== tc.dpwDischarge) hasChange = true;
    if (!hasChange && fullPatch.dpwTimeIn !== tc.dpwTimeIn) hasChange = true;
    if (!hasChange && fullPatch.dpwTimeOut !== tc.dpwTimeOut) hasChange = true;
    if (!hasChange && fullPatch.dpwVisitState !== tc.dpwVisitState) hasChange = true;
    if (!hasChange && fullPatch.dpwConflict !== undefined) hasChange = true;

    if (hasChange) {
      tcUpdates.push(fullPatch);
      if (fullPatch.changes) changes.push.apply(changes, fullPatch.changes);
    }
  });

  // Ajouter les changements dossier
  Object.keys(dosPatches).forEach(function (k) {
    if (k === "da") changes.push("Date arrivee " + dosPatches[k]);
    else if (k === "bs") changes.push("BAD → Obtenu");
    else if (k === "bv") changes.push("Date BAD " + dosPatches[k]);
    else if (k === "as2") changes.push("BAE → Obtenu");
    else if (k === "bd") changes.push("Date BAE " + dosPatches[k]);
    else if (k === "pn") changes.push("Pregate " + dosPatches[k]);
  });

  // Ajouter les conflits aux changements pour le resume
  conflicts.forEach(function (c) {
    changes.push((c.tcn || "?") + ": conflit " + c.conflict.type);
  });

  var summary = changes.length > 0
    ? changes.length + " maj: " + changes.slice(0, 3).join(", ") + (changes.length > 3 ? "..." : "")
    : "Aucune nouveaute DPWorld";

  return { dosPatches: dosPatches, tcUpdates: tcUpdates, conflicts: conflicts, summary: summary, changes: changes };
}
