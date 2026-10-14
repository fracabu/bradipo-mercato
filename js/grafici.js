// Grafici D1 e H1 con Lightweight Charts di TradingView, copiati dalle foto di Luigi del 14/10:
// sfondo grigio scuro senza griglia, candele Heikin Ashi bianche e nere, volume profile del movimento disegnato sul grafico
// (barre verdi = volume in salita, rosse = in discesa), POC rosso a puntini spesso,
// prezzo con linea bianca tratteggiata; sotto TSI rossa con media bianca e livelli ±50, stocastico verde con %D bianca.
// Frecce dei segnali Bradipo (3 condizioni: solo cambio di lato), accese di default:
// si spengono con la casella "segnali".
// Modulo usato dalla pagina Grafici (componenti/grafici.js): disegna dentro il riquadro che gli passa.
import { LOCALE, segno } from "./dati.js";
const LightweightCharts = window.LightweightCharts;
const STILE = {
  sfondo: "#3d3d3d", testo: "#cfcfcf", su: "#efefef", giu: "#141414", stoppino: "#bdbdbd",
  tsi: "#e8231f", ema: "#ffffff", k: "#2f8a1c", d: "#ffffff", livello: "#c9a227",
  poc: "#e8231f", va: "#c9a227", lungo: "rgba(232,35,31,0.7)",
  barraSu: "rgba(160,190,110,0.55)", barraGiu: "rgba(190,70,70,0.55)", zona: "rgba(255,255,255,0.05)",
  long: "#7fd36a", short: "#ff5a50", sar: "#ffd60a", mia: "#4fc3f7",
};
const NOME_TF = { M15: "15 minuti", H1: "1 ora", H4: "4 ore", H8: "8 ore", D1: "1 giorno", W1: "1 settimana" };
const SEC = { M15: 900, H1: 3600, H4: 14400, H8: 28800, D1: 86400, W1: 604800 };
// i due grafici affiancati: di partenza D1 e H1, ognuno si può passare a un altro TF coi pulsanti in testa (utente 22/10)
const POSTI = { a: "D1", b: "H1" };
const tfDi = posto => { try { const v = localStorage.getItem(`bradipo.tf.${posto}`); return SEC[v] ? v : POSTI[posto]; } catch (e) { return POSTI[posto]; } };
const G = { sym: null, col: {}, dati: null, piano: null, trade: null };

// Piano della pagina Analisi (ingresso, stop, target, livelli in mezzo): linee su D1 e H1 e, sull'H1, il riquadro
// rischio/rendimento a destra come lo strumento "posizione" di TradingView. null = nessun piano (pagina Grafici)
export function impostaPiano(p) {
  G.piano = p;
  for (const c of Object.values(G.col)) if (c.s) riempi(c, c.s, G.dati.livelli, G.dati.digits, G.dati.nome);
}

// Storia di un trade del conto simulato (dal Registro, utente 22/10): entrata e uscita segnate sulle candele, riquadro
// da entrata a uscita verde fino al target e rosso fino allo stop iniziale, lo stop a gradini dietro al SAR, e la vista
// centrata sul trade. Tempi in ora del broker, come le candele. null = nessun trade
export function impostaTrade(t) {
  const nuovo = t && (t.sym !== G.trade?.sym || t.t !== G.trade?.t);     // a ogni giro arriva lo stesso trade: la vista resta
  G.trade = t;
  for (const c of Object.values(G.col)) { if (nuovo || c.primo) c.centra = !!t; if (c.s) riempi(c, c.s, G.dati.livelli, G.dati.digits, G.dati.nome); }
}
// le candele del trade su questo grafico: da quella d'entrata a quella d'uscita (o l'ultima, se è ancora aperto)
function candeleTrade(c) {
  const T = G.trade;
  if (!T || !c.s) return null;
  const i0 = candelaDi(c.s, T.t), i1 = T.t_uscita ? candelaDi(c.s, T.t_uscita) : c.s.t.length - 1;
  return i0 < 0 ? null : [i0, Math.max(i0, i1)];
}
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

function colonna(el, tf, posto) {
  el.innerHTML = `<div class="gr-testa"><b></b><span class="gr-tf" role="group" aria-label="timeframe del grafico">${Object.keys(SEC).map(x =>
      `<button type="button" data-tf="${x}" title="${NOME_TF[x]}">${x}</button>`).join("")}</span><span class="gr-info"></span><button type="button" class="gr-foto" title="copia l'immagine del grafico (anche D/H sulla tastiera)">📷</button></div>
    <div class="gr-prezzo"><canvas class="gr-profilo"></canvas></div><div class="gr-osc"></div><div class="gr-osc"></div>`;
  const ep = el.querySelector(".gr-prezzo"), [et, es] = el.querySelectorAll(".gr-osc");
  const cp = LightweightCharts.createChart(ep, opzioni(false));
  const ct = LightweightCharts.createChart(et, opzioni(false));
  const cs = LightweightCharts.createChart(es, opzioni(true));
  // oscillatori: niente numeri automatici sulla scala (si sovrapponevano ai livelli, su telefono sembravano "1.99"):
  // restano solo le etichette colorate dei livelli fissi e dei valori attuali
  for (const c of [ct, cs]) c.priceScale("right").applyOptions({ textColor: "rgba(0,0,0,0)" });
  // indicatore Bradipo (utente 23/10 notte, "sfondo colorato"): dietro le candele, a tutta altezza su una scala sua,
  // verde o rosso quando il TF e quello sopra (H1: D1) sono d'accordo, niente quando sono contro
  const sfondo = cp.addHistogramSeries({ priceScaleId: "bradipo", priceLineVisible: false, lastValueVisible: false, base: 0,
    crosshairMarkerVisible: false, autoscaleInfoProvider: () => ({ priceRange: { minValue: 0, maxValue: 1 } }) });
  cp.priceScale("bradipo").applyOptions({ scaleMargins: { top: 0, bottom: 0 }, visible: false });
  const candele = cp.addCandlestickSeries({
    upColor: STILE.su, downColor: STILE.giu, borderUpColor: "#9a9a9a", borderDownColor: "#000",
    wickUpColor: STILE.stoppino, wickDownColor: STILE.giu,   // candele nere con lo stoppino nero (utente 17/10)
    priceLineVisible: false, lastValueVisible: false,     // candele HA: il prezzo vero è una linea a parte
  });
  // SAR H1 del conto simulato (stop e trailing): puntini gialli
  const sar = cp.addLineSeries({ color: STILE.sar, lineVisible: false, pointMarkersVisible: true, pointMarkersRadius: 1.5,
    priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
  // storia del trade scelto nel Registro: entrata, target e stop a gradini, solo fra entrata e uscita
  const tr = { autoscaleInfoProvider: () => null, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false };
  const trIn = cp.addLineSeries({ ...tr, color: "#ffffff", lineWidth: 2 });
  const trTp = cp.addLineSeries({ ...tr, color: STILE.long, lineWidth: 2, lineStyle: 2 });
  const trSl = cp.addLineSeries({ ...tr, color: STILE.short, lineWidth: 2, lineType: 1 });
  const tsi = ct.addLineSeries({ color: STILE.tsi, lineWidth: 3, priceLineVisible: false, lastValueVisible: true });
  const ema = ct.addLineSeries({ color: STILE.ema, lineWidth: 2, priceLineVisible: false, lastValueVisible: true });
  tsi.createPriceLine({ price: 0, color: "#ffffff", lineWidth: 1, lineStyle: 0, axisLabelVisible: false });
  for (const v of [50, -50]) tsi.createPriceLine({ price: v, color: STILE.livello, lineWidth: 1, lineStyle: 1, axisLabelVisible: true });
  const k = cs.addLineSeries({ color: STILE.k, lineWidth: 3, priceLineVisible: false, lastValueVisible: true });
  const d = cs.addLineSeries({ color: STILE.d, lineWidth: 2, priceLineVisible: false, lastValueVisible: true });
  for (const v of [20, 80]) k.createPriceLine({ price: v, color: "#8a8a8a", lineWidth: 1, lineStyle: 1, axisLabelVisible: true });
  const c = { tf, posto, el, ep, cv: el.querySelector(".gr-profilo"), cp, sfondo, ct, cs, candele, sar, trIn, trTp, trSl, tsi, ema, k, d, linee: [], primo: true, s: null, via: false };
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
  // e i prezzi veri di Pure della candela (le candele disegnate sono Heikin Ashi); senza mouse quelli dell'ultima
  const testata = p => {
    const info = el.querySelector(".gr-info");
    if (!c.s) { info.textContent = ""; return; }
    const i = p.time ? c.s.t.indexOf(p.time) : c.s.t.length - 1, sv = i >= 0 && c.s.sar ? c.s.sar[i] : null;
    const dg = G.dati?.digits ?? 5, f = v => v == null ? "–" : v.toFixed(dg);
    const vera = i >= 0 && c.s.rc ? `vera A ${f(c.s.ro[i])} M ${f(c.s.rh[i])} m ${f(c.s.rl[i])} C ${f(c.s.rc[i])}` : "";
    if (!p.time) { info.textContent = `${vera}${vera ? " · " : ""}stoc ${c.s.stoc}`; return; }
    const d = new Date(p.time * 1000), z = n => String(n).padStart(2, "0");
    const quando = `${z(d.getUTCDate())}/${z(d.getUTCMonth() + 1)}${SEC[c.tf] >= 86400 ? "" : ` ${z(d.getUTCHours())}:${z(d.getUTCMinutes())}`}`;
    const b = i >= 0 && c.s.bradipo ? c.s.bradipo[i] : null;
    const br = !b ? "" : `Bradipo ${b[0] > 0 ? "long" : "short"} ${b[1] ? "a favore" : "contro"}${b[2] != null ? ` · cicla ${b[2]}` : ""}`;
    info.textContent = [quando, vera, sv != null ? `SAR ${f(sv)}` : "", br].filter(Boolean).join(" · ");
  };
  c.testata = testata;
  for (const ch of [cp, ct, cs]) ch.subscribeCrosshairMove(testata);
  cp.subscribeClick(p => clic(c, p));
  el.querySelector(".gr-foto").addEventListener("click", () => foto(c));
  el.querySelector(".gr-tf").addEventListener("click", e => { const b = e.target.closest("button"); if (b && !b.disabled) cambiaTf(c, b.dataset.tf); });
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
  if (SEC[c.tf] < 86400) riquadroPiano(c, g, larg);   // il piano si guarda sui TF di ingresso, non su D1 e W1
  riquadroTrade(c, g, larg);
}

// Riquadro del trade come lo strumento "posizione" di TradingView, ma da entrata a uscita
function riquadroTrade(c, g, larg) {
  const T = G.trade, ii = candeleTrade(c);
  if (!T || !ii) return;
  const ts = c.cp.timeScale(), mezza = Math.max(2, ts.options().barSpacing / 2);
  const x0 = ts.logicalToCoordinate(ii[0]), x1 = ts.logicalToCoordinate(ii[1]);
  const yi = c.candele.priceToCoordinate(T.prezzo), ys = c.candele.priceToCoordinate(T.sl0);
  if (x0 === null || x1 === null || yi === null) return;
  const a = Math.max(0, x0 - mezza), b = Math.min(larg, x1 + mezza);
  if (b <= a) return;
  if (T.tp != null) {
    const yt = c.candele.priceToCoordinate(T.tp);
    if (yt !== null) { g.fillStyle = "rgba(127,211,106,0.20)"; g.fillRect(a, Math.min(yi, yt), b - a, Math.abs(yt - yi)); }
  }
  if (ys !== null) { g.fillStyle = "rgba(255,90,80,0.22)"; g.fillRect(a, Math.min(yi, ys), b - a, Math.abs(ys - yi)); }
  if (T.uscita != null) {            // dall'entrata all'uscita: il tratto che il trade ha fatto davvero
    const yu = c.candele.priceToCoordinate(T.uscita);
    if (yu !== null) {
      g.strokeStyle = T.r >= 0 ? STILE.long : STILE.short; g.lineWidth = 2; g.setLineDash([5, 4]);
      g.beginPath(); g.moveTo(a, yi); g.lineTo(b, yu); g.stroke(); g.setLineDash([]);
    }
  }
}

// Riquadro rischio/rendimento: dall'ultima candela al bordo destro, verde fino al target, rosso fino allo stop
function riquadroPiano(c, g, larg) {
  const P = G.piano;
  if (!P) return;
  const yi = c.candele.priceToCoordinate(P.ingresso), ys = c.candele.priceToCoordinate(P.stop), yt = c.candele.priceToCoordinate(P.target);
  if (yi === null || ys === null || yt === null) return;
  let x = c.cp.timeScale().logicalToCoordinate(c.s.t.length - 1);
  if (x === null || x > larg - 60) x = larg - 110;
  x = Math.max(0, Math.min(x, larg - 110));
  const w = larg - x;
  g.fillStyle = "rgba(127,211,106,0.22)"; g.fillRect(x, Math.min(yi, yt), w, Math.abs(yt - yi));
  g.fillStyle = "rgba(255,90,80,0.24)"; g.fillRect(x, Math.min(yi, ys), w, Math.abs(ys - yi));
  g.fillStyle = "#ffffff"; g.fillRect(x, yi - 1, w, 2);
  // niente scritte dentro (utente 18/10): i numeri stanno nei pulsantini sopra il grafico
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
    const su = x.lato === "long";
    return { time: x.t, position: su ? "belowBar" : "aboveBar", color: su ? STILE.long : STILE.short,
             shape: su ? "arrowUp" : "arrowDown", size: 1, text: su ? "B" : "S" };
  });
  // freccia Bradipo filtrata (cambio a favore, stop sotto 1 ATR, ciclo 70 o più): gialla e grande sulle candele
  for (const [i, b] of (c.s.bradipo || []).entries()) if (b[3]) {
    const su = b[0] > 0;
    m.push({ time: c.s.t[i], position: su ? "belowBar" : "aboveBar", color: STILE.sar, shape: su ? "arrowUp" : "arrowDown",
             size: 2, text: `Bradipo · ciclo ${b[2]}` });
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
  const T = G.trade, ii = candeleTrade(c);
  if (T && ii) {
    const su = T.lato === "long";
    m.push({ time: c.s.t[ii[0]], position: su ? "belowBar" : "aboveBar", color: "#ffffff",
             shape: su ? "arrowUp" : "arrowDown", size: 1.4, text: `entrata ${T.lato}` });
    if (T.t_uscita) m.push({ time: c.s.t[ii[1]], position: su ? "aboveBar" : "belowBar", color: T.r >= 0 ? STILE.long : STILE.short,
             shape: "circle", size: 1.2, text: `uscita ${segno(T.r)} R` });
  }
  m.sort((a, b) => a.time - b.time);
  c.candele.setMarkers(m);
}

// posizioni aperte del conto simulato: entrata, stop (che segue il SAR) e target come linee
function posizioni(c, s) {
  // solo l'etichetta colorata col prezzo sulla scala: le scritte dentro il grafico coprivano le candele (utente 16/10)
  const riga = (p, col, w, stile, titolo) => p && c.linee.push(c.candele.createPriceLine(
    { price: p, color: col, lineWidth: w, lineStyle: stile, axisLabelVisible: true, title: titolo }));
  // trade simulati su Pure (le due serie spesso coincidono: una linea sola per prezzo), tratteggiati
  const sim = G.piano || G.trade ? [] : G.dati?.sim || [], fatte = new Set();   // col piano o un trade aperto solo le loro linee
  for (const p of sim) for (const [v, col] of [[p.prezzo, "#ffffff"], [p.sl, STILE.short], [p.tp, STILE.long]]) {
    if (fatte.has(v)) continue;
    fatte.add(v);
    riga(v, col, 1, 2, "");
  }
  // la scala dei prezzi comprende anche stop e target, altrimenti sull'H1 il target resta fuori dal grafico
  const P = G.piano;
  if (P) {
    // senza scritte dentro il grafico: coprivano il riquadro R:R, che dice già cosa sono
    riga(P.ingresso, "#ffffff", 2, 0, "");
    riga(P.stop, STILE.short, 2, 0, "");
    riga(P.target, STILE.long, 2, 0, "");
    for (const o of P.ostacoli || []) riga(o.prezzo, STILE.livello, 1, 2, "");
  }
  const T = G.trade, ii = candeleTrade(c);
  const estremi = [...sim, ...(P ? [{ sl: P.stop, tp: P.target }] : []), ...(T && ii ? [{ sl: T.sl0, tp: T.tp }] : [])].flatMap(p => [p.sl, p.tp]).filter(Boolean);
  c.candele.applyOptions({ autoscaleInfoProvider: base => {
    const r = base();
    if (!r || !estremi.length) return r;
    return { ...r, priceRange: { minValue: Math.min(r.priceRange.minValue, ...estremi),
                                 maxValue: Math.max(r.priceRange.maxValue, ...estremi) } };
  } });
  // SAR H1 sempre visibile su tutti gli strumenti (utente 16/10): è dove va lo stop di ogni trade
  c.sar.setData(!s.sar ? [] : s.t.map((t, i) => ({ time: t, value: s.sar[i] })));
  // il trade: entrata e target dritti, lo stop in vigore su ogni candela (gradini dietro al SAR, dalla storia)
  const tratto = v => !ii || v == null ? [] : s.t.slice(ii[0], ii[1] + 1).map(time => ({ time, value: v }));
  const dur = SEC[c.tf], st = T?.storia || (T ? [[T.t, T.sl0]] : []);
  c.trIn.setData(tratto(T?.prezzo));
  c.trTp.setData(tratto(T?.tp));
  c.trSl.setData(tratto(T?.sl0).map(p => {
    let v = T.sl0;
    for (const [ts, x] of st) if (ts < p.time + dur) v = x;
    return { ...p, value: v };
  }));
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
  // sfondo Bradipo: verde o rosso dove il TF è d'accordo con quello sopra, vuoto dove è contro
  c.sfondo.setData((s.bradipo || []).map(([lato, favore], i) => ({ time: s.t[i], value: lato && favore ? 1 : 0,
    color: lato > 0 ? "rgba(127,211,106,0.13)" : "rgba(255,90,80,0.13)" })));
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
  c.el.querySelector(".gr-testa b").textContent = nome;
  for (const b of c.el.querySelectorAll(".gr-tf button")) {
    b.setAttribute("aria-pressed", b.dataset.tf === c.tf);
    b.disabled = !G.dati?.[b.dataset.tf];                  // dati pubblicati prima del 22/10: solo D1 e H1
  }
  const u = s.t.length - 1;
  c.testata ? c.testata({}) : (c.el.querySelector(".gr-info").textContent = `stoc ${s.stoc}`);
  const ii = c.centra && candeleTrade(c);
  if (ii) {                              // trade dal Registro: il trade in mezzo, con un po' di candele prima e dopo
    const largo = Math.max(30, (ii[1] - ii[0]) * 1.5);
    c.cp.timeScale().setVisibleLogicalRange({ from: ii[0] - largo, to: Math.min(s.t.length + 3, ii[1] + largo) });
    c.centra = c.primo = false;
  } else if (c.primo) {                  // la prima volta le ultime ~100 candele; poi resta dove l'hai lasciato
    c.cp.timeScale().setVisibleLogicalRange({ from: s.t.length - 100, to: s.t.length + 3 });
    c.primo = false;
  }
  requestAnimationFrame(() => profilo(c));
}

// lasciando la pagina: i grafici vanno smontati, altrimenti il ResizeObserver lavora su elementi spariti
export function chiudiGrafici() {
  for (const c of Object.values(G.col)) { c.via = true; c.ro.disconnect(); c.cp.remove(); c.ct.remove(); c.cs.remove(); }
  G.col = {};
  G.sym = null;
}

export async function mostraGrafici(box, sym, server) {
  if (!box || !sym || !LightweightCharts) return;
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
    chiudiGrafici();
    box.querySelector(".gr-griglia")?.remove();
    const gr = document.createElement("div");
    gr.className = "gr-griglia";
    box.appendChild(gr);
    for (const posto of Object.keys(POSTI)) {
      const el = document.createElement("div");
      el.className = "gr-col";
      gr.appendChild(el);
      G.col[posto] = colonna(el, tfDi(posto), posto);
    }
    G.sym = sym;
    G.modo = null; G.primo = null;
    tasti(box);
  }
  G.dati = g;
  tabellaAtr(box, g);
  box.querySelector(".gr-titolo").textContent = `${g.nome} · dati ${server || ""}`;
  fonteVolumi(box, g);
  for (const c of Object.values(G.col)) {
    if (!g[c.tf]) c.tf = POSTI[c.posto];
    if (g[c.tf]) riempi(c, g[c.tf], g.livelli, g.digits, g.nome);
  }
  disegni();
}

// pulsanti in testa al grafico: lo stesso strumento su un altro TF, ricordato in questo browser
function cambiaTf(c, tf) {
  if (tf === c.tf || !G.dati?.[tf]) return;
  c.tf = tf;
  try { localStorage.setItem(`bradipo.tf.${c.posto}`, tf); } catch (e) {}
  c.primo = true; c.centra = !!G.trade; G.primo = null;
  riempi(c, G.dati[tf], G.dati.livelli, G.dati.digits, G.dati.nome);
  disegni();
}

// Linee tracciate a mano (utente 20/10): orizzontali (valgono su D1 e H1) e oblique da due clic (solo sul loro grafico).
// Restano in questo browser, per strumento; "togli ultima" / "togli tutte" nella barra sopra i grafici.
const tracciate = () => { try { return JSON.parse(localStorage.getItem(`bradipo.linee.${G.sym}`)) || []; } catch (e) { return []; } };
const salva = l => { try { localStorage.setItem(`bradipo.linee.${G.sym}`, JSON.stringify(l)); } catch (e) {} };

function disegni() {
  for (const c of Object.values(G.col)) {
    for (const x of c.mie || []) x.serie ? c.cp.removeSeries(x.serie) : c.candele.removePriceLine(x);
    c.mie = [];
    for (const l of tracciate()) {
      if (l.tipo === "o") c.mie.push(c.candele.createPriceLine({ price: l.p, color: STILE.mia, lineWidth: 2, lineStyle: 0, axisLabelVisible: true, title: "" }));
      else if (l.tf === c.tf) {
        const serie = c.cp.addLineSeries({ color: STILE.mia, lineWidth: 2, priceLineVisible: false, lastValueVisible: false,
          crosshairMarkerVisible: false, autoscaleInfoProvider: () => null });
        serie.setData([l.a, l.b].sort((x, y) => x[0] - y[0]).map(([time, value]) => ({ time, value })));
        c.mie.push({ serie });
      }
    }
  }
}

function clic(c, p) {
  if (!G.modo || !p.point) return;
  const prezzo = c.candele.coordinateToPrice(p.point.y), t = p.time ?? c.s?.t.at(-1);
  if (prezzo == null || t == null) return;
  const l = tracciate();
  if (G.modo === "o") l.push({ tipo: "o", p: prezzo });
  else if (!G.primo || G.primo.tf !== c.tf) { G.primo = { tf: c.tf, a: [t, prezzo] }; return c.el.querySelector(".gr-info").textContent = "clic sul secondo punto"; }
  else if (t === G.primo.a[0]) l.push({ tipo: "o", p: prezzo });          // stessa candela: diventa orizzontale
  else l.push({ tipo: "t", tf: c.tf, a: G.primo.a, b: [t, prezzo] });
  G.primo = null;
  salva(l);
  disegni();
}

function tasti(box) {
  const barra = box.querySelector(".gr-strumenti");
  if (!barra || barra.dataset.pronta) return;
  barra.dataset.pronta = "1";
  barra.addEventListener("click", e => {
    const b = e.target.closest("button");
    if (!b) return;
    const a = b.dataset.azione;
    if (a === "o" || a === "t") {
      G.modo = G.modo === a ? null : a;
      G.primo = null;
    } else if (a === "ultima") { const l = tracciate(); l.pop(); salva(l); disegni(); }
    else if (a === "tutte") { salva([]); disegni(); }
    for (const x of barra.querySelectorAll("[data-azione=o],[data-azione=t]")) x.setAttribute("aria-pressed", x.dataset.azione === G.modo);
    for (const c of Object.values(G.col)) c.ep.style.cursor = G.modo ? "crosshair" : "";
  });
}

// Foto della colonna (prezzo con il volume profile, TSI, stocastico) negli appunti, da incollare su Telegram;
// se il browser non lo permette la scarica come PNG.
async function foto(c) {
  const parti = [c.cp, c.ct, c.cs].map(ch => ch.takeScreenshot());
  const tela = document.createElement("canvas"), testa = 26;
  tela.width = Math.max(...parti.map(x => x.width));
  tela.height = testa + parti.reduce((n, x) => n + x.height, 0);
  const g = tela.getContext("2d");
  g.fillStyle = STILE.sfondo; g.fillRect(0, 0, tela.width, tela.height);
  g.fillStyle = STILE.testo; g.font = "14px IBM Plex Mono, monospace";
  g.fillText(`${G.dati?.nome || G.sym}  ${NOME_TF[c.tf]}  ${new Date().toLocaleString("it-IT")}`, 8, 18);
  let y = testa;
  for (const [i, x] of parti.entries()) {
    g.drawImage(x, 0, y);
    if (i === 0 && c.cv.width) g.drawImage(c.cv, 0, y, x.width, x.height);
    y += x.height;
  }
  const blob = await new Promise(r => tela.toBlob(r, "image/png"));
  const bottone = c.el.querySelector(".gr-foto");
  try {
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    bottone.textContent = "✓ copiata";
  } catch (e) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `${G.sym}-${c.tf}.png`; a.click();
    bottone.textContent = "✓ scaricata";
  }
  setTimeout(() => { bottone.textContent = "📷"; }, 1500);
}

// tasti rapidi: D = foto del D1, H = foto dell'H1 (non mentre si scrive in un campo)
document.addEventListener("keydown", e => {
  if (e.ctrlKey || e.metaKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  const posto = { d: "a", h: "b" }[e.key.toLowerCase()];     // D = grafico di sinistra, H = di destra
  if (posto && G.col[posto]) foto(G.col[posto]);
  if (e.key === "Escape") G.primo = null;
});

// ATR(5) sull'ultima candela chiusa per H1 H4 H8 D1 W1 (per le valute anche in pip),
// freccia verde se è in aumento rispetto alla candela chiusa precedente, rossa se in diminuzione
function tabellaAtr(box, g) {
  const t = box.querySelector(".gr-atr");
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
function fonteVolumi(box, g) {
  const cb = box.querySelector("#gr-cme"), nota = box.querySelector("#gr-cme-nota");
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
      fonteVolumi(e.target.closest(".grafici"), G.dati);
      for (const c of Object.values(G.col)) if (G.dati[c.tf]) riempi(c, G.dati[c.tf], G.dati.livelli, G.dati.digits, G.dati.nome);
    }
    return;
  }
  if (e.target.id !== "gr-segnali") return;
  conSegnali = e.target.checked;
  try { localStorage.setItem("bradipo.segnali3", conSegnali ? "1" : "0"); } catch (er) {}
  for (const c of Object.values(G.col)) marcatori(c);
});
// stato iniziale delle due caselle, ricordato da una visita all'altra
export const caselle = () => ({ segnali: conSegnali, cme: conCme });
