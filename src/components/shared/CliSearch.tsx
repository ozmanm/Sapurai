import { useState } from 'react';

interface CliSearchProps {
  dos: any[];
  tcs: any[];
  nf: (m: string, t?: string) => void;
  shareClientTracking: (name: string) => Promise<string>;
}

function CliSearch(p: CliSearchProps) {
  var [q, sQ] = useState("");
  var [sharedUrls, setSharedUrls] = useState<Record<string, string>>({});
  var res: Array<{ d: any; t: any[] }> = [];
  if (q.length >= 2) {
    var lo = q.toLowerCase();
    var qn = q.replace(/\s/g, "");
    p.dos.forEach(function (d) {
      if ((d.bl || "").toLowerCase().indexOf(lo) >= 0 ||
          (d.cl || "").toLowerCase().indexOf(lo) >= 0 ||
          (d.ce || "").toLowerCase().indexOf(lo) >= 0 ||
          (d.ct || "").replace(/\s/g, "").indexOf(qn) >= 0)
        res.push({ d: d, t: p.tcs.filter(function (c) { return c.did === d.id; }) });
    });
  }
  // Group results by client name
  var clientMap: Record<string, Array<{ d: any; t: any[] }>> = {};
  res.forEach(function (r) {
    var cl = r.d.cl || "(sans nom)";
    if (!clientMap[cl]) clientMap[cl] = [];
    clientMap[cl].push(r);
  });
  var clientKeys = Object.keys(clientMap);

  function shareClient(cl) {
    if (!p.shareClientTracking) return;
    p.shareClientTracking(cl).then(function (url) {
      if (url) {
        setSharedUrls(function (prev) { var n = Object.assign({}, prev); n[cl] = url; return n; });
        p.nf("Lien client genere");
      }
    });
  }

  return (
    <div>
      <div style={{ marginBottom: 12, fontSize: 12, color: "var(--text-secondary)", textAlign: "center" }}>{"Saisissez un BL, un nom client, un email ou un numero WhatsApp"}</div>
      <input autoFocus value={q} onChange={function (e) { sQ(e.target.value); }} placeholder="BL, client, email ou WhatsApp..." style={{ width: "100%", padding: "10px 14px", border: "2px solid var(--border)", borderRadius: 10, fontSize: 15, outline: "none", marginBottom: 16, boxSizing: "border-box", background: "var(--bg-secondary)", color: "var(--text-input)" }} />
      {q.length >= 2 && res.length === 0 ? <div style={{ textAlign: "center", padding: 30, color: "var(--text-muted)" }}>{"Rien"}</div> : null}
      {clientKeys.map(function (cl) {
        var group = clientMap[cl];
        var url = sharedUrls[cl];
        var fullUrl = url ? (window.location.origin + url) : null;
        var ct = group[0] && group[0].d.ct ? group[0].d.ct : null;
        return (
          <div key={cl} style={{ marginBottom: 18 }}>
            {/* Client header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontWeight: 800, fontSize: 13, color: "var(--text-tertiary)" }}>{cl}</div>
              {p.shareClientTracking ? (
                <button onClick={function () { shareClient(cl); }} style={{ background: "var(--btn-primary-bg)", color: "var(--btn-primary-text)", border: "none", borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>{"Lien de suivi"}</button>
              ) : null}
            </div>
            {/* Shared URL box */}
            {fullUrl ? (
              <div style={{ background: "var(--success-bg)", border: "1px solid var(--success-border)", borderRadius: 8, padding: 10, marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--success)", marginBottom: 4 }}>{"Lien de suivi client :"}</div>
                <div style={{ fontSize: 11, color: "var(--text-primary)", wordBreak: "break-all", marginBottom: 6, fontFamily: "var(--font-mono)" }}>{fullUrl}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button onClick={function () { if (navigator.clipboard) navigator.clipboard.writeText(fullUrl); p.nf("Lien copie"); }} style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>{"Copier"}</button>
                  {ct ? <button onClick={function () { var msg = "Consultez l'etat de vos dossiers en temps reel : " + fullUrl; window.open("https://wa.me/" + ct.replace(/\s/g, "") + "?text=" + encodeURIComponent(msg)); }} style={{ background: "var(--success)", color: "white", border: "none", borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>{"Envoyer WA"}</button> : null}
                </div>
              </div>
            ) : null}
            {/* Dossier cards */}
            {group.map(function (r) {
              return (
                <div key={r.d.id} style={{ background: "var(--bg-tertiary)", borderRadius: 12, padding: 14, marginBottom: 8, border: "1px solid var(--border)" }}>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, color: "var(--text-secondary)" }}>{r.d.bl || ""}</div>
                  {r.t.map(function (tc) {
                    var lb = { PORT: "au port de Dakar", DISPATCHE: "pris en charge et en cours de chargement", TRANSIT: "en route vers Bamako", KATI: "arrive a Kati", BAMAKO: "arrive a Bamako", RETURNED: "retourne (vide rendu)" };
                    var days = "";
                    if (tc.dsp && tc.st !== "PORT" && tc.st !== "RETURNED") {
                      var dj = Math.floor((new Date().getTime() - new Date(tc.dsp).getTime()) / 864e5);
                      days = " depuis " + String(dj) + " jour(s)";
                    }
                    if (tc.st === "PORT" && r.d.da) {
                      var dp = Math.floor((new Date().getTime() - new Date(r.d.da).getTime()) / 864e5);
                      days = " depuis " + String(dp) + " jour(s)";
                    }
                    var ph = "Votre conteneur " + (tc.n || "?") + " (" + (tc.ty || "") + ") est " + (lb[tc.st] || tc.st) + days + ". Ref BL: " + (r.d.bl || "") + ".";
                    return <div key={tc.id} style={{ background: "var(--bg-primary)", padding: 10, borderRadius: 8, marginTop: 6 }}><div style={{ fontSize: 14, marginBottom: 6, lineHeight: 1.5 }}>{ph}</div><div style={{ display: "flex", gap: 6 }}><button onClick={function () { if (navigator.clipboard) navigator.clipboard.writeText(ph); p.nf("Copie"); }} style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 8, padding: "5px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{"Copier"}</button>{r.d.ct ? <button onClick={function () { window.open("https://wa.me/" + (r.d.ct || "").replace(/\s/g, "") + "?text=" + encodeURIComponent(ph)); }} style={{ background: "var(--success)", color: "white", border: "none", borderRadius: 8, padding: "5px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{"WhatsApp"}</button> : null}</div></div>;
                  })}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

export default CliSearch;
