// In locale i dati arrivano dal server (api/...); online (GitHub Pages) da file statici pubblicati dal server.
const LOCALE = ["127.0.0.1", "localhost"].includes(location.hostname);
const FONTE = LOCALE ? { stato: "api/stato", eventi: "api/eventi?n=300" } : { stato: "dati/stato.json", eventi: "dati/eventi.json" };
let STATO = null;
let SERVER = {};
let scelto = null;
try { scelto = localStorage.getItem("bradipo.scelto"); } catch (e) {}

const fmt = (v, dg) => v == null ? "–" : Number(v).toLocaleString("it-IT", { minimumFractionDigits: dg, maximumFractionDigits: dg });
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const nome = sym => (STATO?.strumenti.find(x => x.sym === sym) || {}).nome || sym;
const cifre = sym => (STATO?.strumenti.find(x => x.sym === sym) || {}).digits ?? 2;
const ORA = ts => new Date(ts * 1000).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
const quando = t => new Date(t).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

// D1 di Luigi: long o short fino a quando non si allineano le 3 condizioni dell'altro lato (TSI, Heikin Ashi, stocastico 8,5,3)
const latoD1 = x => x.lato_d1?.lato ?? null;
const freccia = (lato, testo) => lato == null ? `<span class="lato misto" title="nessun allineamento delle 3 condizioni nello storico">◆ ${testo ?? "misto"}</span>`
  : `<span class="lato" style="--c:var(--${lato})">${lato === "long" ? "▲" : "▼"} ${testo ?? lato}</span>`;

function riga(x) {
  if (x.errore) return `<div class="riga-s"><span class="nome"><b>${esc(x.nome || x.sym)}</b></span><span class="err">${esc(x.errore)}</span></div>`;
  const d1 = latoD1(x), h1 = x.lato_tf?.H1, v = x.volumi;
  // filtro volumi (15/10): nodo D1 vicino sotto il prezzo per i long, sopra per gli short (entro 1 ATR)
  const nodo = v && d1 ? (d1 === "long" ? v.nodo_sotto : v.nodo_sopra) : null;
  const vol = v && d1 ? (nodo ? d1 : (d1 === "long" ? "short" : "long")) : undefined;
  const h1lato = h1?.lato ?? undefined;
  const fav = d1 == null || !h1 ? `<span class="muto">—</span>`
    : h1lato === d1 ? `<span class="pill" style="--c:var(--pronto)">A favore</span>` : `<span class="pill" style="--c:var(--contro)">Contro</span>`;
  const nuovo = !!h1?.segnale;                    // sull'ultima candela chiusa: cambio di lato o rientro dopo lo storno (16/10)
  return `<button class="riga-s" data-sym="${x.sym}" aria-current="${scelto === x.sym}">
    <span class="nome"><b>${esc(x.nome || x.sym)}</b></span>
    <span class="num r">${fmt(x.prezzo, x.digits)}</span>
    <span title="D1 ${d1 ?? "–"} da ${x.lato_d1?.da ?? "?"} candele · ora: TSI ${x.lato_d1?.ora.tsi ? "▲" : "▼"} HA ${x.lato_d1?.ora.ha ? "▲" : "▼"} Stoc ${x.lato_d1?.ora.stoc ? "▲" : "▼"}">${freccia(d1, d1 && `${d1} ${x.lato_d1.da}c${x.lato_d1.chiusa && x.lato_d1.chiusa !== d1 ? " oggi" : ""}`)}</span>
    ${vol === undefined ? '<span class="muto">–</span>' : `<span title="nodo di volume D1 entro 1 ATR ${d1 === "long" ? "sotto" : "sopra"} il prezzo · POC del movimento ${fmt(v.poc, x.digits)}">${freccia(vol, nodo ? `nodo ${fmt(nodo[0], x.digits)}` : "nessun nodo")}</span>`}
    ${h1lato ? `<span class="${nuovo ? "fresco" : ""}" style="--c:var(--${h1lato})" title="H1 ${h1lato} da ${h1.da} candele · ora: TSI ${h1.ora.tsi ? "▲" : "▼"} HA ${h1.ora.ha ? "▲" : "▼"} Stoc ${h1.ora.stoc ? "▲" : "▼"}">${freccia(h1lato, `${h1lato}${nuovo ? (h1.segnale === "rientro" ? " · rientro" : " · segnale") : ` ${h1.da}c`}`)}</span>` : '<span class="muto">–</span>'}
    <span>${fav}</span>
  </button>`;
}

function render() {
  const S = STATO;
  const ok = S.strumenti.filter(x => !x.errore);
  document.getElementById("meta").innerHTML =
    `<span id="vivo"></span> · ${esc(S.server || "")}${LOCALE ? ' <button class="filtro" id="rifai" type="button">Rifai il giro</button>' : ""}`;
  vivo();
  if (!scelto || !S.strumenti.some(x => x.sym === scelto)) scelto = (ok[0] || {}).sym;
  document.getElementById("righe").innerHTML = S.strumenti.map(riga).join("");
  pannelloStato();
  striscia();
  pannelloNews();
  pannelloCot();
  pannelloVix();
  pannelloEtf();
  document.getElementById("grafici").hidden = false;
  mostraGrafici(scelto);
  sceltaGrafici();
}

// pulsanti sopra i grafici: si cambia strumento senza tornare al tabellone
function sceltaGrafici() {
  document.getElementById("gr-strumenti").innerHTML = STATO.strumenti.filter(x => !x.errore).map(x =>
    `<button class="filtro" data-gr="${x.sym}" aria-pressed="${x.sym === scelto}">${esc(x.nome || x.sym)}</button>`).join("");
}
function scegli(sym) {
  scelto = sym;
  try { localStorage.setItem("bradipo.scelto", scelto); } catch (er) {}
  document.querySelectorAll(".riga-s[data-sym]").forEach(k => k.setAttribute("aria-current", k.dataset.sym === scelto));
  sceltaGrafici();
  mostraGrafici(scelto);
}

// Riga di stato: esecutore, posizioni, ultima operazione, prossima news rossa
function pannelloStato() {
  const E = STATO.esecutore, N = STATO.news, el = document.getElementById("esec");
  const pezzi = [];
  if (E) {
    pezzi.push(`<span class="pill" style="--c:var(--${E.acceso ? "pronto" : "fermo"})">Esecutore ${E.acceso ? "acceso" : "spento"}</span>`);
    pezzi.push(E.posizioni.length
      ? E.posizioni.map(p => `<span><b>${esc(nome(p.sym))}</b> <span style="color:var(--${p.lato === "long" ? "long" : "short"})">${p.lato === "long" ? "▲" : "▼"}</span>
          <span class="num">${fmt(p.prezzo, cifre(p.sym))}</span> <span class="num" style="color:var(--${p.utile >= 0 ? "long" : "short"})">${p.utile >= 0 ? "+" : ""}${fmt(p.utile, 2)} $</span></span>`).join(" · ")
      : `<span class="muto">nessuna posizione</span>`);
    const o = E.operazioni[0];
    if (o) {
      const T = { apre: "aperto", chiude: "chiuso", salta: "scartato", errore: "errore", news: "news" };
      pezzi.push(`<span class="muto">ultima: ${quando(o.ts)} ${esc(nome(o.sym))} ${T[o.azione] || esc(o.azione)}${o.lato ? " " + esc(o.lato) : ""}${o.azione === "chiude" && o.profitto != null ? ` ${o.profitto >= 0 ? "+" : ""}${fmt(o.profitto, 2)} $` : ""}</span>`);
    }
  }
  if (N && N.eventi) {
    const ora = Date.now() / 1000, b = Object.keys(N.bloccati || {});
    const rossa = N.eventi.find(e => e.impatto === "rossa" && e.ts > ora);
    if (b.length) pezzi.push(`<span style="color:var(--contro)">⛔ ingressi bloccati per news</span>`);
    else if (rossa) pezzi.push(`<span class="muto">prossima 🔴 ${esc(rossa.valuta)} ${ORA(rossa.ts)}</span>`);
  }
  el.innerHTML = pezzi.join("");
}

// Striscia che scorre: le cose da vedere al volo. Si riscrive solo se cambia, così l'animazione non riparte
let tickerTesto = "";
function striscia() {
  const S = STATO, voci = [];
  const su = l => `<span style="color:var(--${l})">${l === "long" ? "▲" : "▼"}</span>`;
  for (const x of S.strumenti.filter(x => !x.errore)) {
    const d1 = latoD1(x), h1 = x.lato_tf?.H1;
    if (!d1 || !h1?.lato) continue;
    const contro = h1.lato !== d1;       // Luigi 16/10: i segnali contro "accendono" lo strumento per il prossimo a favore
    voci.push(`<b>${esc(x.nome || x.sym)}</b> <span class="num">${fmt(x.prezzo, x.digits)}</span> · D1 ${su(d1)} · H1 ${su(h1.lato)}${
      h1.segnale ? ` <b style="color:var(--${h1.lato})">${h1.segnale === "rientro" ? "rientro" : "segnale"}</b>` : ""}${
      contro ? ` <span style="color:var(--osserva)">contro</span>` : ""}`);
  }
  for (const p of S.esecutore?.posizioni || [])
    voci.push(`demo <b>${esc(nome(p.sym))}</b> ${su(p.lato)} <span class="num" style="color:var(--${p.utile >= 0 ? "long" : "short"})">${p.utile >= 0 ? "+" : ""}${fmt(p.utile, 2)} $</span>`);
  const sim = S.simulati;
  if (sim) for (const k of ["base", "giornata", "respiro"]) if (sim[k])
    voci.push(`sim <b>${k}</b> <span class="num" style="color:var(--${sim[k].r_totale >= 0 ? "long" : "short"})">${sim[k].r_totale >= 0 ? "+" : ""}${fmt(sim[k].r_totale, 2)} R</span> · ${sim[k].chiuse} chiusi · ${sim[k].aperte.length} aperti`);
  if (S.vix) voci.push(`VIX <b class="num">${fmt(S.vix.valore, 2)}</b> <span class="num" style="color:var(--${S.vix.var_pct > 0 ? "short" : "long"})">${S.vix.var_pct > 0 ? "+" : ""}${fmt(S.vix.var_pct, 1)} %</span> ${S.vix.fascia}`);
  const N = S.news, ora = Date.now() / 1000;
  const rossa = N?.eventi?.find(e => e.impatto === "rossa" && e.ts > ora);
  if (rossa) voci.push(`prossima news 🔴 <b>${esc(rossa.valuta)}</b> ${ORA(rossa.ts)} ${esc(rossa.titolo || "")}`);
  const testo = voci.map(v => `<span class="voce">${v}</span>`).join("");
  const box = document.getElementById("ticker-box");
  box.hidden = !voci.length;
  if (testo === tickerTesto) return;
  tickerTesto = testo;
  const el = document.getElementById("ticker");
  el.style.setProperty("--durata", `${Math.max(30, voci.length * 5)}s`);
  el.innerHTML = testo + testo.replace(/<span class="voce">/g, '<span class="voce" aria-hidden="true">');   // due copie: il giro non si vede
}

// News: solo da adesso in avanti, poche righe
function pannelloNews() {
  const N = STATO.news, el = document.getElementById("news");
  if (!N) { el.innerHTML = ""; return; }
  const testa = `<h3>News <small>le 🔴 fermano gli ingressi ±${N.prima_min ?? 30} min</small></h3>`;
  if (N.errore && !(N.eventi || []).length) {
    el.innerHTML = `${testa}<div class="avviso" style="--c:var(--osserva)">Calendario non disponibile: l'esecutore <b>non</b> filtra le news.</div>`;
    return;
  }
  const ora = Date.now() / 1000;
  const giorni = {};
  N.eventi.filter(e => e.ts + (N.dopo_min ?? 30) * 60 > ora).forEach(e => {
    const g = new Date(e.ts * 1000).toLocaleDateString("it-IT", { weekday: "short", day: "numeric" });
    (giorni[g] = giorni[g] || []).push(e);
  });
  const lista = Object.entries(giorni).map(([g, ee]) => ee.map((e, i) => {
    const ora_ = e.impatto === "rossa" && Math.abs(e.ts - ora) <= (N.prima_min ?? 30) * 60 ? " ora" : "";
    return `<li class="ev${ora_}"><span class="h">${i ? "" : esc(g)}</span><span class="h">${ORA(e.ts)}</span><span class="val">${esc(e.valuta)}</span>
      <span><span class="imp" style="--c:var(--${e.impatto === "rossa" ? "contro" : "osserva"})"></span>${esc(e.titolo)}</span></li>`; }).join("")).join("");
  el.innerHTML = `${testa}<ul class="nlista">${lista || '<li class="giorno">Nessuna news in arrivo.</li>'}</ul>`;
}

// COT della CFTC: posizione netta degli speculatori (e degli istituzionali) e indice COT 0-100 su 3 anni
function pannelloCot() {
  const K = STATO.cot, el = document.getElementById("cot");
  if (!K || !K.strumenti) { el.innerHTML = ""; return; }
  const mig = n => Math.abs(n) >= 1000 ? `${n > 0 ? "+" : ""}${fmt(n / 1000, 1)}k` : `${n > 0 ? "+" : ""}${n}`;
  const col = n => `color:var(--${n >= 0 ? "long" : "short"})`;
  const barra = i => `<span class="cot-ind${i <= 10 || i >= 90 ? " estremo" : ""}" title="indice COT ${i}: 0 = la più short in ${K.anni} anni, 100 = la più long">
    <i style="left:${i}%"></i></span><span class="num">${i}</span>`;
  const righe = K.strumenti.map(x => `<tr${x.sym === scelto ? ' class="scelto"' : ""}>
    <th scope="row">${esc(x.nome)}</th>
    <td class="num" style="${col(x.spec.netto)}" title="${esc(x.spec.chi)}, ${x.spec.pct_oi ?? "–"} % dei contratti aperti">${mig(x.spec.netto)}</td>
    <td class="num" style="${col(x.spec.var)}">${mig(x.spec.var)}</td>
    <td>${barra(x.spec.indice)}</td>
    <td title="${esc(x.ist.chi)} netto ${mig(x.ist.netto)}">${barra(x.ist.indice)}</td></tr>`).join("");
  el.innerHTML = `<h3>COT <small>posizioni dei grandi sui futures (CFTC), dati del ${esc(K.strumenti[0].data.split("-").reverse().join("/"))}</small></h3>
    <div class="cot-box"><table class="cot"><thead><tr><th></th><th>speculatori</th><th>settimana</th><th>indice spec.</th><th>indice istituz.</th></tr></thead>
    <tbody>${righe}</tbody></table></div>
    <p class="muto">Speculatori = fondi a leva (valute, indici) o managed money (metalli, petrolio); istituzionali = asset manager o produttori.
    + = a favore dello strumento (USD/JPY e USD/CHF già girati). Indice 0 = la più short in ${K.anni} anni, 100 = la più long: agli estremi (in rosso) il posizionamento è affollato.
    Sugli indici i fondi a leva sono short per arbitraggio contro gli asset manager: lì il netto non è una scommessa. Niente DAX (Eurex non ha COT).</p>`;
}

// VIX: l'indice della paura sull'S&P 500 (Yahoo ^VIX, ~15 min di ritardo)
const COL_VIX = { calmo: "long", normale: "fermo", tensione: "osserva", paura: "contro" };
function pannelloVix() {
  const V = STATO.vix, el = document.getElementById("vix");
  if (!V) { el.innerHTML = ""; return; }
  const s = V.storia || [], lo = Math.min(...s) - 1, hi = Math.max(...s) + 1, W = 300, H = 60;
  const y = v => (H - 4 - (v - lo) / (hi - lo) * (H - 8)).toFixed(1);
  const pt = s.map((v, i) => `${(i / Math.max(1, s.length - 1) * W).toFixed(1)},${y(v)}`).join(" ");
  // linee delle fasce (15, 20, 30) solo se cadono dentro la scala del grafico
  const soglie = [15, 20, 30].filter(v => v > lo && v < hi).map(v => `<line x1="0" x2="${W}" y1="${y(v)}" y2="${y(v)}" class="soglia"><title>${v}</title></line>`).join("");
  el.innerHTML = `<h3>VIX <small>indice della paura sull'S&amp;P 500 · Yahoo, ~15 min di ritardo</small></h3>
    <div class="vix-riga"><b class="vix-val num" style="color:var(--${COL_VIX[V.fascia]})">${fmt(V.valore, 2)}</b>
      <span class="num" style="color:var(--${V.var_pct > 0 ? "short" : "long"})">${V.var_pct > 0 ? "+" : ""}${fmt(V.var_pct, 1)} %</span>
      <span>ieri ${fmt(V.ieri, 2)} · <b>${esc(V.fascia)}</b> · più alto del ${V.percentile_1a} % dei giorni dell'ultimo anno</span></div>
    <svg class="vix-grafico" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="VIX ultimi 60 giorni">${soglie}
      <polyline points="${pt}" fill="none" stroke="var(--${COL_VIX[V.fascia]})" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>
    <p class="muto">Ultimi 60 giorni: minimo ${fmt(Math.min(...s), 2)}, massimo ${fmt(Math.max(...s), 2)}; linee tratteggiate alle soglie ${[15, 20, 30].filter(v => v > lo && v < hi).join(", ") || "–"}. Sotto 15 calmo, 15-20 normale, 20-30 tensione, sopra 30 paura. Il VIX sale quando l'S&amp;P scende: un VIX che sale con gli indici long è un segnale di cautela.</p>`;
}

// ETF americani della tabella di Luigi: prezzo, variazione di oggi (pillola colorata) e degli ultimi 5 giorni
function pannelloEtf() {
  const E = STATO.etf, el = document.getElementById("etf");
  if (!E || !E.etf) { el.innerHTML = ""; return; }
  const pc = v => `${v > 0 ? "+" : ""}${fmt(v, 2)} %`;
  const righe = E.etf.map(x => `<tr><th scope="row">${esc(x.nome)} <small>${esc(x.t)}</small></th>
    <td class="num" style="color:var(--${x.oggi >= 0 ? "long" : "short"})">${fmt(x.prezzo, 2)}</td>
    <td class="num"><span class="pill" style="--c:var(--${x.oggi >= 0 ? "long" : "short"})">${pc(x.oggi)}</span></td>
    <td class="num muto" style="color:var(--${x.cinque >= 0 ? "long" : "short"})">${pc(x.cinque)}</td></tr>`).join("");
  el.innerHTML = `<h3>ETF USA <small>settori dell'S&amp;P 500, pesi uguali e Mag 7 · Yahoo, ~15 min di ritardo</small></h3>
    ${mappaEtf(E.etf)}
    <div class="cot-box"><table class="cot etf"><thead><tr><th></th><th class="num">prezzo</th><th class="num">oggi</th><th class="num">5 giorni</th></tr></thead>
    <tbody>${righe}</tbody></table></div>
    <p class="muto">Se RSP (tutte le aziende con lo stesso peso) fa peggio di SPY, l'indice lo tirano poche aziende grandi; se MAGS fa meglio di RSP comandano le 7.</p>`;
}

// Mappa degli ETF: riquadri colorati per variazione (oggi o 5 giorni). SPY, RSP e MAGS in testa come riferimento,
// poi i settori dal più forte al più debole; colore pieno a ±2 % (oggi) o ±5 % (5 giorni)
const ETF_RIF = ["SPY", "RSP", "MAGS"];
let finestraEtf = "oggi";
try { finestraEtf = localStorage.getItem("bradipo.etf") || "oggi"; } catch (e) {}
function mappaEtf(lista) {
  const k = finestraEtf, pieno = k === "oggi" ? 2 : 5;
  const riq = x => {
    const v = x[k], q = Math.round(Math.min(1, Math.abs(v) / pieno) * 45);
    return `<li class="etf-riq" style="background:color-mix(in srgb, var(--${v >= 0 ? "long" : "short"}) ${q}%, var(--panel))"
      title="${esc(x.nome)}: ${v > 0 ? "+" : ""}${fmt(v, 2)} %"><b>${esc(x.t)}</b><span>${esc(x.nome)}</span>
      <em>${v > 0 ? "+" : ""}${fmt(v, 2)} %</em></li>`;
  };
  const rif = ETF_RIF.map(t => lista.find(x => x.t === t)).filter(Boolean);
  const set = lista.filter(x => !ETF_RIF.includes(x.t)).sort((a, b) => b[k] - a[k]);
  return `<div class="schede" role="group" aria-label="Variazione della mappa ETF">
      <button class="filtro" data-etf="oggi" aria-pressed="${k === "oggi"}">Oggi</button>
      <button class="filtro" data-etf="cinque" aria-pressed="${k === "cinque"}">5 giorni</button></div>
    <ul class="etf-mappa rif" aria-label="Riferimenti">${rif.map(riq).join("")}</ul>
    <ul class="etf-mappa" aria-label="Settori dal più forte al più debole">${set.map(riq).join("")}</ul>`;
}
document.addEventListener("click", e => {
  const b = e.target.closest("[data-etf]");
  if (!b) return;
  finestraEtf = b.dataset.etf;
  try { localStorage.setItem("bradipo.etf", finestraEtf); } catch (er) {}
  pannelloEtf();
});

// Mappa delle azioni USA: widget ufficiale TradingView (gratuito da incorporare), ricreato quando si cambia indice
let mappaFonte = "SPX500";
try { mappaFonte = localStorage.getItem("bradipo.mappa") || "SPX500"; } catch (e) {}
function mappa() {
  const box = document.getElementById("mappa");
  if (!box) return;
  document.querySelectorAll("[data-mappa]").forEach(b => b.setAttribute("aria-pressed", b.dataset.mappa === mappaFonte));
  const scuro = matchMedia("(prefers-color-scheme: dark)").matches && document.documentElement.dataset.theme !== "light";
  box.innerHTML = '<div class="tradingview-widget-container" style="height:100%;width:100%"><div class="tradingview-widget-container__widget" style="height:100%;width:100%"></div></div>';
  const sc = document.createElement("script");
  sc.src = "https://s3.tradingview.com/external-embedding/embed-widget-stock-heatmap.js";
  sc.async = true;
  sc.textContent = JSON.stringify({ exchanges: [], dataSource: mappaFonte, grouping: "sector", blockSize: "market_cap_basic",
    blockColor: "change", locale: "it", symbolUrl: "", colorTheme: scuro ? "dark" : "light", hasTopBar: false,
    isDataSetEnabled: false, isZoomEnabled: true, hasSymbolTooltip: true, isMonoSize: false, width: "100%", height: "100%" });
  box.firstChild.appendChild(sc);
}
document.addEventListener("click", e => {
  const b = e.target.closest("[data-mappa]");
  if (!b) return;
  mappaFonte = b.dataset.mappa;
  try { localStorage.setItem("bradipo.mappa", mappaFonte); } catch (er) {}
  mappa();
});
document.addEventListener("DOMContentLoaded", mappa);

// Strong / Weak: variazione % di ogni valuta in dollari; il dollaro è lo zero
let finestraForza = "Oggi";
try { finestraForza = localStorage.getItem("bradipo.forza") || "Oggi"; } catch (e) {}
function pannelloForza() {
  const F = STATO.forza, el = document.getElementById("forza");
  if (!F || !F.finestre || !F.finestre.length) { el.innerHTML = F && F.errore ? `<h3>Strong / Weak</h3><p class="muto">Non disponibile</p>` : ""; return; }
  const w = F.finestre.find(x => x.nome === finestraForza) || F.finestre[0];
  const max = Math.max(0.05, ...w.valute.map(v => Math.abs(v.pct)));
  const pc = v => `${v > 0 ? "+" : ""}${fmt(v, 2)}`;
  const righe = w.valute.filter(v => v.valuta !== "USD").map(v => {
    const larg = 50 * Math.abs(v.pct) / max;
    return `<div class="r" title="${esc(v.valuta)} ${pc(v.pct)} % contro il dollaro · ${esc(w.nome)}">
      <b>${esc(v.valuta)}</b><span class="asse"><i class="${v.pct >= 0 ? "pos" : "neg"}" style="width:${larg}%;--c:var(--${v.pct >= 0 ? "long" : "short"})"></i></span>
      <span class="num">${pc(v.pct)}</span></div>`;
  }).join("");
  el.innerHTML = `<h3>Strong / Weak <small>contro il dollaro, %</small></h3>
    <div class="schede" role="group" aria-label="Finestra">${F.finestre.map(x => `<button class="filtro" data-forza="${esc(x.nome)}" aria-pressed="${x.nome === w.nome}">${esc(x.nome)}</button>`).join("")}</div>
    <div class="barre">${righe}</div>
    <div class="muto">USD contro il paniere: <b style="color:var(--${w.usd >= 0 ? "long" : "short"})">${pc(w.usd)} %</b></div>`;
}

document.addEventListener("click", e => {
  const fz = e.target.closest("[data-forza]");
  if (fz) { finestraForza = fz.dataset.forza; try { localStorage.setItem("bradipo.forza", finestraForza); } catch (er) {} pannelloForza(); return; }
  const g = e.target.closest("[data-gr]");
  if (g) { scegli(g.dataset.gr); return; }
  const c = e.target.closest(".riga-s[data-sym]");
  if (c) scegli(c.dataset.sym);
});

function vivo() {
  const el = document.getElementById("vivo");
  if (!el || !STATO) return;
  const sec = Math.round((Date.now() - new Date(STATO.generato)) / 1000);
  const fa = sec < 60 ? `${sec} s fa` : `${Math.round(sec / 60)} min fa`;
  const ora = new Date(STATO.generato).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  const online = LOCALE ? "" : ` · online, ogni ${Math.round((SERVER.ogni_s || 600) / 60)} min`;
  const err = SERVER.errore ? ` · <span style="color:var(--contro)">ultimo giro fallito: ${esc(SERVER.errore)}</span>` : "";
  el.innerHTML = `<span class="dot" style="--c:var(--${sec > Math.max(180, 2.5 * (SERVER.ogni_s || 60)) || SERVER.errore ? "contro" : "pronto"})"></span> giro delle <span class="num">${ora}</span> (${fa})${online}${err}`;
}

async function carica() {
  try {
    const r = await fetch(FONTE.stato, { cache: "no-store" });
    if (!r.ok) throw new Error(`il server risponde ${r.status}`);
    const j = await r.json();
    SERVER = j.server_app || {};
    if (!j.stato) { mostraErrore(SERVER.errore || "primo giro in corso"); return; }
    if (!STATO || j.stato.generato !== STATO.generato) { STATO = j.stato; render(); caricaEventi(); }
    else vivo();
  } catch (e) {
    mostraErrore(LOCALE ? "server dell'app non raggiungibile: avvialo con avvia.bat" : "dati non disponibili");
  }
}

// Registro: solo segnali, svolte del D1 e formazioni, solo gli strumenti in pagina; il resto è rumore del giro
const breve = t => { const d = new Date(t);
  return d.toDateString() === new Date().toDateString() ? d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" }); };
const TIPI = new Set(["segnale", "direzione", "formazione"]);
async function caricaEventi() {
  try {
    const r = await fetch(FONTE.eventi, { cache: "no-store" });
    if (!r.ok) return;
    const miei = new Set(STATO.strumenti.map(x => x.sym));
    const ev = (await r.json()).filter(e => TIPI.has(e.tipo) && miei.has(e.sym)).slice(0, 40);
    const el = document.getElementById("cronologia");
    if (!ev.length) { el.innerHTML = '<li class="vuota">Ancora nessun segnale o svolta registrati.</li>'; return; }
    el.innerHTML = ev.map(e => {
      const c = e.a === "long" ? "var(--long)" : e.a === "short" ? "var(--short)" : "var(--ink)";
      return `<li style="--c:${c}"><span class="quando">${breve(e.ts)}</span><span class="sym">${esc(nome(e.sym))}</span>
        <span>${esc(e.testo)}</span></li>`;
    }).join("");
  } catch (er) {}
}

function mostraErrore(t) {
  if (STATO) { SERVER = { errore: t }; vivo(); return; }
  document.getElementById("meta").textContent = t;
}

document.addEventListener("click", async e => {
  if (e.target.id !== "rifai") return;
  e.target.disabled = true; e.target.textContent = "Giro in corso…";
  try { await fetch("api/giro", { method: "POST" }); } catch (er) {}
  setTimeout(carica, 2500);
});

carica();
setInterval(carica, 15000);
setInterval(vivo, 1000);
