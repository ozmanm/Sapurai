import { useState } from 'react';
import { SL } from '../constants/statuts.js';
import usePagination from '../hooks/usePagination.js';
import Pagination from '../components/ui/Pagination.tsx';

interface ChsProps { chs: any[]; tcs: any[]; dos: any[]; canEdit: boolean; setMl: (ml: any) => void; deleteCh: (id: string) => void; nf: (m: string, t?: string) => void; }

function Chs(p: ChsProps) {
  var chs = p.chs;
  var tcs = p.tcs;
  var dos = p.dos;
  var canEdit = p.canEdit;
  var setMl = p.setMl;
  var deleteCh = p.deleteCh;
  var nf = p.nf;
  var [pendingDel, setPendingDel] = useState(null);
  var [openCh, setOpenCh] = useState(null);
  var [tab, setTab] = useState("TOUS");

  var now = new Date();

  // TCs vraiment actifs d'un chauffeur (règle 15j)
  function getActiveTcs(chName) {
    return tcs.filter(function (tc) {
      if (tc.ch !== chName) return false;
      if (tc.st === "PORT" || tc.st === "ATTENDU" || tc.st === "RETURNED") return false;
      if (tc.dsp) {
        var days = (now.getTime() - new Date(tc.dsp).getTime()) / 86400000;
        if (days >= 15) return false;
      }
      return true;
    });
  }

  // TCs en retour probable (dispatched 15+ days ago, pas encore RETURNED)
  function getRetourTcs(chName) {
    return tcs.filter(function (tc) {
      if (tc.ch !== chName) return false;
      if (tc.st === "PORT" || tc.st === "ATTENDU" || tc.st === "RETURNED") return false;
      if (!tc.dsp) return false;
      var days = (now.getTime() - new Date(tc.dsp).getTime()) / 86400000;
      return days >= 15;
    });
  }

  // TCs à 14j (rappeler bientôt)
  function getNearReturnTcs(chName) {
    return tcs.filter(function (tc) {
      if (tc.ch !== chName) return false;
      if (tc.st === "PORT" || tc.st === "ATTENDU" || tc.st === "RETURNED") return false;
      if (!tc.dsp) return false;
      var days = (now.getTime() - new Date(tc.dsp).getTime()) / 86400000;
      return days >= 14 && days < 15;
    });
  }

  function totalMissions(chName) { return tcs.filter(function (tc) { return tc.ch === chName; }).length; }

  function lastMissionDate(chName) {
    var chTcs = tcs.filter(function (tc) { return tc.ch === chName && tc.dsp; });
    if (chTcs.length === 0) return null;
    return chTcs.reduce(function (max, tc) { return tc.dsp > max ? tc.dsp : max; }, chTcs[0].dsp);
  }

  var t30 = new Date(now.getTime() - 30 * 86400000);
  var missions30j = tcs.filter(function (tc) { return tc.dsp && new Date(tc.dsp) >= t30; }).length;

  var actifs = chs.filter(function (c) { return !c.bl; });
  var blacklistes = chs.filter(function (c) { return c.bl; });
  var enMission = actifs.filter(function (c) { return getActiveTcs(c.nm).length > 0; });
  var enRetour = actifs.filter(function (c) { return getActiveTcs(c.nm).length === 0 && getRetourTcs(c.nm).length > 0; });
  var dispos = actifs.filter(function (c) { return getActiveTcs(c.nm).length === 0 && getRetourTcs(c.nm).length === 0; });
  var allChs = actifs.concat(blacklistes);
  var tabFiltered = tab === "TOUS" ? allChs
    : tab === "DISPOS" ? dispos
    : tab === "MISSION" ? enMission
    : tab === "RETOUR" ? enRetour
    : tab === "BLACKLISTE" ? blacklistes
    : allChs;
  var pg = usePagination(tabFiltered, 30);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>{"Chauffeurs"}</h1>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>{String(actifs.length) + " actif(s)" + (blacklistes.length > 0 ? " \u2022 " + String(blacklistes.length) + " blackliste(s)" : "")}</div>
        </div>
        {canEdit ? <button onClick={function () { setMl({ t: "nch" }); }} style={{ background: "var(--btn-primary-bg)", color: "var(--btn-primary-text)", border: "none", borderRadius: 8, padding: "10px 18px", fontWeight: 600, cursor: "pointer", minHeight: 44, fontSize: 13 }}>{"+ Nouveau chauffeur"}</button> : null}
      </div>

      {chs.length === 0 ? <div style={{ background: "var(--bg-primary)", borderRadius: 12, padding: 50, textAlign: "center", border: "1px solid var(--border)" }}><div style={{ fontSize: 40, marginBottom: 10 }}>{"\uD83D\uDE9B"}</div><div style={{ color: "var(--text-secondary)", fontSize: 15, fontWeight: 600, marginBottom: 14 }}>{"Ajoutez vos chauffeurs pour le dispatch"}</div>{canEdit ? <button onClick={function () { setMl({ t: "nch" }); }} style={{ background: "var(--btn-primary-bg)", color: "var(--btn-primary-text)", border: "none", borderRadius: 8, padding: "10px 18px", fontWeight: 600, cursor: "pointer", minHeight: 44, fontSize: 13 }}>{"+ Ajouter"}</button> : null}</div> : (
        <div>
          {/* Tabs */}
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            {[
              { key: "TOUS", label: "Tous", count: allChs.length, color: "var(--text-primary)" },
              { key: "DISPOS", label: "Disponibles", count: dispos.length, color: "var(--success)" },
              { key: "MISSION", label: "En mission", count: enMission.length, color: "var(--info)" },
              enRetour.length > 0 ? { key: "RETOUR", label: "En retour", count: enRetour.length, color: "var(--warning)" } : null,
              blacklistes.length > 0 ? { key: "BLACKLISTE", label: "Blacklistes", count: blacklistes.length, color: "var(--danger)" } : null
            ].filter(Boolean).map(function (t) {
              var active = tab === t.key;
              return <button key={t.key} onClick={function () { setTab(t.key); }} style={{
                background: active ? "var(--btn-primary-bg)" : "var(--bg-primary)",
                color: active ? "var(--btn-primary-text)" : "var(--text-secondary)",
                border: active ? "none" : "1px solid var(--border)",
                borderRadius: 8, padding: "8px 16px", fontWeight: 700,
                cursor: "pointer", fontSize: 13, minHeight: 44
              }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: active ? "var(--btn-primary-text)" : t.color }}>{String(t.count)}</div>
                <div style={{ fontSize: 11 }}>{t.label}</div>
              </button>;
            })}
            <div style={{ background: "var(--success-bg)", border: "1px solid var(--success-border)", borderRadius: 8, padding: "8px 16px", textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: "var(--success)" }}>{String(missions30j)}</div>
              <div style={{ fontSize: 11, color: "var(--success-text)" }}>{"Missions 30j"}</div>
            </div>
          </div>

          {/* Table view */}
          <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
            <div className="lt-hide-mobile" style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 1fr 1.2fr 80px 100px", gap: 0, background: "var(--bg-tertiary)", borderBottom: "1px solid var(--border)" }}>
              {["Chauffeur", "Camion / Tracteur", "Poids max", "Missions", "Types TC", "Statut", ""].map(function (h) {
                return <div key={h} style={{ padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.3 }}>{h}</div>;
              })}
            </div>
            {pg.paginated.map(function (c) {
              var activeTcs = getActiveTcs(c.nm);
              var retourTcs = getRetourTcs(c.nm);
              var nearReturn = getNearReturnTcs(c.nm);
              var missions = activeTcs.length;
              var total = totalMissions(c.nm);
              var lastMiss = lastMissionDate(c.nm);
              var lastMissStr = lastMiss ? new Date(lastMiss).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" }) : null;
              var chHistory = tcs.filter(function (tc) { return tc.ch === c.nm; }).slice().sort(function (a, b) { return (b.dsp || "").localeCompare(a.dsp || ""); });
              var isRetour = missions === 0 && retourTcs.length > 0;
              var dispo = !c.bl && missions === 0 && retourTcs.length === 0;
              return <div key={c.id}>
                {/* Desktop row */}
                <div className="lt-hide-mobile" style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 1fr 1.2fr 80px 100px", gap: 0, alignItems: "center", borderBottom: "1px solid var(--border-light)", opacity: c.bl ? 0.6 : 1 }}>
                  <div style={{ padding: "12px 12px" }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)" }}>{c.nm || "?"}</div>
                    {c.tl ? <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 1 }}>{c.tl}</div> : null}
                  </div>
                  <div style={{ padding: "12px 12px" }}>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600, color: "var(--text-input)" }}>{c.cm || "---"}</div>
                    {c.tr ? <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" }}>{c.tr}</div> : null}
                  </div>
                  <div style={{ padding: "12px 12px", fontSize: 12, color: c.pm ? "var(--text-input)" : "var(--danger)" }}>{c.pm ? String(c.pm) + " kg" : "! manquant"}</div>
                  <div style={{ padding: "12px 12px" }}>
                    {missions > 0 ? (
                      <div>
                        <span style={{ background: "var(--bg-tertiary)", color: "var(--info)", padding: "2px 8px", borderRadius: 8, fontSize: 11, fontWeight: 700 }}>{String(missions) + " en cours"}</span>
                        {nearReturn.length > 0 ? <div style={{ fontSize: 10, color: "var(--warning)", fontWeight: 700, marginTop: 2 }}>{"\u26A0 14j+"}</div> : null}
                      </div>
                    ) : isRetour ? (
                      <span style={{ background: "var(--warning-bg)", color: "var(--warning-text)", padding: "2px 8px", borderRadius: 8, fontSize: 11, fontWeight: 700 }}>{String(retourTcs.length) + " en retour"}</span>
                    ) : (
                      <div>
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{total > 0 ? String(total) + " total" : "---"}</span>
                        {lastMissStr ? <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 1 }}>{"Dern. : " + lastMissStr}</div> : null}
                      </div>
                    )}
                  </div>
                  <div style={{ padding: "12px 12px", display: "flex", gap: 3, flexWrap: "wrap" }}>
                    {c.tty && c.tty.length > 0 ? c.tty.map(function (ty) { return <span key={ty} style={{ background: "var(--bg-secondary)", color: "var(--text-tertiary)", padding: "1px 6px", borderRadius: 6, fontSize: 10, fontWeight: 600 }}>{ty}</span>; }) : <span style={{ fontSize: 11, color: "var(--danger)", fontWeight: 600 }}>{"! aucun"}</span>}
                  </div>
                  <div style={{ padding: "12px 8px" }}>
                    {c.bl ? <span style={{ background: "var(--danger-bg)", color: "var(--danger)", padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700 }}>{"Blackliste"}</span>
                      : dispo ? <span style={{ background: "var(--success-bg)", color: "var(--success)", padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700 }}>{"Dispo"}</span>
                      : isRetour ? <span style={{ background: "var(--warning-bg)", color: "var(--warning)", padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700 }}>{"En retour"}</span>
                      : <span style={{ background: "var(--bg-tertiary)", color: "var(--info)", padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700 }}>{"Occupe"}</span>}
                  </div>
                  <div style={{ padding: "12px 8px", display: "flex", gap: 4 }}>
                    <button onClick={function () { setOpenCh(openCh === c.id ? null : c.id); }} title="Historique missions" style={{ background: openCh === c.id ? "var(--btn-primary-bg)" : "var(--bg-secondary)", color: openCh === c.id ? "var(--btn-primary-text)" : "var(--text-tertiary)", border: "none", cursor: "pointer", fontSize: 12, padding: "2px 7px", borderRadius: 6, fontWeight: 600 }}>{"\uD83D\uDCCB"}</button>
                    <button onClick={function () {
                      var msg = "\uD83D\uDE9B INFOS CHAUFFEUR\n";
                      msg += "Nom: " + (c.nm || "?") + "\n";
                      if (c.tl) msg += "Tel: " + c.tl + "\n";
                      msg += "Camion: " + (c.cm || "---") + "\n";
                      if (c.tr) msg += "Tracteur: " + c.tr + "\n";
                      if (c.pm) msg += "Poids max: " + String(c.pm) + " kg\n";
                      if (c.tty && c.tty.length > 0) msg += "Types TC: " + c.tty.join(", ") + "\n";
                      var chTcs = tcs.filter(function (tc) { return tc.ch === c.nm && tc.st !== "RETURNED"; });
                      if (chTcs.length > 0) {
                        msg += "\n\uD83D\uDCE6 CONTENEUR(S) ASSIGNE(S):\n";
                        chTcs.forEach(function (tc) {
                          var d = dos.find(function (x) { return x.id === tc.did; });
                          if (d) {
                            msg += "\n--- DOSSIER ---\n";
                            msg += "Client: " + (d.cl || "?") + "\n";
                            msg += "BL: " + (d.bl || "?") + "\n";
                            if (d.cp) msg += "Compagnie: " + d.cp + "\n";
                            if (d.cr) msg += "Destination: " + d.cr + "\n";
                            msg += "TC: " + (tc.n || "?") + " (" + (tc.ty || "") + ")" + (tc.po ? " - " + tc.po + " kg" : "") + "\n";
                            msg += "Statut TC: " + (SL[tc.st] || tc.st) + "\n";
                            if (d.nd) msg += "N\u00B0 Declaration: " + d.nd + "\n";
                            msg += "BAD: " + (d.bs === "OBTENU" ? "\u2705 Obtenu" : d.bs === "EN_COURS" ? "\u23F3 En cours" : "\u274C Non demande") + "\n";
                            msg += "BAE: " + (d.as2 === "OBTENU" ? "\u2705 Obtenu" : d.as2 === "EN_COURS" ? "\u23F3 En cours" : "\u274C Non demande") + "\n";
                            if (d.pn) msg += "Pregate: " + d.pn + "\n";
                          }
                        });
                      }
                      if (navigator.share) {
                        navigator.share({ text: msg }).catch(function () {
                          if (navigator.clipboard) navigator.clipboard.writeText(msg).then(function () { nf("Copie !"); });
                        });
                      } else if (navigator.clipboard) {
                        navigator.clipboard.writeText(msg).then(function () { nf("Infos copiees - collez dans WhatsApp !"); });
                      }
                    }} title="Partager aux agents" style={{ background: "var(--bg-secondary)", border: "none", cursor: "pointer", fontSize: 13, padding: "2px 6px", borderRadius: 6 }}>{"\uD83D\uDCE4"}</button>
                    {canEdit ? <button onClick={function () { setMl({ t: "ech", cid: c.id }); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, padding: 2 }}>{"\u270F\uFE0F"}</button> : null}
                    {canEdit ? (pendingDel === c.id ? (
                      <span style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        <button onClick={function () { setPendingDel(null); deleteCh(c.id); }} style={{ background: "var(--danger)", color: "white", border: "none", borderRadius: 6, padding: "2px 6px", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>{"Oui"}</button>
                        <button onClick={function () { setPendingDel(null); }} style={{ background: "var(--bg-secondary)", border: "none", borderRadius: 6, padding: "2px 6px", fontSize: 10, cursor: "pointer" }}>{"Non"}</button>
                      </span>
                    ) : (
                      <button onClick={function () { setPendingDel(c.id); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, padding: 2, color: "var(--danger)" }}>{"x"}</button>
                    )) : null}
                  </div>
                </div>
                {/* Mobile row */}
                <div className="lt-show-mobile" style={{ display: "none", padding: "12px 14px", borderBottom: "1px solid var(--border-light)", opacity: c.bl ? 0.6 : 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 6 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>{c.nm || "?"}</div>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>{(c.cm || "---") + (c.tr ? " / " + c.tr : "")}</div>
                      {c.tl ? <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>{"\uD83D\uDCDE " + c.tl}</div> : null}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                      {c.bl ? <span style={{ background: "var(--danger-bg)", color: "var(--danger)", padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700 }}>{"Blackliste"}</span>
                        : dispo ? <span style={{ background: "var(--success-bg)", color: "var(--success)", padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700 }}>{"Dispo"}</span>
                        : isRetour ? <span style={{ background: "var(--warning-bg)", color: "var(--warning)", padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700 }}>{"En retour"}</span>
                        : <span style={{ background: "var(--bg-tertiary)", color: "var(--info)", padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700 }}>{"Occupe"}</span>}
                      {missions > 0 ? <span style={{ fontSize: 11, fontWeight: 600, color: "var(--info)" }}>{String(missions) + " mission(s)"}</span> : null}
                      {nearReturn.length > 0 ? <span style={{ fontSize: 10, color: "var(--warning)", fontWeight: 700 }}>{"\u26A0 Rappeler !"}</span> : null}
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                      {c.pm ? <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{String(c.pm) + " kg"}</span> : null}
                      {c.pm && c.tty && c.tty.length > 0 ? <span style={{ color: "var(--border)" }}>{"\u2022"}</span> : null}
                      {c.tty && c.tty.length > 0 ? c.tty.map(function (ty) { return <span key={ty} style={{ background: "var(--bg-secondary)", color: "var(--text-tertiary)", padding: "1px 5px", borderRadius: 6, fontSize: 10, fontWeight: 600 }}>{ty}</span>; }) : null}
                    </div>
                    {canEdit ? <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button onClick={function () {
                        var msg = "\uD83D\uDE9B INFOS CHAUFFEUR\nNom: " + (c.nm || "?") + "\n";
                        if (c.tl) msg += "Tel: " + c.tl + "\n";
                        msg += "Camion: " + (c.cm || "---") + "\n";
                        if (c.tr) msg += "Tracteur: " + c.tr + "\n";
                        if (c.pm) msg += "Poids max: " + String(c.pm) + " kg\n";
                        var chTcs2 = tcs.filter(function (tc) { return tc.ch === c.nm && tc.st !== "RETURNED"; });
                        if (chTcs2.length > 0) {
                          msg += "\n\uD83D\uDCE6 CONTENEUR(S):\n";
                          chTcs2.forEach(function (tc) {
                            var d = dos.find(function (x) { return x.id === tc.did; });
                            if (d) {
                              msg += "\nClient: " + (d.cl || "?") + " | BL: " + (d.bl || "?") + "\n";
                              msg += "TC: " + (tc.n || "?") + " (" + (tc.ty || "") + ")\n";
                              if (d.nd) msg += "Declaration: " + d.nd + "\n";
                              msg += "BAD: " + (d.bs === "OBTENU" ? "\u2705" : "\u274C") + " BAE: " + (d.as2 === "OBTENU" ? "\u2705" : "\u274C") + "\n";
                              if (d.pn) msg += "Pregate: " + d.pn + "\n";
                            }
                          });
                        }
                        if (navigator.share) {
                          navigator.share({ text: msg }).catch(function () {
                            if (navigator.clipboard) navigator.clipboard.writeText(msg).then(function () { nf("Copie !"); });
                          });
                        } else if (navigator.clipboard) {
                          navigator.clipboard.writeText(msg).then(function () { nf("Infos copiees !"); });
                        }
                      }} style={{ background: "var(--btn-primary-bg)", color: "var(--btn-primary-text)", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600, padding: "5px 12px" }}>{"\uD83D\uDCE4 Partager"}</button>
                      <button onClick={function () { setMl({ t: "ech", cid: c.id }); }} style={{ background: "var(--bg-secondary)", border: "none", borderRadius: 6, cursor: "pointer", color: "var(--text-primary)", fontSize: 12, fontWeight: 600, padding: "5px 10px" }}>{"Modifier"}</button>
                      {pendingDel === c.id ? (
                        <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <button onClick={function () { setPendingDel(null); deleteCh(c.id); }} style={{ background: "var(--danger)", color: "white", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{"Oui"}</button>
                          <button onClick={function () { setPendingDel(null); }} style={{ background: "var(--bg-secondary)", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 12, cursor: "pointer" }}>{"Non"}</button>
                        </span>
                      ) : (
                        <button onClick={function () { setPendingDel(c.id); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", fontSize: 12 }}>{"Suppr."}</button>
                      )}
                    </div> : <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={function () {
                        var msg = "\uD83D\uDE9B " + (c.nm || "?") + "\nCamion: " + (c.cm || "---") + (c.tl ? "\nTel: " + c.tl : "") + "\n";
                        if (navigator.share) { navigator.share({ text: msg }).catch(function () {}); }
                        else if (navigator.clipboard) { navigator.clipboard.writeText(msg).then(function () { nf("Copie !"); }); }
                      }} style={{ background: "var(--btn-primary-bg)", color: "var(--btn-primary-text)", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600, padding: "5px 12px" }}>{"\uD83D\uDCE4 Partager"}</button>
                    </div>}
                  </div>
                  {c.bl && c.blr ? <div style={{ marginTop: 6, fontSize: 11, color: "var(--danger)", background: "var(--danger-bg)", padding: "4px 8px", borderRadius: 6 }}>{"\u26A0\uFE0F " + c.blr}</div> : null}
                  <button onClick={function () { setOpenCh(openCh === c.id ? null : c.id); }} style={{ marginTop: 8, background: openCh === c.id ? "var(--btn-primary-bg)" : "var(--bg-secondary)", color: openCh === c.id ? "var(--btn-primary-text)" : "var(--text-tertiary)", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600, padding: "5px 12px" }}>{"\uD83D\uDCCB " + (openCh === c.id ? "Fermer" : "Historique")}</button>
                </div>
              {openCh === c.id ? (
                <div style={{ background: "var(--bg-tertiary)", borderTop: "1px solid var(--border)", padding: "12px 14px" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>{"Historique missions (" + String(chHistory.length) + ")"}</div>
                  {chHistory.length === 0 ? (
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{"Aucune mission enregistree"}</div>
                  ) : chHistory.map(function (tc, idx) {
                    var dh = dos.find(function (x) { return x.id === tc.did; });
                    return (
                      <div key={tc.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: idx < chHistory.length - 1 ? "1px solid var(--border-light)" : "none" }}>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>{(tc.n || "?") + " \u2014 " + (tc.ty || "")}</div>
                          {dh ? <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 1 }}>{(dh.cl || "?") + " \u00B7 BL " + (dh.bl || "")}</div> : null}
                          {tc.dsp ? <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 1 }}>{"Dep. " + new Date(tc.dsp).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" })}</div> : null}
                        </div>
                        <span style={{ background: tc.st === "RETURNED" ? "var(--success-bg)" : "var(--bg-tertiary)", color: tc.st === "RETURNED" ? "var(--success)" : "var(--info)", padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{SL[tc.st] || tc.st}</span>
                      </div>
                    );
                  })}
                </div>
              ) : null}
              </div>;
            })}
            <div className="lt-hide-mobile" style={{ padding: "10px 12px", background: "var(--bg-tertiary)", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-secondary)", fontWeight: 600 }}>
              <span>{String(chs.length) + " chauffeur(s)"}</span>
              <span>{String(enMission.length) + " en mission \u00B7 " + String(enRetour.length) + " en retour"}</span>
            </div>
          </div>
          {pg.totalPages > 1 ? <Pagination page={pg.page} setPage={pg.setPage} totalPages={pg.totalPages} total={pg.total} /> : null}
        </div>
      )}
    </div>
  );
}

export default Chs;
