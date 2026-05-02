/**
 * dpworld.ts — Integration API DPWorld Dakar
 * Appel via proxy Cloudflare Worker (CORS)
 * Mapping reponse API → patches Sapurai
 */

// URL du proxy Cloudflare — a remplacer par l'URL reelle
var PROXY_URL = "https://dpworld-proxy.ozmanm10.workers.dev";

export function setDPWorldProxy(url: string): void {
  PROXY_URL = url;
}

export async function fetchDPWorld(bl: string): Promise<any> {
  var ctrl = new AbortController();
  var timer = setTimeout(function () { ctrl.abort(); }, 15000);
  try {
    var res = await fetch(PROXY_URL + "?bl=" + encodeURIComponent(bl), { signal: ctrl.signal });
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

interface TcUpdate {
  id: string;
  st?: string;
  dsp?: string;
}

interface DPWorldPatches {
  dosPatches: Record<string, any>;
  tcUpdates: TcUpdate[];
  summary: string;
  changes: string[];  // Liste detaillee des changements (pour rapport sync)
}

export function mapDPWorldToPatches(dpData: any[], dosTcs: any[], dos: any): DPWorldPatches {
  var dosPatches: Record<string, any> = {};
  var tcUpdates: TcUpdate[] = [];
  var changes: string[] = [];

  // 1. Date arrivee — prendre la ATA la plus ancienne
  if (!dos.da && dpData.length > 0) {
    var earliest: string | null = null;
    dpData.forEach(function (tc) {
      if (tc.ata) {
        var dt = tc.ata.split("T")[0];
        if (!earliest || dt < earliest) earliest = dt;
      }
    });
    if (earliest) {
      dosPatches.da = earliest;
      changes.push("Date arrivee " + earliest);
    }
  }

  // 2. BAD — statut + date validite (independants)
  if (dpData.some(function (tc) { return tc.bad === "OK"; })) {
    if (dos.bs !== "OBTENU") {
      dosPatches.bs = "OBTENU";
      changes.push("BAD → Obtenu");
    }
    // Date validite BAD — utiliser validiteDODate (pas dateBad qui est la date d'emission)
    // Toujours mettre a jour si DPWorld fournit une date plus recente
    var badDateSrc = dpData.find(function (tc) { return tc.validiteDODate; });
    if (badDateSrc && badDateSrc.validiteDODate) {
      var newBv = badDateSrc.validiteDODate.split("T")[0];
      if (!dos.bv || dos.bv < newBv) {
        dosPatches.bv = newBv;
        changes.push("Date BAD " + newBv);
      }
    }
  }

  // 3. BAE — statut + date (independants)
  if (dpData.some(function (tc) { return tc.bae === "OK"; })) {
    if (dos.as2 !== "OBTENU") {
      dosPatches.as2 = "OBTENU";
      changes.push("BAE → Obtenu");
    }
    // Date BAE — enrichir si vide
    if (!dos.bd) {
      var baeDateSrc = dpData.find(function (tc) { return tc.dateBae; });
      if (baeDateSrc && baeDateSrc.dateBae) {
        dosPatches.bd = baeDateSrc.dateBae.split("T")[0];
        changes.push("Date BAE " + dosPatches.bd);
      }
    }
  }

  // 4. Pregate — si paiement effectif et pas encore renseigne
  if (!dos.pn && dpData.some(function (tc) { return tc.pregateDO === "Paiment Effectif"; })) {
    var doSrc = dpData.find(function (tc) { return tc.do; });
    if (doSrc && doSrc.do) {
      dosPatches.pn = doSrc.do;
      changes.push("Pregate " + doSrc.do);
    }
  }

  // 5. TCs — matcher par numero conteneur (normalise)
  dpData.forEach(function (dpTc) {
    var dpN = norm(dpTc.id);
    var match = dosTcs.find(function (tc) { return norm(tc.n) === dpN; });
    if (!match) return;

    // TC ATTENDU mais decharge → passer PORT
    if (match.st === "ATTENDU" && dpTc.timeIn) {
      tcUpdates.push({ id: match.id, st: "PORT" });
      changes.push(match.n + " → Port");
    }

    // TC PORT mais sorti du terminal → passer DISPATCHE
    if (match.st === "PORT" && dpTc.timeOut && dpTc.visitState === "3DEPARTED") {
      tcUpdates.push({ id: match.id, st: "DISPATCHE", dsp: dpTc.timeOut.split("T")[0] });
      changes.push(match.n + " → Dispatche");
    }
  });

  var summary = changes.length > 0
    ? changes.length + " maj: " + changes.slice(0, 3).join(", ") + (changes.length > 3 ? "..." : "")
    : "Aucune nouveaute DPWorld";

  return { dosPatches: dosPatches, tcUpdates: tcUpdates, summary: summary, changes: changes };
}
