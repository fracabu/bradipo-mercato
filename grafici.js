// Grafici D1 e H1 con Lightweight Charts di TradingView, copiati dalle foto di Luigi del 14/10:
// sfondo grigio scuro senza griglia, candele Heikin Ashi bianche e nere, volume profile del movimento disegnato sul grafico
// (barre verdi = volume in salita, rosse = in discesa), POC rosso a puntini spesso,
// prezzo con linea bianca tratteggiata; sotto TSI rossa con media bianca e livelli ±50, stocastico verde con %D bianca.
// Frecce dei segnali Bradipo (3 condizioni: grande = cambio di lato, piccola = rientro dopo lo storno), accese di default:
// si spengono con la casella "segnali".
const STILE = {
  sfondo: "#3d3d3d", testo: "#cfcfcf", su: "#efefef", giu: "#141414", stoppino: "#bdbdbd",
  tsi: "#e8231f", ema: "#ffffff", k: "#2f8a1c", d: "#ffffff", livello: "#c9a227",
  poc: "#e8231f", va: "#c9a227", lungo: "rgba(232,35,31,0.7)",
  barraSu: "rgba(160,190,110,0.55)", barraGiu: "rgba(190,70,70,0.55)", zona: "rgba(255,255,255,0.05)",
  long: "#7fd36a", short: "#ff5a50", sar: "#ffd60a",
};
const NOME_TF = { D1: "1 giorno", H4: "4 ore", H1: "1 ora" };
const G = { sym: null, col: {}, dati: null };
let conSegnali = true;
try { conSegnali = localStorage.getItem("bradipo.segnali3") !== "0"; } catch (e) {}
// volume vero dei futures CME (Yahoo, tradotto sui prezzi di Pure) al posto del tick volume di Pure: acceso di default
let conCme = true;
try { conCme = localStorage.getItem("bradipo.cme") !== "0"; } catch (e) {}
const cme = () => (conCme && G.dati?.cme) || null;

function opzioni(asse) {
  return {
    autoSize: true,
    layout: { attributionLogo: false, background: { type: "solid", color: STILE.sfondo }, textColor: STILE.testo,
              fontFamily: "IBM Plex Mono, monospace", fontSize: 11 },
    grid: { vertLines: { visible: false }, horzLines: { visible: false } },
    rightPriceScale: { borderColor: "#555", minimumWidth: 74 },
    timeScale: { visible: asse, borderColor: "#555", timeVisible: true, secondsVisible: false, rightOffset: 4 },
    crosshair: { mode: 0 },
  };
}

function colonna(el, tf) {
  el.innerHTML = `<div class="gr-testa"><b></b><span class="gr-info"></span></div>
    <div class="gr-prezzo"><canvas class="gr-profilo"></canvas></div><div class="gr-osc"></div><div class="gr-osc"></div>`;
  const ep = el.querySelector(".gr-prezzo"), [et, es] = el.querySelectorAll(".gr-osc");
  const cp = LightweightCharts.createChart(ep, opzioni(false));
  const ct = LightweightCharts.createChart(et, opzioni(false));
  const cs = LightweightCharts.createChart(es, opzioni(true));
  // oscillatori: niente numeri automatici sulla scala (si sovrapponevano ai livelli, su telefono sembravano "1.99"):
  // restano solo le etichette colorate dei livelli fissi e dei valori attuali
  for (const c of [ct, cs]) c.priceScale("right").applyOptions({ textColor: "rgba(0,0,0,0)" });
  const candele = cp.addCandlestickSeries({
    upColor: STILE.su, downColor: STILE.giu, borderUpColor: "#9a9a9a", borderDownColor: "#000",
    wickUpColor: STILE.stoppino, wickDownColor: STILE.giu,   // candele nere con lo stoppino nero (utente 17/10)
    priceLineVisible: false, lastValueVisible: false,     // candele HA: il prezzo vero è una linea a parte
  });
  // SAR H1 dell'esecutore (stop e trailing): puntini gialli
  const sar = cp.addLineSeries({ color: STILE.sar, lineVisible: false, pointMarkersVisible: true, pointMarkersRadius: 1.5,
    priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
  const tsi = ct.addLineSeries({ color: STILE.tsi, lineWidth: 3, priceLineVisible: false, lastValueVisible: true });
  const ema = ct.addLineSeries({ color: STILE.ema, lineWidth: 2, priceLineVisible: false, lastValueVisible: true });
  tsi.createPriceLine({ price: 0, color: "#ffffff", lineWidth: 1, lineStyle: 0, axisLabelVisible: false });
  for (const v of [50, -50]) tsi.createPriceLine({ price: v, color: STILE.livello, lineWidth: 1, lineStyle: 1, axisLabelVisible: true });
  const k = cs.addLineSeries({ color: STILE.k, lineWidth: 3, priceLineVisible: false, lastValueVisible: true });
  const d = cs.addLineSeries({ color: STILE.d, lineWidth: 2, priceLineVisible: false, lastValueVisible: true });
  for (const v of [20, 80]) k.createPriceLine({ price: v, color: "#8a8a8a", lineWidth: 1, lineStyle: 1, axisLabelVisible: true });
  const c = { tf, el, ep, cv: el.querySelector(".gr-profilo"), cp, ct, cs, candele, sar, tsi, ema, k, d, linee: [], primo: true, s: null, via: false };
  // le tre parti della colonna scorrono e zoomano insieme; il profilo si ridisegna quando cambia la vista
  const tutte = [cp, ct, cs];
  let sync = false;
  for (const ch of tutte) ch.timeScale().subscribeVisibleLogicalRangeChange(r => {
    if (!r) return;
    if (ch === cp) requestAnimationFrame(() => profilo(c));
    if (sync) return;
    sync = true;
    for (const o of tutte) if (o !== ch) o.timeScale().setVisibleLogicalRange(r);
    sync = false;
  });
  // passando col mouse: ora della candela e valore del SAR nella testata della colonna (utente 16/10)
  const testata = p => {
    const info = el.querySelector(".gr-info");
    if (!p.time || !c.s) { info.textContent = `stoc ${c.s?.stoc ?? ""}`; return; }
    const i = c.s.t.indexOf(p.time), sv = i >= 0 && c.s.sar ? c.s.sar[i] : null;
    const d = new Date(p.time * 1000), z = n => String(n).padStart(2, "0");
    const quando = `${z(d.getUTCDate())}/${z(d.getUTCMonth() + 1)}${tf === "D1" ? "" : ` ${z(d.getUTCHours())}:${z(d.getUTCMinutes())}`}`;
    info.textContent = sv != null ? `${quando} · SAR ${sv.toFixed(G.dati?.digits ?? 5)}` : quando;
  };
  for (const ch of [cp, ct, cs]) ch.subscribeCrosshairMove(testata);
  c.ro = new ResizeObserver(() => requestAnimationFrame(() => profilo(c)));
  c.ro.observe(ep);
  return c;
}

// Volume profile del movimento disegnato sopra le candele, come BradipoVolumi / la piattaforma di Luigi:
// parte dalla candela d'inizio del movimento, le barre più lunghe arrivano a un terzo della larghezza.
function profilo(c) {
  if (c.via) return;                // colonna di uno strumento lasciato: il grafico non c'è più
  const P = cme() || G.dati?.profilo, cv = c.cv;
  const W = c.ep.clientWidth, H = c.ep.clientHeight, dpr = devicePixelRatio || 1;
  cv.width = W * dpr; cv.height = H * dpr;
  const g = cv.getContext("2d");
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, W, H);
  if (!P || !P.barre || !c.s) return;
  const larg = W - c.cp.priceScale("right").width();     // timeScale().width() è 0 con l'asse dei tempi nascosto
  // la candela d'inizio del movimento su questo timeframe (la prima con tempo >= t0)
  const i0 = c.s.t.findIndex(t => t >= P.t0);
  let x0 = i0 >= 0 ? c.cp.timeScale().logicalToCoordinate(i0) : null;
  if (x0 === null || x0 < 0) x0 = 0;
  if (x0 >= larg) return;
  const lung = (larg - x0) * 0.33;
  g.fillStyle = STILE.zona;
  const yHi = c.candele.priceToCoordinate(P.barre[P.barre.length - 1][0] + P.passo), yLo = c.candele.priceToCoordinate(P.barre[0][0]);
  if (yHi !== null && yLo !== null) g.fillRect(x0, yHi, larg - x0, yLo - yHi);
  for (const [p, su, giu] of P.barre) {
    const y1 = c.candele.priceToCoordinate(p + P.passo), y2 = c.candele.priceToCoordinate(p);
    if (y1 === null || y2 === null) continue;
    const h = Math.max(1, y2 - y1 - 0.5), ws = lung * su / 100, wg = lung * giu / 100;
    g.fillStyle = STILE.barraSu; g.fillRect(x0, y1, ws, h);
    g.fillStyle = STILE.barraGiu; g.fillRect(x0 + ws, y1, wg, h);
  }
}

// candela del grafico che contiene l'istante t (l'ultima che apre prima o a t)
function candelaDi(s, t) {
  let j = -1;
  for (let i = 0; i < s.t.length && s.t[i] <= t; i++) j = i;
  return j;
}

function marcatori(c) {
  if (!c.s) { c.candele.setMarkers([]); return; }
  const m = !conSegnali ? [] : c.s.segnali.map(x => {
    const su = x.lato === "long", grande = x.tipo !== "rientro";
    return { time: x.t, position: su ? "belowBar" : "aboveBar", color: su ? STILE.long : STILE.short,
             shape: su ? "arrowUp" : "arrowDown", size: grande ? 1 : 0.5, text: grande ? (su ? "B" : "S") : "" };
  });
  for (const p of G.dati?.posizioni || []) {            // ingressi delle posizioni demo aperte: pallino senza scritta
    const j = p.t ? candelaDi(c.s, p.t) : -1;
    if (j < 0) continue;
    const su = p.lato === "long";
    m.push({ time: c.s.t[j], position: su ? "belowBar" : "aboveBar", color: su ? STILE.long : STILE.short,
             shape: "circle", size: 0.7 });
  }
  const visti = new Set();
  for (const p of G.dati?.sim || []) {                  // ingressi dei trade simulati su Pure: quadratino
    const j = p.t ? candelaDi(c.s, p.t) : -1;
    if (j < 0 || visti.has(p.t)) continue;
    visti.add(p.t);
    const su = p.lato === "long";
    m.push({ time: c.s.t[j], position: su ? "belowBar" : "aboveBar", color: su ? STILE.long : STILE.short,
             shape: "square", size: 0.6 });
  }
  m.sort((a, b) => a.time - b.time);
  c.candele.setMarkers(m);
}

// posizioni demo aperte: entrata, stop (che segue il SAR) e target come linee; SAR H1 dall'ingresso
function posizioni(c, s) {
  const pos = G.dati?.posizioni || [];
  const riga = (p, col, w, stile, titolo) => p && c.linee.push(c.candele.createPriceLine(
    { price: p, color: col, lineWidth: w, lineStyle: stile, axisLabelVisible: true, title: titolo }));
  for (const p of pos) {
    // solo l'etichetta colorata col prezzo sulla scala: le scritte dentro il grafico coprivano le candele (utente 16/10)
    riga(p.prezzo, "#ffffff", 1, 0, "");
    riga(p.sl, STILE.short, 2, 0, "");
    riga(p.tp, STILE.long, 2, 0, "");
  }
  // trade simulati su Pure (le due serie spesso coincidono: una linea sola per prezzo), tratteggiati
  const sim = G.dati?.sim || [], fatte = new Set();
  for (const p of sim) for (const [v, col] of [[p.prezzo, "#ffffff"], [p.sl, STILE.short], [p.tp, STILE.long]]) {
    if (fatte.has(v)) continue;
    fatte.add(v);
    riga(v, col, 1, 2, "");
  }
  // la scala dei prezzi comprende anche stop e target, altrimenti sull'H1 il target resta fuori dal grafico
  const estremi = [...pos, ...sim].flatMap(p => [p.sl, p.tp]).filter(Boolean);
  c.candele.applyOptions({ autoscaleInfoProvider: base => {
    const r = base();
    if (!r || !estremi.length) return r;
    return { ...r, priceRange: { minValue: Math.min(r.priceRange.minValue, ...estremi),
                                 maxValue: Math.max(r.priceRange.maxValue, ...estremi) } };
  } });
  // SAR H1 sempre visibile su tutti gli strumenti (utente 16/10): è dove va lo stop di ogni trade
  c.sar.setData(!s.sar ? [] : s.t.map((t, i) => ({ time: t, value: s.sar[i] })));
}

function riempi(c, s, livelli, dg, nome) {
  c.s = s;
  const punti = key => s.t.map((t, i) => ({ time: t, value: s[key][i] })).filter(p => p.value !== null);
  // valute a 5 decimali: la scala ne mostra 4 (1.1227 invece di 1.12270), etichette più corte su telefono
  const px = dg === 5 ? 4 : dg;
  c.candele.applyOptions({ priceFormat: { type: "price", precision: px, minMove: Math.pow(10, -px) } });
  c.candele.setData(s.t.map((t, i) => ({ time: t, open: s.o[i], high: s.h[i], low: s.l[i], close: s.c[i] })));
  marcatori(c);
  c.tsi.setData(punti("tsi")); c.ema.setData(punti("ema"));
  c.k.setData(punti("k")); c.d.setData(punti("d"));
  for (const l of c.linee) c.candele.removePriceLine(l);
  c.linee = [];
  const linea = (p, col, w, stile, titolo) => p != null && c.linee.push(c.candele.createPriceLine(
    { price: p, color: col, lineWidth: w, lineStyle: stile, axisLabelVisible: false, title: titolo }));
  linea(cme() ? cme().poc : livelli.poc, STILE.poc, 3, 1, "");
  // value area tolta dal grafico (utente 16/10): resta nella scheda e nel tabellone
  linea(livelli.poc_lungo, STILE.lungo, 1, 2, "");
  posizioni(c, s);
  if (s.prezzo != null) c.linee.push(c.candele.createPriceLine(
    { price: s.prezzo, color: "#ffffff", lineWidth: 2, lineStyle: 2, axisLabelVisible: true, title: "" }));
  c.el.querySelector(".gr-testa b").textContent = `${nome}  ${NOME_TF[c.tf]}`;
  const u = s.t.length - 1;
  c.el.querySelector(".gr-info").textContent = `stoc ${s.stoc}`;
  if (c.primo) {                         // la prima volta le ultime ~100 candele; poi resta dove l'hai lasciato
    c.cp.timeScale().setVisibleLogicalRange({ from: s.t.length - 100, to: s.t.length + 3 });
    c.primo = false;
  }
  requestAnimationFrame(() => profilo(c));
}

async function mostraGrafici(sym) {
  const box = document.getElementById("grafici");
  if (!box || !sym || !window.LightweightCharts) return;
  let g;
  try {
    const r = await fetch(LOCALE ? `api/grafico?sym=${encodeURIComponent(sym)}` : `dati/grafici/${encodeURIComponent(sym)}.json`, { cache: "no-store" });
    g = await r.json();
    if (!r.ok) throw new Error(g.errore || r.status);
  } catch (e) {
    box.querySelector(".gr-titolo").textContent = `Grafici: ${e.message}`;
    return;
  }
  if (G.sym !== sym || !box.querySelector(".gr-griglia")) {
    for (const c of Object.values(G.col)) { c.via = true; c.ro.disconnect(); c.cp.remove(); c.ct.remove(); c.cs.remove(); }
    G.col = {};
    box.querySelector(".gr-griglia")?.remove();
    const gr = document.createElement("div");
    gr.className = "gr-griglia";
    box.appendChild(gr);
    for (const tf of ["D1", "H1"]) {
      const el = document.createElement("div");
      el.className = "gr-col";
      gr.appendChild(el);
      G.col[tf] = colonna(el, tf);
    }
    G.sym = sym;
  }
  G.dati = g;
  tabellaAtr(g);
  box.querySelector(".gr-titolo").textContent = `${g.nome} · dati ${STATO?.server || ""}`;
  fonteVolumi(g);
  for (const tf of ["D1", "H1"]) if (g[tf]) riempi(G.col[tf], g[tf], g.livelli, g.digits, g.nome);
}

// ATR(5) sull'ultima candela chiusa per H1 H4 H8 D1 W1 (per le valute anche in pip),
// freccia verde se è in aumento rispetto alla candela chiusa precedente, rossa se in diminuzione
function tabellaAtr(g) {
  const t = document.getElementById("gr-atr");
  if (!t) return;
  const a = g.atr5 || {}, tfs = ["H1", "H4", "H8", "D1", "W1"];
  if (!tfs.some(tf => a[tf])) { t.hidden = true; return; }
  const pip = g.digits === 5 || g.digits === 3 ? Math.pow(10, g.digits - 1) : null;
  const riga = tf => {
    const x = a[tf];
    if (!x) return `<tr><th scope="row">${tf}</th><td>–</td><td></td></tr>`;
    const f = x.v > x.prima ? `<span class="su" title="in aumento (prima ${x.prima.toFixed(g.digits)})">▲</span>`
            : x.v < x.prima ? `<span class="giu" title="in diminuzione (prima ${x.prima.toFixed(g.digits)})">▼</span>`
            : `<span title="invariato">=</span>`;
    return `<tr><th scope="row">${tf}</th><td>${x.v.toFixed(g.digits)}${pip ? ` <small>${Math.round(x.v * pip)} pip</small>` : ""}</td><td>${f}</td></tr>`;
  };
  t.innerHTML = `<caption>ATR(5) · ultima candela chiusa</caption>${tfs.map(riga).join("")}`;
  t.hidden = false;
}

// casella "volume CME": c'è solo per gli strumenti con un future su Yahoo (non DAX né Mag 7)
function fonteVolumi(g) {
  const cb = document.getElementById("gr-cme"), nota = document.getElementById("gr-cme-nota");
  if (!cb) return;
  cb.closest("label").hidden = !g.cme;
  if (nota) nota.textContent = !g.cme ? "volumi: tick volume di Pure"
    : conCme ? `volumi: ${g.cme.fut} CME (volume vero, Yahoo ~10 min di ritardo, base ${g.cme.base})${g.cme.completo ? "" : " · archivio più corto del movimento"}`
    : "volumi: tick volume di Pure";
}

document.addEventListener("change", e => {
  if (e.target.id === "gr-cme") {
    conCme = e.target.checked;
    try { localStorage.setItem("bradipo.cme", conCme ? "1" : "0"); } catch (er) {}
    if (G.dati) {
      fonteVolumi(G.dati);
      for (const tf of ["D1", "H1"]) if (G.dati[tf]) riempi(G.col[tf], G.dati[tf], G.dati.livelli, G.dati.digits, G.dati.nome);
    }
    return;
  }
  if (e.target.id !== "gr-segnali") return;
  conSegnali = e.target.checked;
  try { localStorage.setItem("bradipo.segnali3", conSegnali ? "1" : "0"); } catch (er) {}
  for (const c of Object.values(G.col)) marcatori(c);
});
document.addEventListener("DOMContentLoaded", () => {
  const cb = document.getElementById("gr-segnali");
  if (cb) cb.checked = conSegnali;
  const cc = document.getElementById("gr-cme");
  if (cc) cc.checked = conCme;
});
