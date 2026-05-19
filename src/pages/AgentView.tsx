import { SL } from '../constants/statuts.js';
import { fd, fm } from '../utils/format.js';
import { textColorFor } from '../utils/contrast.js';
import { DTL } from '../constants/depenses.js';
import { mid } from '../utils/id.js';
import { fileStore } from '../fileStore.js';
import type { ChangeEvent } from 'react';
import type { Dossier, Conteneur, Depense, Intervenant } from '../types.js';

// Notification type-minimal (utilise par notifs liste, contenu opaque cote AgentView)
type Notif = Record<string, unknown>;

// Utilise les tokens --sc-* / --sb-* de theme.css (theme-aware light/dark)
var ST_BG: Record<string, string> = { PORT: "var(--sc-port)", DISPATCHE: "var(--sc-dispatche)", TRANSIT: "var(--sc-transit)", KATI: "var(--sc-kati)", BAMAKO: "var(--sc-bamako)", RETURNED: "var(--sc-returned)" };
var TK_LBL: Record<string, string> = { BAD: "BAD", BAE: "BAE/Douane", PREGATE: "Pregate", TRANSIT: "Transit", LIVRAISON: "Livraison", MANUT: "Manutention", FACT: "Facturation" };

// Status d'une tache sur le dossier (lit le champ correspondant)
function getTacheStatus(d: Dossier, tacheKey: string): { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' } {
  if (tacheKey === 'BAD') {
    if (d.bs === 'OBTENU') return { label: 'Obtenu', tone: 'success' };
    if (d.bs === 'EN_COURS') return { label: 'En cours', tone: 'warning' };
    return { label: 'A demander', tone: 'danger' };
  }
  if (tacheKey === 'BAE') {
    if (d.as2 === 'OBTENU') return { label: 'Obtenu', tone: 'success' };
    if (d.as2 === 'EN_COURS') return { label: 'En cours', tone: 'warning' };
    return { label: 'A demander', tone: 'danger' };
  }
  if (tacheKey === 'PREGATE') {
    if (d.pn) return { label: 'N° ' + d.pn, tone: 'success' };
    return { label: 'A obtenir', tone: 'warning' };
  }
  return { label: '\u2014', tone: 'neutral' };
}

function toneVars(tone: 'success' | 'warning' | 'danger' | 'neutral') {
  if (tone === 'success') return { bg: 'var(--success-bg)', col: 'var(--success-text)', bd: 'var(--success-border)' };
  if (tone === 'warning') return { bg: 'var(--warning-bg)', col: 'var(--warning-text)', bd: 'var(--warning-border)' };
  if (tone === 'danger') return { bg: 'var(--danger-bg)', col: 'var(--danger-text)', bd: 'var(--danger-border)' };
  return { bg: 'var(--bg-secondary)', col: 'var(--text-tertiary)', bd: 'var(--border)' };
}

// Donnees DB minimales requises par AgentView (handleUpload mutate db.dos)
interface AgentDb {
  dos?: Dossier[];
  [k: string]: unknown;
}

interface AgentViewProps {
  dos: Dossier[];
  tcs: Conteneur[];
  dep?: Depense[];
  agentName: string;
  notifs: Notif[];
  markNotifsRead: () => void;
  logout: () => void;
  markTaskDone: (dosId: string, itvId: string, taskKey: string, done: boolean) => void;
  advance?: (tid: string, ns: string, dt?: string) => void;
  patchDos?: (dosId: string, fields: Record<string, unknown>) => void;
  sv?: (data: AgentDb) => void;
  db?: AgentDb;
  companyId?: string;
  notifyAdmins?: (msg: string) => void;
  companyName?: string;
}

function AgentView(p: AgentViewProps) {
  var dos = p.dos;
  var tcs = p.tcs;
  var dep = p.dep || [];
  var agentName = p.agentName || "";
  var notifs = p.notifs || [];
  var markNotifsRead = p.markNotifsRead;
  var companyName = p.companyName || "Sapurai";

  // Tâches habituelles globales : derivees de l'union de toutes les taches sur ses dossiers
  var globalTaches: string[] = [];
  dos.forEach(function (d) {
    (d.itv || []).forEach(function (i: Intervenant) {
      if ((i.nm || '').toUpperCase() !== agentName.toUpperCase()) return;
      (i.taches || []).forEach(function (t: string) {
        if (globalTaches.indexOf(t) < 0) globalTaches.push(t);
      });
    });
  });

  // Sprint C.2 — actions agent qui notifient l'admin systematiquement
  function notify(msg: string) {
    if (p.notifyAdmins) p.notifyAdmins(msg);
  }

  function cycleDocStatus(d: Dossier, field: 'bs' | 'as2') {
    if (!p.patchDos) return;
    var cur = d[field] || "NON_DEMANDE";
    var next = cur === "NON_DEMANDE" ? "EN_COURS" : cur === "EN_COURS" ? "OBTENU" : "NON_DEMANDE";
    p.patchDos(d.id, { [field]: next });
    var lbl = field === "bs" ? "BAD" : "BAE";
    notify(agentName + " a mis a jour " + lbl + " -> " + next + " sur " + (d.cl || "?") + " " + (d.bl || ""));
  }

  function setPregate(d: Dossier, val: string) {
    if (!p.patchDos) return;
    p.patchDos(d.id, { pn: val });
    notify(agentName + " a saisi le pregate " + val + " sur " + (d.cl || "?") + " " + (d.bl || ""));
  }

  function advanceTc(d: Dossier, tc: Conteneur, ns: string) {
    if (!p.advance) return;
    p.advance(tc.id, ns);
    notify(agentName + " a fait avancer " + (tc.n || "?") + " -> " + (SL[ns] || ns) + " (" + (d.cl || "?") + ")");
  }

  function handleUpload(d: Dossier, file: File) {
    if (!p.sv || !p.db || !file) return;
    var ext = (file.name.split(".").pop() || "").toLowerCase();
    if (ext !== "pdf" && ext !== "jpg" && ext !== "jpeg" && ext !== "png") return;
    if (file.size > 4 * 1024 * 1024) return;
    var reader = new FileReader();
    reader.onload = function (ev: ProgressEvent<FileReader>) {
      var fid = (p.companyId ? p.companyId + "-" : "") + mid();
      var fileData = ev.target?.result;
      // readAsDataURL renvoie toujours string (sinon le file n'est pas readable)
      if (!fileData || typeof fileData !== 'string') return;
      fileStore.set("lt-file-" + fid, fileData).then(function () {
        var newDoc = { id: mid(), tp: "AUTRE", fn: file.name, ft: file.type, sz: file.size, dt: new Date().toISOString(), fid: fid };
        var existingDocs = d.docs || [];
        var newDos = (p.db!.dos || []).map(function (x) {
          return x.id === d.id ? Object.assign({}, x, { docs: existingDocs.concat([newDoc]) }) : x;
        });
        p.sv!(Object.assign({}, p.db, { dos: newDos }));
        notify(agentName + " a uploade un document (" + file.name + ") sur " + (d.cl || "?") + " " + (d.bl || ""));
      });
    };
    reader.readAsDataURL(file);
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-secondary)", fontFamily: "var(--font-sans)" }}>
      {/* Header */}
      <div style={{ background: "var(--bg-primary)", borderBottom: "1px solid var(--border)", padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 100 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 900, color: "var(--text-primary)", letterSpacing: 1 }}>
            {companyName}
            {notifs.length > 0 ? <span style={{ marginLeft: 8, background: "var(--danger)", color: "white", borderRadius: 999, fontSize: 11, fontWeight: 700, padding: "1px 7px" }}>{String(notifs.length)}</span> : null}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 1 }}>
            {agentName || "Agent"}
            {globalTaches.length > 0 ? <span style={{ marginLeft: 6, color: "var(--text-secondary)" }}>{"\u00B7 " + globalTaches.map(function (t) { return TK_LBL[t] || t; }).join(", ")}</span> : null}
          </div>
        </div>
        <button onClick={p.logout} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "var(--text-tertiary)", minHeight: 44 }}>{"Déconnexion"}</button>
      </div>

      {/* Notifications banner */}
      {notifs.length > 0 ? (
        <div style={{ background: "var(--warning-bg)", borderBottom: "1px solid var(--warning-border)", padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--warning-text)" }}>{"\uD83D\uDD14 " + String(notifs.length) + " nouvelle(s) notification(s)"}</span>
            <div style={{ fontSize: 12, color: "var(--warning-text)", marginTop: 2 }}>{String((notifs[0] as { msg?: string }).msg || "")}</div>
          </div>
          <button onClick={function () { if (markNotifsRead) markNotifsRead(); }} style={{ background: "var(--warning)", color: "white", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", minHeight: 44, flexShrink: 0 }}>{"OK"}</button>
        </div>
      ) : null}

      <div style={{ padding: "12px 12px 80px 12px", maxWidth: 600, margin: "0 auto" }}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)" }}>{"Mes dossiers"}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{String(dos.length) + " dossier(s) assigne(s)"}</div>
        </div>

        {dos.length === 0 ? (
          <div style={{ background: "var(--bg-primary)", borderRadius: 12, padding: 32, textAlign: "center", border: "1px solid var(--border)" }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>{"\u23F3"}</div>
            <div style={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>{"En attente d'assignation"}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>{"Votre responsable vous assignera des dossiers depuis Parametres \u2192 Equipe \u2192 Gerer assignations. Vous serez notifie automatiquement."}</div>
          </div>
        ) : null}

        {dos.map(function (d) {
          var dosTcs = tcs.filter(function (t) { return t.did === d.id; });
          var myItv: Intervenant[] = (d.itv || []).filter(function (i: Intervenant) { return (i.nm || "").toUpperCase() === agentName.toUpperCase(); });
          var totalTaches = myItv.reduce(function (s: number, iv: Intervenant) { return s + (iv.taches || []).length; }, 0);
          var doneTaches = myItv.reduce(function (s: number, iv: Intervenant) { return s + (iv.tachesDone || []).filter(function (k: string) { return (iv.taches || []).indexOf(k) >= 0; }).length; }, 0);
          var allDone = totalTaches > 0 && doneTaches === totalTaches;
          // Permission : agent voit les depenses de ce dossier ?
          var canSeeDep = myItv.some(function (i: Intervenant) { return !!i.voirDepenses; });
          var dosDep: Depense[] = canSeeDep ? dep.filter(function (f) { return f.did === d.id && !(f as Depense & { ignored?: boolean }).ignored; }) : [];
          var totalTtc = dosDep.reduce(function (s: number, f) { return s + (f.mt || 0); }, 0);
          var totalPaye = dosDep.reduce(function (s: number, f) { return s + (f.s === 'PAYE' ? (f.mt || 0) : 0); }, 0);

          return (
            <div key={d.id} style={{ background: "var(--bg-primary)", borderRadius: 12, padding: 16, marginBottom: 12, border: "1px solid " + (allDone ? "var(--success-border)" : "var(--border)"), boxShadow: "0 1px 4px var(--shadow)" }}>
              {/* Dossier header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)" }}>{d.cl || "?"}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginTop: 2 }}>{(d.bl || "") + (d.cp ? " \u00B7 " + d.cp : "")}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                  {d.da ? <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{fd(d.da)}</div> : null}
                  {totalTaches > 0 ? (
                    <div style={{ background: allDone ? "var(--success-light)" : "var(--warning-bg)", color: allDone ? "var(--success-text)" : "var(--warning-text)", borderRadius: 6, padding: "2px 8px", fontSize: 10, fontWeight: 700 }}>
                      {String(doneTaches) + "/" + String(totalTaches) + " taches"}
                    </div>
                  ) : null}
                </div>
              </div>

              {/* TC statuses */}
              {dosTcs.length > 0 ? (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                  {dosTcs.map(function (tc) {
                    return (
                      <div key={tc.id} style={{ background: "var(--bg-secondary)", borderRadius: 8, padding: "6px 10px", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--text-primary)" }}>{tc.n || "?"}</span>
                        {(function () {
                          var bg = ST_BG[tc.st] || "var(--text-secondary)";
                          var txt = bg.startsWith("#") ? textColorFor(bg) : "white";
                          return <span style={{ background: bg, color: txt, padding: "2px 7px", borderRadius: 6, fontSize: 10, fontWeight: 700 }}>{SL[tc.st] || tc.st}</span>;
                        })()}
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {/* My tasks per intervenant entry — chaque tache montre son statut reel sur le dossier */}
              {myItv.map(function (iv: Intervenant) {
                return (
                  <div key={iv.id} style={{ borderTop: "1px solid var(--border-light)", paddingTop: 10 }}>
                    {(iv.taches || []).length === 0 ? (
                      <div style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>{"Acces lecture seule \u2014 aucune tache assignee"}</div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {(iv.taches || []).map(function (tk: string) {
                          var done = (iv.tachesDone || []).indexOf(tk) >= 0;
                          var st = getTacheStatus(d, tk);
                          var t = toneVars(st.tone);
                          return (
                            <div key={tk} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, background: "var(--bg-secondary)", borderRadius: 8, padding: "8px 10px" }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{TK_LBL[tk] || tk}</div>
                                <div style={{ display: "inline-block", marginTop: 2, fontSize: 10, fontWeight: 700, background: t.bg, color: t.col, border: "1px solid " + t.bd, borderRadius: 6, padding: "1px 7px" }}>{st.label}</div>
                              </div>
                              <button onClick={function () { p.markTaskDone(d.id, iv.id, tk, !done); }} style={{ background: done ? "var(--success)" : "var(--bg-primary)", color: done ? "white" : "var(--text-input)", border: "1px solid " + (done ? "var(--success)" : "var(--border)"), borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", minHeight: 44, whiteSpace: "nowrap" as const, flexShrink: 0 }}>
                                {done ? "\u2713 Termine" : "Marquer fait"}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Sprint C.2 — Actions rapides agent (cycles docs + advance TC + upload) */}
              {p.patchDos || p.advance || p.sv ? (
                <div style={{ borderTop: "1px solid var(--border-light)", paddingTop: 10, marginTop: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>{"Actions rapides"}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                    {p.patchDos ? (
                      <button onClick={function () { cycleDocStatus(d, 'bs'); }} style={{ background: d.bs === 'OBTENU' ? "var(--success-light)" : d.bs === 'EN_COURS' ? "var(--warning-bg)" : "var(--bg-secondary)", color: d.bs === 'OBTENU' ? "var(--success-text)" : d.bs === 'EN_COURS' ? "var(--warning-text)" : "var(--text-tertiary)", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 8px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                        {"BAD: " + (d.bs === 'OBTENU' ? "Obtenu" : d.bs === 'EN_COURS' ? "En cours" : "A faire")}
                      </button>
                    ) : null}
                    {p.patchDos ? (
                      <button onClick={function () { cycleDocStatus(d, 'as2'); }} style={{ background: d.as2 === 'OBTENU' ? "var(--success-light)" : d.as2 === 'EN_COURS' ? "var(--warning-bg)" : "var(--bg-secondary)", color: d.as2 === 'OBTENU' ? "var(--success-text)" : d.as2 === 'EN_COURS' ? "var(--warning-text)" : "var(--text-tertiary)", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 8px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                        {"BAE: " + (d.as2 === 'OBTENU' ? "Obtenu" : d.as2 === 'EN_COURS' ? "En cours" : "A faire")}
                      </button>
                    ) : null}
                    {p.patchDos ? (
                      <button onClick={function () { var v = window.prompt("Numero pregate ?", d.pn || ""); if (v !== null) setPregate(d, v); }} style={{ background: d.pn ? "var(--success-light)" : "var(--bg-secondary)", color: d.pn ? "var(--success-text)" : "var(--text-tertiary)", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 8px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                        {d.pn ? "Pregate: " + d.pn : "Pregate (saisir)"}
                      </button>
                    ) : null}
                  </div>
                  {/* Advance TC : un bouton par TC actif */}
                  {p.advance ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                      {dosTcs.filter(function (tc) { return tc.st !== "ATTENDU" && tc.st !== "RETURNED"; }).map(function (tc) {
                        var nextSt = tc.st === "PORT" ? null : tc.st === "DISPATCHE" ? "TRANSIT" : tc.st === "TRANSIT" ? "KATI" : tc.st === "KATI" ? "BAMAKO" : tc.st === "BAMAKO" ? "RETURNED" : null;
                        if (!nextSt) return null;
                        return (
                          <button key={tc.id} onClick={function () { advanceTc(d, tc, nextSt!); }} style={{ background: "var(--info-bg)", color: "var(--info-text)", border: "1px solid var(--info-border)", borderRadius: 6, padding: "4px 8px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                            {(tc.n || "?") + " → " + (SL[nextSt] || nextSt)}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                  {/* Upload document */}
                  {p.sv ? (
                    <label style={{ display: "inline-block", background: "var(--bg-secondary)", border: "1px dashed var(--border)", borderRadius: 6, padding: "6px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer", color: "var(--text-tertiary)" }}>
                      {"📎 Joindre document"}
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={function (e: ChangeEvent<HTMLInputElement>) { var f = e.target.files && e.target.files[0]; if (f) handleUpload(d, f); e.target.value = ""; }} style={{ display: "none" }} />
                    </label>
                  ) : null}
                </div>
              ) : null}

              {/* Section Depenses — visible uniquement si voirDepenses=true sur l'intervenant */}
              {canSeeDep ? (
                <div style={{ borderTop: "1px solid var(--border-light)", paddingTop: 10, marginTop: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>{"Depenses (" + dosDep.length + ")"}</div>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{fm(totalPaye) + " / " + fm(totalTtc)}</div>
                  </div>
                  {dosDep.length === 0 ? (
                    <div style={{ fontSize: 11, color: "var(--text-muted)", fontStyle: "italic" }}>{"Aucune depense saisie"}</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {dosDep.slice(0, 5).map(function (f) {
                        return (
                          <div key={f.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, padding: "4px 0" }}>
                            <span style={{ color: "var(--text-tertiary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{(DTL[f.tp] || f.tp || "?") + (f.ds ? " \u00B7 " + f.ds : "")}</span>
                            <span style={{ color: f.s === 'PAYE' ? "var(--success-text)" : "var(--warning-text)", fontWeight: 700, marginLeft: 8 }}>{fm(f.mt || 0)}</span>
                          </div>
                        );
                      })}
                      {dosDep.length > 5 ? <div style={{ fontSize: 10, color: "var(--text-muted)", fontStyle: "italic", textAlign: "center" as const, marginTop: 4 }}>{"+ " + String(dosDep.length - 5) + " autre(s)"}</div> : null}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default AgentView;
