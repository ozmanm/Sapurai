import { useState } from 'react';
import { IS, LS } from '../../constants/styles.js';
import { today } from '../../utils/date.js';
import ScanBL from '../../ScanBL.tsx';
import Btn from '../ui/Btn.tsx';
import { validateAll, FieldError } from '../../utils/validate.js';
import {
  defaultFranchiseMagasinage,
  defaultFranchiseRetourVide,
  defaultFranchiseCompagnie,
  regionFromDestination,
} from '../../utils/franchise';
import { fetchCarrier } from '../../services/carriers';
import { isBetaCompany } from '../../constants/featureFlags';

interface NDosFormProps { [key: string]: any; }
type FormErrors = Record<string, string>;
type ClientOption = { nm: string; ct?: string; ce?: string; cr?: string; cp?: string; gr?: string };

function NDosForm(p: NDosFormProps) {
  var i = p.init;
  var sc = p.scan;
  var [bl, sBl] = useState(sc ? sc.bl || "" : i ? i.bl || "" : "");
  var [cl, sCl] = useState(sc ? sc.cl || "" : i ? i.cl || "" : "");
  var [cp, sCp] = useState(sc ? sc.cp || "" : i ? i.cp || "" : "");
  var [cr, sCr] = useState(sc ? sc.cr || "" : i ? i.cr || "" : "");
  var [da, sDa] = useState(sc ? sc.da || today() : i ? i.da || today() : today());
  var [ct, sCt] = useState(sc ? sc.ct || "" : i ? i.ct || "" : "");
  var [gr, sGr] = useState(i ? i.gr || "PERMANENTE" : "PERMANENTE");
  var [garContact, sGarContact] = useState(i ? i.gar_contact || "" : "");
  var [garTel, sGarTel] = useState(i ? i.gar_tel || "" : "");
  var [garFrais, sGarFrais] = useState(i ? String(i.gar_frais || "") : "");
  var [garCaution, sGarCaution] = useState(i ? String(i.gar_caution || "") : "");
  // Sprint D.2 — montants unitaires (par TC)
  var [garCautionUnit, sGarCautionUnit] = useState(i ? String(i.gar_caution_unit || "") : "");
  var [garFraisUnit, sGarFraisUnit] = useState(i ? String(i.gar_frais_unit || "") : "");
  var [garStatut, sGarStatut] = useState(i ? i.gar_statut || "" : "");
  var [bs, sBs] = useState(i ? i.bs || "NON_DEMANDE" : "NON_DEMANDE");
  var [bv, sBv] = useState(i ? i.bv || "" : "");
  var [as2, sAs] = useState(i ? i.as2 || "NON_DEMANDE" : "NON_DEMANDE");
  var [nd, sNd] = useState(i ? i.nd || "" : "");
  var [pn, sPn] = useState(i ? i.pn || "" : "");
  var [rv, sRv] = useState(i ? String(i.rv || "") : "");
  var [pf, sPf] = useState(i ? String(i.pf || "") : "");
  var [ce, sCe] = useState(i ? i.ce || "" : "");
  var [clDrop, setClDrop] = useState(false);
  var [vErr, setVErr] = useState<FormErrors>({});
  // Chantier 1 — bouton "Recuperer ETA via CMA" : appel API a la demande
  var [etaLoading, setEtaLoading] = useState(false);
  var [daSrcState, setDaSrcState] = useState<'manual' | 'cma' | undefined>(i && i.daSrc ? i.daSrc : undefined);
  // Sprint 26 : Scan BL via Gemini Vision (gate beta + cle Gemini)
  // Sprint 27 : desactive (Senegal hors free tier Gemini)
  // Sprint 33 : reactive via Cloudflare Workers AI (LLaVA 1.5 7B, 10k neurons/jour gratuits)
  //   - Plus besoin d apiKey cote front : le Worker gere l AI via binding interne
  //   - Gate beta conserve : seule isBetaCompany(c_mocpodna9egt) voit le bouton
  var [showScan, setShowScan] = useState(false);
  var canScan = isBetaCompany(p.companyId) && !p.init;
  var initTcs = sc && sc.tcs && sc.tcs.length > 0 ? sc.tcs : (p.initTcs || []).map(function (c) { return { n: c.n || "", ty: c.ty || "20GP", po: c.po || "" }; });
  var [tc, sTc] = useState(initTcs.length > 0 ? initTcs : [{ n: "", ty: "20GP", po: "" }]);

  // Assignation agent a la creation/modification dossier (Sprint A bug 2)
  var existingAgentItv = i && i.itv ? (i.itv.find(function (iv: any) { return (iv.role || "").toUpperCase() === "AGENT"; }) || null) : null;
  var [agentNm, sAgentNm] = useState<string>(existingAgentItv ? existingAgentItv.nm || "" : "");
  var [agentTaches, sAgentTaches] = useState<string[]>(existingAgentItv ? (existingAgentItv.taches || []).slice() : []);
  var [agentVoirDep, sAgentVoirDep] = useState<boolean>(existingAgentItv ? !!existingAgentItv.voirDepenses : false);
  // Liste des agents disponibles (filtre via members ou allDos.itv comme fallback)
  var availableAgents: Array<{ nm: string }> = [];
  if (Array.isArray(p.members)) {
    p.members.forEach(function (m: any) {
      if (m && m.role === "agent" && m.name && !availableAgents.some(function (a) { return a.nm === m.name; })) {
        availableAgents.push({ nm: m.name });
      }
    });
  }
  var TACHES_OPTS = [
    { k: "BAD", l: "BAD" }, { k: "BAE", l: "BAE/Douane" }, { k: "PREGATE", l: "Pregate" },
    { k: "TRANSIT", l: "Transit" }, { k: "LIVRAISON", l: "Livraison" },
    { k: "MANUT", l: "Manutention" }, { k: "FACT", l: "Facturation" },
  ];
  function toggleTache(k: string) {
    sAgentTaches(function (cur) { return cur.indexOf(k) >= 0 ? cur.filter(function (x) { return x !== k; }) : cur.concat([k]); });
  }

  // Auto-stub Depenses — type dossier + franchises + toggles (commit 2)
  // Les franchises restent vides par defaut (recalcul dynamique via getFranchise*
  // cote code consommateur). User peut overrider pour derogation client.
  var [td, sTd] = useState(i ? i.td || "IMPORT" : "IMPORT");
  var [frCp, sFrCp] = useState(i && i.frCp !== undefined ? String(i.frCp) : "");
  var [frMg, sFrMg] = useState(i && i.frMg !== undefined ? String(i.frMg) : "");
  var [frRt, sFrRt] = useState(i && i.frRt !== undefined ? String(i.frRt) : "");
  var [besc, sBesc] = useState(i ? !!i.besc : true);   // defaut true (import classique)
  var [ror, sRor] = useState(i ? !!i.ror : false);

  // Defauts calcules pour placeholders (aide la saisie sans forcer a ecrire)
  var defFrCp = defaultFranchiseCompagnie();
  var defFrMg = defaultFranchiseMagasinage(td);
  var defFrRt = defaultFranchiseRetourVide(regionFromDestination(cr));

  // Client autocomplete
  var allClients: ClientOption[] = [];
  (p.allDos || []).forEach(function (d) {
    if (d.cl && !allClients.some(function (c) { return c.nm === d.cl; })) {
      allClients.push({ nm: d.cl, ct: d.ct || "", ce: d.ce || "", cr: d.cr || "" });
    }
  });

  // Sprint D.1 — listes ref derivees des dossiers (autocomplete via <datalist>)
  var refDestinations: string[] = [];
  var refCompagnies: string[] = [];
  var refGarants: string[] = [];
  (p.allDos || []).forEach(function (d: any) {
    if (d.cr && refDestinations.indexOf(d.cr) < 0) refDestinations.push(d.cr);
    if (d.cp && refCompagnies.indexOf(d.cp) < 0) refCompagnies.push(d.cp);
    if (d.gar_contact && refGarants.indexOf(d.gar_contact) < 0) refGarants.push(d.gar_contact);
  });
  refDestinations.sort();
  refCompagnies.sort();
  refGarants.sort();
  var filteredCl = cl.length >= 1 ? allClients.filter(function (c) { return c.nm.toLowerCase().indexOf(cl.toLowerCase()) >= 0; }) : [];

  function selectClient(c: ClientOption) {
    sCl(c.nm);
    if (c.ct) sCt(c.ct);
    if (c.ce) sCe(c.ce);
    if (c.cr) sCr(c.cr);
    if (c.cp) sCp(c.cp);
    if (c.gr) sGr(c.gr);
    setClDrop(false);
  }

  return (
    <div>
      {/* Sprint 26 : bandeau Scan BL (reactive en beta, necessite cle Gemini) */}
      {canScan && !showScan ? (
        <div style={{ background: "var(--success-bg)", border: "2px dashed var(--success-border)", borderRadius: 8, padding: 14, marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--success-text)" }}>{"📷 Gagnez du temps"}</div>
            <div style={{ fontSize: 12, color: "var(--success-text)" }}>{"Scannez votre BL pour pre-remplir automatiquement"}</div>
          </div>
          <Btn variant="success" size="sm" onClick={function () { setShowScan(true); }}>{"📷 Scanner BL"}</Btn>
        </div>
      ) : null}
      {showScan ? (
        <div style={{ marginBottom: 14 }}>
          <ScanBL onResult={function (r: any) { sBl(r.bl || ""); sCl(r.cl || ""); sCp(r.cp || ""); if (r.cr) sCr(r.cr); if (r.da) sDa(r.da); if (r.ct) sCt(r.ct); if (r.tcs && r.tcs.length > 0) sTc(r.tcs); setShowScan(false); p.nf("BL scanne avec succes !"); }} />
          <Btn variant="ghost" size="sm" onClick={function () { setShowScan(false); }} style={{ marginTop: 8 }}>{"Annuler le scan"}</Btn>
        </div>
      ) : null}
      <div className="lt-grid2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ marginBottom: 12 }}><label style={LS} htmlFor="ndos-bl">{"BL *"}</label><input id="ndos-bl" value={bl} onChange={function (e) { sBl(e.target.value.toUpperCase()); }} style={IS} maxLength={30} aria-invalid={!!vErr.bl} aria-describedby={vErr.bl ? "ndos-bl-err" : undefined} aria-required="true" /><FieldError msg={vErr.bl} id="ndos-bl-err" /></div>
        <div style={{ marginBottom: 12, position: "relative" }}>
          <label style={LS} htmlFor="ndos-cl">{"Client *"}</label>
          <input id="ndos-cl" value={cl} onChange={function (e) { sCl(e.target.value.toUpperCase()); setClDrop(true); }} onFocus={function () { setClDrop(true); }} style={IS} placeholder="Saisir ou choisir..." maxLength={50} aria-invalid={!!vErr.cl} aria-describedby={vErr.cl ? "ndos-cl-err" : undefined} aria-required="true" />
          <FieldError msg={vErr.cl} id="ndos-cl-err" />
          {clDrop && filteredCl.length > 0 ? <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,.1)", zIndex: 20, maxHeight: 150, overflow: "auto", color: "var(--text-primary)" }}>
            {filteredCl.map(function (c) { return <div key={c.nm} onClick={function () { selectClient(c); }} style={{ padding: "8px 12px", cursor: "pointer", fontSize: 13, borderBottom: "1px solid var(--border-light)", display: "flex", justifyContent: "space-between" }}><span style={{ fontWeight: 600 }}>{c.nm}</span>{c.ct ? <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>{c.ct}</span> : null}</div>; })}
          </div> : null}
        </div>
        <div style={{ marginBottom: 12 }}><label style={LS}>{"Compagnie"}</label><input list="ndos-cp-list" value={cp} onChange={function (e) { sCp(e.target.value.toUpperCase()); }} placeholder="CMA CGM, MAERSK..." style={IS} maxLength={30} /><datalist id="ndos-cp-list">{refCompagnies.map(function (s) { return <option key={s} value={s} />; })}</datalist></div>
        <div style={{ marginBottom: 12 }}><label style={LS}>{"Destination"}</label><input list="ndos-cr-list" value={cr} onChange={function (e) { sCr(e.target.value); }} placeholder="Bamako, Conakry, Abidjan..." style={IS} maxLength={50} /><datalist id="ndos-cr-list">{refDestinations.map(function (s) { return <option key={s} value={s} />; })}</datalist></div>
        <div style={{ marginBottom: 12 }}>
          <label style={LS}>{"Date arrivee"}{daSrcState === "cma" ? <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, background: "var(--info-bg)", color: "var(--info-text)", padding: "1px 6px", borderRadius: 6 }}>{"📡 CMA"}</span> : null}</label>
          <div style={{ display: "flex", gap: 6, alignItems: "stretch" }}>
            <input type="date" value={da} onChange={function (e) { sDa(e.target.value); setDaSrcState("manual"); }} style={Object.assign({}, IS, { flex: 1 })} />
            {isBetaCompany(p.companyId) && cp.toUpperCase().indexOf("CMA") >= 0 && bl.trim().length >= 4 ? (
              <button type="button" disabled={etaLoading} onClick={async function () {
                setEtaLoading(true);
                try {
                  var resp = await fetchCarrier(bl.trim(), cp);
                  if (!resp.ok) {
                    p.nf("CMA : " + (resp.error || "echec"), "error");
                  } else if (resp.arrivalDate) {
                    sDa(resp.arrivalDate);
                    setDaSrcState("cma");
                    // Pre-remplir aussi les TC s'il y en a et que la liste actuelle est vide ou par defaut
                    if (resp.containers && resp.containers.length > 0) {
                      var current = tc.filter(function (t) { return t.n; });
                      if (current.length === 0) {
                        sTc(resp.containers.map(function (c: any) { return { n: c.n || "", ty: c.ty || "20GP", po: "" }; }));
                      }
                    }
                    p.nf("CMA : ETA " + resp.arrivalDate + (resp.cached ? " (cache)" : ""), "ok");
                  } else {
                    p.nf("CMA : aucune date trouvee pour ce BL", "warning");
                  }
                } catch (e: any) {
                  p.nf("Erreur CMA : " + (e.message || "reseau"), "error");
                } finally {
                  setEtaLoading(false);
                }
              }} style={{ background: etaLoading ? "var(--bg-secondary)" : "var(--btn-primary-bg)", color: etaLoading ? "var(--text-muted)" : "var(--btn-primary-text)", border: "none", borderRadius: 8, padding: "0 12px", fontSize: 11, fontWeight: 700, cursor: etaLoading ? "wait" : "pointer", whiteSpace: "nowrap" }} title="Interroger l'API CMA-CGM pour recuperer l'ETA">{etaLoading ? "..." : "📡 ETA CMA"}</button>
            ) : null}
          </div>
        </div>
        <div style={{ marginBottom: 12 }}><label style={LS}>{"Contact / WhatsApp"}</label><input value={ct} onChange={function (e) { sCt(e.target.value); }} placeholder="77 xxx xx xx" style={IS} maxLength={20} /></div>
        <div style={{ marginBottom: 12 }}><label style={LS} htmlFor="ndos-ce">{"Email client"}</label><input id="ndos-ce" type="email" value={ce} onChange={function (e) { sCe(e.target.value); }} placeholder="client@example.com" style={IS} maxLength={60} aria-invalid={!!vErr.ce} aria-describedby={vErr.ce ? "ndos-ce-err" : undefined} /><FieldError msg={vErr.ce} id="ndos-ce-err" /></div>
        {/* Sprint 27 : Type dossier AVANT Garantie (UX logique : on choisit d'abord le type). */}
        <div style={{ marginBottom: 12 }}><label style={LS}>{"Type dossier"}</label><select value={td} onChange={function (e) { var v = e.target.value; sTd(v); if (v !== "IMPORT") sBesc(false); if (v !== "VEHICULE") sRor(false); /* Reset garantie a Permanente si on quitte TRANSIT (sauf si init avec garantie deja posee, on tolere pour edition) */ if (v !== "TRANSIT" && !i) { sGr("PERMANENTE"); sGarContact(""); sGarTel(""); sGarFrais(""); sGarCaution(""); sGarStatut(""); } }} style={IS}><option value="IMPORT">{"Importation / consommation"}</option><option value="TRANSIT">{"Transit (Mali, Burkina...)"}</option><option value="VEHICULE">{"Véhicule"}</option></select></div>
        {/* Sprint 27 : Garantie visible UNIQUEMENT pour TRANSIT (lettre de garantie / caution douaniere obligatoire pour transit hinterland). Tolere l'affichage en edition d'un ancien dossier IMPORT/VEHICULE qui aurait une garantie LOUEE/VENDUE par accident pour permettre la correction. */}
        {td === "TRANSIT" || (p.init && i && i.gr && i.gr !== "PERMANENTE") ? (
          <div style={{ marginBottom: 12 }}><label style={LS}>{"Garantie"}</label><select value={gr} onChange={function (e) { sGr(e.target.value); if (e.target.value === "PERMANENTE") { sGarContact(""); sGarTel(""); sGarFrais(""); sGarCaution(""); sGarStatut(""); } }} style={IS}><option value="PERMANENTE">{"Permanente"}</option><option value="LOUEE">{"Louée"}</option><option value="VENDUE">{"Vente lettre"}</option></select></div>
        ) : null}
        {/* Recette et prix fret masques a la creation — le transitaire peut les renseigner via "Modifier" */}
        {p.init ? <div style={{ marginBottom: 12 }}><label style={LS}>{"Total client FCFA"}</label><input type="number" value={rv} onChange={function (e) { sRv(e.target.value); }} placeholder="Montant convenu avec le client" style={IS} /></div> : null}
        {p.init ? <div style={{ marginBottom: 12 }}><label style={LS}>{"Transport/TC FCFA"}</label><input type="number" value={pf} onChange={function (e) { sPf(e.target.value); }} placeholder="Prix chauffeur par conteneur" style={IS} /></div> : null}
      </div>
      {gr !== "PERMANENTE" ? (
        <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 14, marginBottom: 14, background: "var(--bg-tertiary)" }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>{gr === "LOUEE" ? "Caution louée — détails" : "Vente de lettre — détails"}</div>
          <div className="lt-grid2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ marginBottom: 12 }}><label style={LS}>{gr === "LOUEE" ? "Contact garant" : "Contact acheteur"}</label><input list="ndos-garant-list" value={garContact} onChange={function (e) { sGarContact(e.target.value); }} placeholder="Nom du garant / acheteur" style={IS} maxLength={50} /><datalist id="ndos-garant-list">{refGarants.map(function (s) { return <option key={s} value={s} />; })}</datalist></div>
            <div style={{ marginBottom: 12 }}><label style={LS}>{"Téléphone"}</label><input value={garTel} onChange={function (e) { sGarTel(e.target.value); }} placeholder="77 xxx xx xx" style={IS} maxLength={20} /></div>
            <div style={{ marginBottom: 12 }}><label style={LS}>{(gr === "LOUEE" ? "Lettre / TC (frais location)" : "Vente / TC") + " FCFA"}</label><input type="number" value={garFraisUnit} onChange={function (e) { var v = e.target.value; sGarFraisUnit(v); var u = parseFloat(v) || 0; sGarFrais(u > 0 ? String(u * (tc.length || 1)) : ""); }} placeholder="0" style={IS} /><div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{"Total " + tc.length + " TC : " + (parseFloat(garFraisUnit) || 0) * (tc.length || 1) + " FCFA"}</div></div>
            <div style={{ marginBottom: 12 }}><label style={LS}>{"Caution / TC FCFA"}</label><input type="number" value={garCautionUnit} onChange={function (e) { var v = e.target.value; sGarCautionUnit(v); var u = parseFloat(v) || 0; sGarCaution(u > 0 ? String(u * (tc.length || 1)) : ""); }} placeholder="Caution unitaire par TC" style={IS} /><div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{"Total " + tc.length + " TC : " + (parseFloat(garCautionUnit) || 0) * (tc.length || 1) + " FCFA"}</div></div>
            <div style={{ marginBottom: 12 }}><label style={LS}>{"Statut caution"}</label><select value={garStatut} onChange={function (e) { sGarStatut(e.target.value); }} style={IS}>{gr === "LOUEE" ? (<><option value="">{"—"}</option><option value="VERSEE">{"Versée"}</option><option value="RECUPEREE">{"Récupérée"}</option><option value="PERDUE">{"Perdue"}</option></>) : (<><option value="">{"—"}</option><option value="RETENUE">{"Retenue"}</option><option value="REMBOURSEE">{"Remboursée"}</option><option value="CONSERVEE">{"Conservée"}</option></>)}</select></div>
          </div>
        </div>
      ) : null}
      {p.init ? (
        <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 14, marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>{"Documents"}</div>
          <div className="lt-grid2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ marginBottom: 12 }}><label style={LS}>{"BAD"}</label><select value={bs} onChange={function (e) { sBs(e.target.value); }} style={IS}><option value="NON_DEMANDE">{"Non demandé"}</option><option value="EN_COURS">{"En cours"}</option><option value="OBTENU">{"Obtenu"}</option></select></div>
              <div style={{ marginBottom: 12 }}><label style={LS}>{"Validite BAD"}</label><input type="date" value={bv} onChange={function (e) { sBv(e.target.value); }} style={IS} /></div>
            </div>
            <div>
              <div style={{ marginBottom: 12 }}><label style={LS}>{"BAE"}</label><select value={as2} onChange={function (e) { sAs(e.target.value); }} style={IS}><option value="NON_DEMANDE">{"Non demandé"}</option><option value="EN_COURS">{"En cours"}</option><option value="OBTENU">{"Obtenu"}</option></select></div>
            </div>
          </div>
          <div className="lt-grid2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ marginBottom: 12 }}><label style={LS}>{"N° Declaration"}</label><input value={nd} onChange={function (e) { sNd(e.target.value.toUpperCase()); }} placeholder="2026/15T/XXXXX" style={IS} /></div>
            <div style={{ marginBottom: 12 }}><label style={LS}>{"Pregate"}</label><input value={pn} onChange={function (e) { sPn(e.target.value); }} placeholder="Auto apres paiement DP World" style={IS} /></div>
          </div>
        </div>
      ) : null}
      {/* Assignation agent (Sprint A bug 2 + C.1 exclusivité) */}
      {availableAgents.length > 0 ? (
        <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 14, marginBottom: 14, background: "var(--bg-tertiary)" }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>{"Agent assigné"}</div>
          {existingAgentItv && existingAgentItv.nm && agentNm && agentNm !== existingAgentItv.nm ? (
            <div style={{ background: "var(--warning-bg)", border: "1px solid var(--warning-border)", borderRadius: 6, padding: "6px 10px", marginBottom: 10, fontSize: 12, color: "var(--warning-text)" }}>
              {"⚠ Cet agent remplacera "}<strong>{existingAgentItv.nm}</strong>{" actuellement assigné. Le précédent agent perdra l'accès à ce dossier."}
            </div>
          ) : null}
          <div className="lt-grid2" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
            <div>
              <label style={LS}>{"Agent (optionnel — un seul par dossier)"}</label>
              <select value={agentNm} onChange={function (e) { sAgentNm(e.target.value); if (!e.target.value) { sAgentTaches([]); sAgentVoirDep(false); } }} style={IS}>
                <option value="">{"Aucun agent assigné"}</option>
                {availableAgents.map(function (a) { return <option key={a.nm} value={a.nm}>{a.nm}</option>; })}
              </select>
            </div>
            {agentNm ? (
              <div>
                <label style={LS}>{"Tâches assignées"}</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {TACHES_OPTS.map(function (t) {
                    var active = agentTaches.indexOf(t.k) >= 0;
                    return (
                      <button key={t.k} type="button" onClick={function () { toggleTache(t.k); }}
                        style={{ background: active ? "var(--btn-primary-bg)" : "var(--bg-primary)", color: active ? "var(--btn-primary-text)" : "var(--text-tertiary)", border: "1px solid " + (active ? "var(--btn-primary-bg)" : "var(--border)"), borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                        {active ? "✓ " : ""}{t.l}
                      </button>
                    );
                  })}
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, marginTop: 8, cursor: "pointer" }}>
                  <input type="checkbox" checked={agentVoirDep} onChange={function (e) { sAgentVoirDep(e.target.checked); }} />
                  <span>{"L'agent peut voir les dépenses de ce dossier"}</span>
                </label>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 14, marginBottom: 14, background: "var(--bg-tertiary)" }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{"Paramètres métier (auto-stub factures)"}</div>
        <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 10 }}>{"Laisser vide pour appliquer les valeurs par défaut. Renseigner uniquement en cas de dérogation client."}</div>
        <div className="lt-grid2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <div style={{ marginBottom: 12 }}><label style={LS}>{"Franchise compagnie (j)"}</label><input type="number" value={frCp} onChange={function (e) { sFrCp(e.target.value); }} placeholder={String(defFrCp)} style={IS} min={0} max={90} /></div>
          <div style={{ marginBottom: 12 }}><label style={LS}>{"Franchise magasinage (j)"}</label><input type="number" value={frMg} onChange={function (e) { sFrMg(e.target.value); }} placeholder={String(defFrMg) + " (" + td + ")"} style={IS} min={0} max={90} /></div>
          <div style={{ marginBottom: 12 }}><label style={LS}>{"Franchise retour vide (j)"}</label><input type="number" value={frRt} onChange={function (e) { sFrRt(e.target.value); }} placeholder={String(defFrRt) + " (" + regionFromDestination(cr) + ")"} style={IS} min={0} max={90} /></div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 4 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
            <input type="checkbox" checked={besc} onChange={function (e) { sBesc(e.target.checked); }} />
            <span>{"BESC à prévoir"}</span>
          </label>
          {td === "VEHICULE" ? (
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
              <input type="checkbox" checked={ror} onChange={function (e) { sRor(e.target.checked); }} />
              <span>{"Véhicule sur navire (RoRo, pas de retour TC)"}</span>
            </label>
          ) : null}
        </div>
      </div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}><span style={{ fontWeight: 700, fontSize: 13 }}>{"TC (" + String(tc.length) + ")"}</span><Btn variant="ghost" size="sm" onClick={function () { sTc(tc.concat([{ n: "", ty: "20GP", po: "" }])); }}>{"+ TC"}</Btn></div>
        {tc.map(function (t, i) { return <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}><input value={t.n} onChange={function (e) { var a = tc.slice(); a[i] = { n: e.target.value.toUpperCase(), ty: a[i].ty, po: a[i].po }; sTc(a); }} placeholder="XXXX1234567" style={{ flex: 2, padding: "8px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14, background: "var(--bg-secondary)", color: "var(--text-input)" }} /><select value={t.ty} onChange={function (e) { var a = tc.slice(); a[i] = { n: a[i].n, ty: e.target.value, po: a[i].po }; sTc(a); }} style={{ flex: 1, padding: "8px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg-secondary)", color: "var(--text-input)" }}><option>{"20GP"}</option><option>{"40GP"}</option><option>{"40HC"}</option><option>{"45HC"}</option><option>{"20RF"}</option><option>{"40RF"}</option></select><input type="number" value={t.po} onChange={function (e) { var a = tc.slice(); a[i] = { n: a[i].n, ty: a[i].ty, po: e.target.value }; sTc(a); }} placeholder="kg" style={{ flex: 1, padding: "8px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14, background: "var(--bg-secondary)", color: "var(--text-input)" }} />{tc.length > 1 ? <button onClick={function () { sTc(tc.filter(function (_, j) { return j !== i; })); }} style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer" }}>{"x"}</button> : null}</div>; })}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
        <Btn variant="ghost" onClick={p.onClose}>{"Annuler"}</Btn>
        <Btn onClick={function () {
          var v = validateAll({
            bl: [bl, { required: true, maxLen: 30 }],
            cl: [cl, { required: true, maxLen: 50 }],
            cp: [cp, { maxLen: 30 }],
            cr: [cr, { maxLen: 50 }],
            ct: [ct, { maxLen: 20 }],
            ce: [ce, { maxLen: 60, pattern: ce.trim() ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/ : undefined, patternMsg: "Email invalide" }],
            rv: [rv, { minVal: 0, maxVal: 999999999 }],
            pf: [pf, { minVal: 0, maxVal: 999999999 }]
          });
          setVErr(v.errors);
          if (v.hasErrors) { p.nf(v.firstError, "error"); return; }
          // Auto-stub Depenses — normalise les franchises : string "" → undefined,
          // sinon number. Les defaults restent calcules dynamiquement cote getter.
          var out: Record<string, unknown> = {
            bl: bl.trim(), cl: cl.trim(), cp: cp.trim(), cr: cr.trim(), da: da, ct: ct.trim(), ce: ce.trim(),
            // Source de la date arrivee : si l'agent a clique le bouton "ETA CMA", daSrcState='cma'.
            // Sinon, par defaut 'manual' (modification de date a la main ou pas de modif).
            daSrc: daSrcState || (i && i.daSrc) || (da ? 'manual' : undefined),
            gr: gr, gar_contact: garContact.trim(), gar_tel: garTel.trim(),
            gar_frais: parseFloat(garFrais) || 0,
            gar_frais_unit: parseFloat(garFraisUnit) || 0,
            gar_caution: parseFloat(garCaution) || 0,
            gar_caution_unit: parseFloat(garCautionUnit) || 0,
            gar_statut: garStatut,
            bs: bs, bv: bv, as2: as2, nd: nd, pn: pn,
            rv: parseFloat(rv) || 0, pf: parseFloat(pf) || 0,
            td: td, besc: !!besc, ror: !!ror,
          };
          if (frCp !== "") out.frCp = parseInt(frCp, 10);
          if (frMg !== "") out.frMg = parseInt(frMg, 10);
          if (frRt !== "") out.frRt = parseInt(frRt, 10);
          // Agent assigne : preserver les autres intervenants existants (non-AGENT) si modification
          var preservedItv = i && Array.isArray(i.itv) ? i.itv.filter(function (iv: any) { return (iv.role || "").toUpperCase() !== "AGENT"; }) : [];
          if (agentNm) {
            var newAgentItv = {
              id: existingAgentItv && existingAgentItv.id ? existingAgentItv.id : (Math.random().toString(36).slice(2, 12)),
              nm: agentNm,
              role: "AGENT",
              taches: agentTaches.slice(),
              voirDepenses: !!agentVoirDep,
              tachesDone: existingAgentItv ? (existingAgentItv.tachesDone || []) : [],
            };
            out.itv = preservedItv.concat([newAgentItv]);
          } else if (preservedItv.length > 0) {
            out.itv = preservedItv;
          }
          p.onSave(out, tc);
        }}>{p.init ? "Modifier" : "Creer"}</Btn>
      </div>
    </div>
  );
}

export default NDosForm;
