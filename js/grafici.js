// Grafici con Lightweight Charts di TradingView, copiati dalle foto di Luigi: sfondo grigio scuro senza griglia, candele
// Heikin Ashi bianche e nere, prezzo con linea bianca tratteggiata; sotto TSI rossa con media bianca e livelli ±50, stocastico
// verde con %D bianca. Utente 30/10: niente pivot, grafico pulito col POC, profili come quelli di Luigi (un profilo da ogni
// grande perno aperto fino a oggi, barre su W1 e D1, POC a puntini su ogni TF), un grafico a tutto schermo o i due del ciclo
// superiore e del sottociclo, disegni e righello (disegni.js), indicatori da aggiungere (calcoli.js).
// Modulo usato dalla pagina Grafici (componenti/grafici.js): disegna dentro il riquadro che gli passa.
import { LOCALE, segno } from "./dati.js";
import { atr, bollinger, ema, macd, rsi, sma } from "./calcoli.js";
import { COLORI, D, annulla, caricaDisegni, coloraScelto, collega, dipingi, distanza, indice, indietro, scegliStrumento, sullaScala, togliScelto, togliTutti, xDi } from "./disegni.js";
const LightweightCharts = window.LightweightCharts;
const STILE = {
  sfondo: "#3d3d3d", testo: "#cfcfcf", su: "#efefef", giu: "#141414", stoppino: "#bdbdbd",
  tsi: "#e8231f", ema: "#ffffff", k: "#2f8a1c", d: "#ffffff", livello: "#c9a227",
  poc: "#ff2d2d", barraSu: "rgba(111,158,63,0.55)", barraGiu: "rgba(192,57,43,0.55)", zona: "rgba(255,255,255,0.045)",
  barraSuVa: "rgba(125,190,62,0.92)", barraGiuVa: "rgba(222,72,56,0.92)", pocVis: "#ffb000", vaVis: "rgba(255,255,255,0.55)",
  long: "#7fd36a", short: "#ff5a50", sar: "#ffd60a", figura: "#ffa94d", trend: "#c08cff",
};
const NOME_TF = { M5: "5 minuti", M15: "15 minuti", H1: "1 ora", H4: "4 ore", H8: "8 ore", D1: "1 giorno", W1: "1 settimana" };
const SEC = { M5: 300, M15: 900, H1: 3600, H4: 14400, H8: 28800, D1: 86400, W1: 604800 };
const COPPIE = [["H8", "H1"], ["D1", "H4"], ["W1", "D1"]];     // ciclo superiore e sottociclo
const STRUMENTI = [["matita", "✎", "Matita a mano libera, resta accesa finché non la spegni", "Alt+P"], ["trend", "╱", "Linea", "Alt+T"], ["raggio", "↗", "Raggio", ""], ["oriz", "—", "Orizzontale", "Alt+H"], ["vert", "│", "Verticale", "Alt+V"],
  ["canale", "▱", "Canale parallelo (3 clic)", "Alt+C"], ["rett", "▭", "Rettangolo", "Alt+R"], ["fib", "𝔽", "Ritracciamento di Fibonacci", "Alt+F"],
  ["righello", "📏", "Righello (o Shift+clic)", ""]];
const PANNELLI = { tsi: "TSI 8,5,3", stoc: "Stocastico 8,5,3", rsi: "RSI 14", macd: "MACD 12,26,9", atr: "ATR 14", vol: "Volumi" };
const COL_MEDIE = ["#4fc3f7", "#ff8a50", "#ff5ad7", "#7fd36a", "#ffd60a"];

const leggi = (k, base) => { try { return { ...base, ...JSON.parse(localStorage.getItem(k)) }; } catch (e) { return base; } };
const scrivi = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const O = leggi("bradipo.grafici", {
  segnali: true, sar: true, sfondo: false, vere: false, log: false,
  pannelli: { tsi: true, stoc: true, rsi: false, macd: false, atr: false, vol: false },
  medie: [{ tipo: "ema", n: 25, solo: "H1" }],
  barre: true, barrePiccoli: true, barreVecchi: false, va: true, visibile: false, poc: true, spenti: [], trend: true, canale: true, figure: true, altezze: {}, tolti: [],
});
const salvaO = () => scrivi("bradipo.grafici", O);
const tfDi = (posto, base) => { try { const v = localStorage.getItem(`bradipo.tf.${posto}`); return SEC[v] ? v : base; } catch (e) { return base; } };
const G = { sym: null, col: {}, dati: null, piano: null, trade: null, box: null, due: false, manuali: {}, scelta: null, pila: [] };

// Piano della pagina Analisi (ingresso, stop, target, livelli in mezzo): linee sui grafici e, sui TF d'ingresso, il riquadro
// rischio/rendimento a destra come lo strumento "posizione" di TradingView. null = nessun piano (pagina Grafici)
export function impostaPiano(p) {
  G.piano = p;
  for (const c of Object.values(G.col)) if (c.s) riempi(c);
}

// Storia di un trade del conto simulato (dal Registro, utente 22/10): entrata e uscita segnate sulle candele, riquadro
// da entrata a uscita verde fino al target e rosso fino allo stop iniziale, lo stop a gradini dietro al SAR, e la vista
// centrata sul trade. Tempi in ora del broker, come le candele. null = nessun trade
export function impostaTrade(t) {
  const nuovo = t && (t.sym !== G.trade?.sym || t.t !== G.trade?.t);     // a ogni giro arriva lo stesso trade: la vista resta
  G.trade = t;
  for (const c of Object.values(G.col)) { if (nuovo || c.primo) c.centra = !!t; if (c.s) riempi(c); }
}
// le candele del trade su questo grafico: da quella d'entrata a quella d'uscita (o l'ultima, se è ancora aperto)
function candeleTrade(c) {
  const T = G.trade;
  if (!T || !c.s) return null;
  const i0 = candelaDi(c.s, T.t), i1 = T.t_uscita ? candelaDi(c.s, T.t_uscita) : c.s.t.length - 1;
  return i0 < 0 ? null : [i0, Math.max(i0, i1)];
}

function opzioni(asse) {
  return {
    autoSize: true,
    layout: { attributionLogo: false, background: { type: "solid", color: STILE.sfondo }, textColor: STILE.testo,
              fontFamily: "IBM Plex Mono, monospace", fontSize: 11 },
    grid: { vertLines: { visible: false }, horzLines: { visible: false } },
    rightPriceScale: { borderColor: "#555", minimumWidth: 74, scaleMargins: { top: 0.05, bottom: 0.05 } },
    timeScale: { visible: asse, borderColor: "#555", timeVisible: true, secondsVisible: false, rightOffset: 4 },
    crosshair: { mode: 0 },
  };
}

function colonna(el, tf, posto) {
  el.innerHTML = `<div class="gr-testa"><b></b><span class="gr-tf" role="group" aria-label="timeframe del grafico">${Object.keys(SEC).map(x =>
      `<button type="button" data-tf="${x}" title="${NOME_TF[x]}">${x}</button>`).join("")}</span><span class="gr-info"></span><button type="button" class="gr-foto" title="copia l'immagine del grafico">📷</button></div>
    <div class="gr-prezzo"><canvas class="gr-profilo"></canvas></div><div class="gr-pannelli"></div>`;
  const ep = el.querySelector(".gr-prezzo");
  const cp = LightweightCharts.createChart(ep, opzioni(false));
  // indicatore Bradipo (utente 23/10 notte, "sfondo colorato"): dietro le candele, a tutta altezza su una scala sua,
  // verde o rosso quando il TF e quello sopra sono d'accordo, niente quando sono contro; dal 30/10 si accende dal menu
  const sfondo = cp.addHistogramSeries({ priceScaleId: "bradipo", priceLineVisible: false, lastValueVisible: false, base: 0,
    crosshairMarkerVisible: false, autoscaleInfoProvider: () => ({ priceRange: { minValue: 0, maxValue: 1 } }) });
  cp.priceScale("bradipo").applyOptions({ scaleMargins: { top: 0, bottom: 0 }, visible: false });
  const candele = cp.addCandlestickSeries({
    upColor: STILE.su, downColor: STILE.giu, borderUpColor: "#9a9a9a", borderDownColor: "#000",
    wickUpColor: STILE.stoppino, wickDownColor: STILE.giu,   // candele nere con lo stoppino nero (utente 17/10)
    priceLineVisible: false, lastValueVisible: false,     // candele HA: il prezzo vero è una linea a parte
  });
  // SAR del TF (stop e trailing): puntini gialli
  const sar = cp.addLineSeries({ color: STILE.sar, lineVisible: false, pointMarkersVisible: true, pointMarkersRadius: 1.5,
    priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
  // storia del trade scelto nel Registro: entrata, target e stop a gradini, solo fra entrata e uscita
  const tr = { autoscaleInfoProvider: () => null, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false };
  const trIn = cp.addLineSeries({ ...tr, color: "#ffffff", lineWidth: 2 });
  const trTp = cp.addLineSeries({ ...tr, color: STILE.long, lineWidth: 2, lineStyle: 2 });
  const trSl = cp.addLineSeries({ ...tr, color: STILE.short, lineWidth: 2, lineType: 1 });
  const c = { tf, posto, el, ep, cv: el.querySelector(".gr-profilo"), cp, sfondo, candele, sar, trIn, trTp, trSl, linee: [], medie: [], pannelli: [], primo: true, s: null, via: false, passo: SEC[tf] };
  cp.timeScale().subscribeVisibleLogicalRangeChange(r => sincronizza(c, cp, r));
  // passando col mouse: ora della candela e valore del SAR nella testata della colonna (utente 16/10)
  // e i prezzi veri di Pure della candela; senza mouse quelli dell'ultima
  c.testata = p => {
    const info = el.querySelector(".gr-info");
    if (!c.s) { info.textContent = ""; return; }
    const i = p.time ? c.s.t.indexOf(p.time) : c.s.t.length - 1, sv = i >= 0 && c.s.sar ? c.s.sar[i] : null;
    const dg = G.dati?.digits ?? 5, f = v => v == null ? "–" : v.toFixed(dg);
    const vera = i >= 0 && c.s.rc ? `A ${f(c.s.ro[i])} M ${f(c.s.rh[i])} m ${f(c.s.rl[i])} C ${f(c.s.rc[i])}` : "";
    if (!p.time) { info.textContent = vera; return; }
    const d = new Date(p.time * 1000), z = n => String(n).padStart(2, "0");
    const quando = `${z(d.getUTCDate())}/${z(d.getUTCMonth() + 1)}${SEC[c.tf] >= 86400 ? "" : ` ${z(d.getUTCHours())}:${z(d.getUTCMinutes())}`}`;
    info.textContent = [quando, vera, sv != null && O.sar ? `SAR ${f(sv)}` : ""].filter(Boolean).join(" · ");
  };
  cp.subscribeCrosshairMove(c.testata);
  cp.subscribeCrosshairMove(q => mirino(c, cp, q));
  ep.addEventListener("pointerenter", () => mirinoSu(c, cp));
  el.querySelector(".gr-foto").addEventListener("click", () => foto(c));
  el.querySelector(".gr-tf").addEventListener("click", e => { const b = e.target.closest("button"); if (b && !b.disabled) cambiaTf(c, b.dataset.tf); });
  collega(c);
  montaPannelli(c);
  giro(c);
  return c;
}

// le parti della colonna scorrono e zoomano insieme
function sincronizza(c, ch, r) {
  if (!r || c.sync) return;
  c.sync = true;
  for (const o of [c.cp, ...c.pannelli.map(p => p.ch)]) if (o !== ch) o.timeScale().setVisibleLogicalRange(r);
  c.sync = false;
}

// La riga verticale del mirino scende su tutta la colonna (utente 30/10: per vedere se gli oscillatori incrociano sulla candela
// del segnale o uno prima dell'altro). La riga orizzontale resta solo dove sta il mouse.
const partiColonna = c => [[c.cp, c.candele], ...c.pannelli.map(p => [p.ch, p.area.candele])];
function mirinoSu(c, ch) {
  c.attivo = ch;
  for (const [o] of partiColonna(c)) o.applyOptions({ crosshair: { horzLine: { visible: o === ch, labelVisible: o === ch } } });
}
function mirino(c, ch, q) {
  if (c.attivo !== ch) return;           // è il mirino messo da qui sugli altri, non il mouse
  for (const [o, serie] of partiColonna(c)) {
    if (o === ch) continue;
    if (q.time === undefined) o.clearCrosshairPosition();
    else o.setCrosshairPosition(0, q.time, serie);
  }
  if (ch !== c.cp) c.testata(q);
}

function togliPannelli(c) {
  for (const p of c.pannelli) { p.area.scollega?.(); p.ch.remove(); }
}

// L'altezza degli oscillatori si tira dal bordo sopra e sotto (utente 31/10) e vale per tutte le colonne, così restano allineate.
// Col prezzo sopra o col fondo della colonna ci guadagna o ci perde il prezzo; fra due pannelli quello che uno prende l'altro lascia.
const MIN_PANNELLO = 40, MIN_ULTIMO = 66, MIN_PREZZO = 150;
function altezzePannelli() {
  for (const c of Object.values(G.col)) for (const p of c.pannelli) p.el.style.height = O.altezze[p.id] ? `${O.altezze[p.id]}px` : "";
}
function bordoPannello(c, i) {
  const el = document.createElement("div");
  el.className = "gr-bordo";
  el.title = "Trascina per allargare o restringere · doppio clic: altezza di partenza";
  el.addEventListener("pointerdown", e => {
    e.preventDefault(); el.setPointerCapture(e.pointerId); el.classList.add("attivo");
    const P = c.pannelli, n = P.length, y0 = e.clientY, H = P.map(p => p.el.offsetHeight), prezzo = c.ep.offsetHeight;
    const minimo = k => (k === n - 1 ? MIN_ULTIMO : MIN_PANNELLO);
    const muovi = m => {
      const dy = m.clientY - y0;
      if (i === 0 || i === n) {
        const k = i === 0 ? 0 : n - 1, h = H[k] + (i === 0 ? -dy : dy);
        O.altezze[P[k].id] = Math.round(Math.max(minimo(k), Math.min(h, H[k] + prezzo - MIN_PREZZO)));
      } else {
        const d = Math.max(minimo(i - 1) - H[i - 1], Math.min(dy, H[i] - minimo(i)));
        O.altezze[P[i - 1].id] = Math.round(H[i - 1] + d); O.altezze[P[i].id] = Math.round(H[i] - d);
      }
      altezzePannelli();
    };
    const fine = () => { el.classList.remove("attivo"); el.removeEventListener("pointermove", muovi); el.removeEventListener("pointerup", fine); el.removeEventListener("pointercancel", fine); salvaO(); };
    el.addEventListener("pointermove", muovi); el.addEventListener("pointerup", fine); el.addEventListener("pointercancel", fine);
  });
  el.addEventListener("dblclick", () => { O.altezze = {}; salvaO(); altezzePannelli(); });
  return el;
}

// I pannelli sotto il prezzo (TSI e stocastico di partenza, gli altri dal menu)
function montaPannelli(c) {
  const box = c.el.querySelector(".gr-pannelli");
  togliPannelli(c);
  c.pannelli = [];
  box.innerHTML = "";
  const attivi = Object.keys(PANNELLI).filter(k => O.pannelli[k]);
  c.cp.applyOptions({ timeScale: { visible: !attivi.length } });
  attivi.forEach((id, i) => {
    const el = document.createElement("div");
    el.className = "gr-osc";
    el.innerHTML = `<span class="gr-osc-nome">${PANNELLI[id]}</span>${id === "tsi" || id === "stoc" ? "" : `<button type="button" class="gr-osc-x" data-togli-pannello="${id}" title="Togli il pannello" aria-label="Togli il pannello ${PANNELLI[id]}">✕</button>`}<canvas class="gr-profilo"></canvas>`;
    el.querySelector(".gr-osc-x")?.addEventListener("click", () => {
      const inverti = v => { O.pannelli[id] = v; salvaO(); for (const q of Object.values(G.col)) montaPannelli(q); barra(G.box); };
      inverti(false);
      G.pila.push({ n: D.storia.length, rimetti: () => inverti(true) });
    });
    box.appendChild(bordoPannello(c, i));
    box.appendChild(el);
    if (O.altezze[id]) el.style.height = `${O.altezze[id]}px`;
    const ch = LightweightCharts.createChart(el, opzioni(i === attivi.length - 1));
    const p = { id, el, ch, serie: {} }, linea = (col, w) => ch.addLineSeries({ color: col, lineWidth: w, priceLineVisible: false, lastValueVisible: true });
    // niente numeri automatici sulla scala di TSI e stocastico (si sovrapponevano ai livelli): restano le etichette
    if (id === "tsi" || id === "stoc") ch.priceScale("right").applyOptions({ textColor: "rgba(0,0,0,0)" });
    if (id === "tsi") {
      p.serie.tsi = linea(STILE.tsi, 3); p.serie.ema = linea(STILE.ema, 2);
      p.serie.tsi.createPriceLine({ price: 0, color: "#ffffff", lineWidth: 1, lineStyle: 0, axisLabelVisible: false });
      for (const v of [50, -50]) p.serie.tsi.createPriceLine({ price: v, color: STILE.livello, lineWidth: 1, lineStyle: 1, axisLabelVisible: true });
    } else if (id === "stoc") {
      p.serie.k = linea(STILE.k, 3); p.serie.d = linea(STILE.d, 2);
      for (const v of [20, 80]) p.serie.k.createPriceLine({ price: v, color: "#8a8a8a", lineWidth: 1, lineStyle: 1, axisLabelVisible: true });
    } else if (id === "rsi") {
      p.serie.rsi = linea("#c08cff", 2);
      for (const v of [30, 70]) p.serie.rsi.createPriceLine({ price: v, color: "#8a8a8a", lineWidth: 1, lineStyle: 1, axisLabelVisible: true });
    } else if (id === "macd") {
      p.serie.ist = ch.addHistogramSeries({ priceLineVisible: false, lastValueVisible: false });
      p.serie.linea = linea("#4fc3f7", 2); p.serie.segnale = linea("#ff8a50", 1);
    } else if (id === "atr") p.serie.atr = linea("#7fd36a", 2);
    else p.serie.vol = ch.addHistogramSeries({ priceLineVisible: false, lastValueVisible: true, priceFormat: { type: "volume" } });
    ch.timeScale().subscribeVisibleLogicalRangeChange(r => sincronizza(c, ch, r));
    // l'area dei disegni: la colonna con grafico, riquadro e scala del pannello; il magnete prende le linee di TSI e stocastico
    p.cv = el.querySelector(".gr-profilo");
    p.area = Object.assign(Object.create(c), { ep: el, cp: ch, candele: p.serie.tsi || p.serie.k || p.serie.rsi || p.serie.linea || p.serie.atr || p.serie.vol, pane: id, vista: null,
      valori: j => (id === "tsi" ? [c.s?.tsi?.[j], c.s?.ema?.[j]] : id === "stoc" ? [c.s?.k?.[j], c.s?.d?.[j]] : []) });
    collega(p.area);
    ch.subscribeCrosshairMove(q => mirino(c, ch, q));
    el.addEventListener("pointerenter", () => mirinoSu(c, ch));
    c.pannelli.push(p);
  });
  if (attivi.length) box.appendChild(bordoPannello(c, attivi.length));
  if (c.s) datiPannelli(c);
  const r = c.cp.timeScale().getVisibleLogicalRange();
  if (r) for (const p of c.pannelli) p.ch.timeScale().setVisibleLogicalRange(r);
}

// dove manca il valore resta il tempo senza valore: i pannelli devono avere le stesse candele del prezzo, o scorrono sfasati
const punti = (s, v) => s.t.map((t, i) => (v[i] === null || v[i] === undefined ? { time: t } : { time: t, value: v[i] }));

function datiPannelli(c) {
  const s = c.s;
  for (const { id, serie } of c.pannelli) {
    if (id === "tsi") { serie.tsi.setData(punti(s, s.tsi)); serie.ema.setData(punti(s, s.ema)); }
    else if (id === "stoc") { serie.k.setData(punti(s, s.k)); serie.d.setData(punti(s, s.d)); }
    else if (id === "rsi") serie.rsi.setData(punti(s, rsi(s.rc, 14)));
    else if (id === "macd") {
      const m = macd(s.rc);
      serie.linea.setData(punti(s, m.linea)); serie.segnale.setData(punti(s, m.segnale));
      serie.ist.setData(punti(s, m.ist).map(p => ({ ...p, color: p.value >= 0 ? "rgba(127,211,106,.6)" : "rgba(255,90,80,.6)" })));
    } else if (id === "atr") serie.atr.setData(punti(s, atr(s.rh, s.rl, s.rc, 14)));
    else serie.vol.setData(s.t.map((t, i) => ({ time: t, value: s.v?.[i] ?? 0, color: s.rc[i] >= s.ro[i] ? "rgba(160,190,110,.7)" : "rgba(190,70,70,.7)" })));
  }
}

// Medie e bande sul prezzo: non cambiano la scala, come su TradingView quando sono fuori dalla vista
function datiMedie(c) {
  for (const x of c.medie) c.cp.removeSeries(x.q);
  c.medie = [];
  if (!c.s) return;
  const opz = (col, w) => ({ color: col, lineWidth: w, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false, autoscaleInfoProvider: () => null });
  O.medie.forEach((m, i) => {
    if (m.solo && m.solo !== c.tf) return;
    const col = COL_MEDIE[i % COL_MEDIE.length], v = c.s.rc;
    const linee = m.tipo === "ema" ? [ema(v, m.n)] : m.tipo === "sma" ? [sma(v, m.n)] : Object.values(bollinger(v, m.n));
    const k = `m|${i}`, w = G.scelta?.k === k ? 3.5 : 1.5;
    for (const l of linee) { const q = c.cp.addLineSeries(opz(col, w)); q.setData(punti(c.s, l)); c.medie.push({ q, v: l, k, i, nome: `${{ ema: "EMA", sma: "SMA", boll: "Bollinger" }[m.tipo]} ${m.n}` }); }
  });
}

// ---------- il canvas sopra il grafico: profili, POC, figure, riquadri, disegni ----------
// Il grafico non avvisa quando si muove la scala dei prezzi: si guarda a ogni fotogramma se è cambiato qualcosa
function giro(c) {
  if (c.via) return;
  const r = c.cp.timeScale().getVisibleLogicalRange(), ultimo = c.s?.rc?.at(-1);
  const firma = c.s && r ? `${r.from}|${r.to}|${c.candele.priceToCoordinate(ultimo)}|${c.candele.priceToCoordinate(ultimo * 1.01)}|${c.ep.clientWidth}|${c.ep.clientHeight}|${c.cp.priceScale("right").width()}|${c.pannelli.map(p => `${p.area.candele.priceToCoordinate(0)},${p.area.candele.priceToCoordinate(50)},${p.el.clientWidth}`).join("|")}` : "";
  if (firma !== c.firma || c.sporco) { c.firma = firma; c.sporco = false; dipingiColonna(c); }
  requestAnimationFrame(() => giro(c));
}
const aggiornaTutti = () => { for (const c of Object.values(G.col)) c.sporco = true; };

const profiliDi = () => [...(G.dati?.profili || []), ...(G.manuali[G.sym] || []).filter(Boolean).map(p => ({ ...p, mano: true }))];
const profiloAcceso = (p, tf) => !O.spenti.includes(p.t) && !(p.solo_d1 && tf === "W1");

function dipingiColonna(c) {
  const cv = c.cv, W = c.ep.clientWidth, H = c.ep.clientHeight, dpr = devicePixelRatio || 1;
  if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  const g = cv.getContext("2d");
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, W, H);
  c.colpibili = [];
  if (!c.s) return;
  const larg = W - c.cp.priceScale("right").width();
  g.save(); g.beginPath(); g.rect(0, 0, larg, H); g.clip();
  const accesi = profiliDi().filter(p => profiloAcceso(p, c.tf));
  // sui TF piccoli i perni vecchi si sovrapporrebbero in un blocco unico: di partenza solo l'ultimo, gli altri a richiesta
  const conBarre = SEC[c.tf] >= 86400 ? (O.barre ? accesi : []) : !O.barrePiccoli ? [] : O.barreVecchi ? accesi : [...accesi].sort((a, b) => a.t - b.t).slice(-1);
  for (const p of conBarre) barreProfilo(c, g, p, larg, H);
  const vis = O.visibile ? profiloVisibile(c) : null;
  if (vis) { barreVisibile(c, g, vis, larg); voceVisibile(c, vis, larg); }
  if (O.poc) for (const p of accesi) lineaPoc(c, g, p, larg);
  figure(c, g, larg);
  if (SEC[c.tf] < 86400) riquadroPiano(c, g, larg);   // il piano si guarda sui TF di ingresso, non su D1 e W1
  riquadroTrade(c, g, larg);
  g.restore();
  // i POC sulla scala: le etichette vicine non si coprono
  if (O.poc || vis) {
    const fatte = [];
    if (O.poc) for (const p of accesi) {
      const y = c.candele.priceToCoordinate(p.poc);
      if (y === null || y < 0 || y > H || fatte.some(v => Math.abs(v - y) < 15)) continue;
      fatte.push(y);
      sullaScala(c, g, y, D.formato(p.poc), STILE.poc);
    }
    if (vis) for (const [v, fondo] of [[vis.poc, "#b37400"], [vis.vah, "#555"], [vis.val, "#555"]]) {
      const y = c.candele.priceToCoordinate(v);
      if (y === null || y < 0 || y > H || fatte.some(q => Math.abs(q - y) < 15)) continue;
      fatte.push(y);
      sullaScala(c, g, y, D.formato(v), fondo);
    }
  }
  dipingi(c, g);
  for (const p of c.pannelli) dipingiPannello(p, dpr);
}

function dipingiPannello(p, dpr) {
  const W = p.el.clientWidth, H = p.el.clientHeight, g = p.cv.getContext("2d");
  if (p.cv.width !== Math.round(W * dpr) || p.cv.height !== Math.round(H * dpr)) { p.cv.width = Math.round(W * dpr); p.cv.height = Math.round(H * dpr); }
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, W, H);
  dipingi(p.area, g);
}

// Un profilo come nelle foto di Luigi: dalla candela del perno all'ultima, riquadro grigio, barre verdi e rosse lunghe fino
// al 42 % della strada, che si allungano e accorciano con lo zoom insieme al grafico. Le barre dentro l'area di valore sono
// più piene. Sui TF piccoli il perno è quasi sempre fuori dallo schermo a sinistra: le barre partono dal bordo e non
// superano il 20 % della larghezza; i profili fuori dai prezzi che si vedono non si disegnano
function barreProfilo(c, g, P, larg, H) {
  const ts = c.cp.timeScale(), x0 = xDi(c, P.t), xf = ts.logicalToCoordinate(c.s.t.length + 2);
  if (x0 === null || xf === null || x0 >= xf) return;
  const yHi = c.candele.priceToCoordinate(P.hi), yLo = c.candele.priceToCoordinate(P.lo);
  const piccolo = SEC[c.tf] < 86400;
  if (piccolo && yHi !== null && yLo !== null && (yLo < 0 || yHi > H)) return;
  const inizio = piccolo ? Math.max(x0, 0) : x0, lung = piccolo ? Math.min((xf - x0) * 0.42, larg * 0.2) : (xf - x0) * 0.42;
  const voce = voceProfilo(c, P), scelto = G.scelta?.k === voce.k;
  if (yHi !== null && yLo !== null) { g.fillStyle = STILE.zona; g.fillRect(x0, yHi, xf - x0, yLo - yHi); }
  for (const [p, su, giu] of P.barre) {
    const y1 = c.candele.priceToCoordinate(p + P.passo), y2 = c.candele.priceToCoordinate(p);
    if (y1 === null || y2 === null) continue;
    const h = Math.max(1, y2 - y1 - 0.5), ws = lung * su / 100, wg = lung * giu / 100, m = p + P.passo / 2;
    const dentro = O.va && m >= P.val && m <= P.vah;
    g.fillStyle = dentro ? STILE.barraSuVa : STILE.barraSu; g.fillRect(inizio, y1, ws, h);
    g.fillStyle = dentro ? STILE.barraGiuVa : STILE.barraGiu; g.fillRect(inizio + ws, y1, wg, h);
    voce.barre.push([inizio, y1, ws + wg, h]);
    if (scelto) { g.strokeStyle = "rgba(255,255,255,.55)"; g.lineWidth = 1; g.strokeRect(inizio, y1, ws + wg, h); }
  }
}

// Profilo di volume di quello che si vede (indicatore, utente 30/10): calcolato qui sulle candele nel range visibile con i
// volumi tick, come il server (fasce, POC, area di valore al 70 %), su qualunque TF; si ricalcola quando scorri o zoomi
const FASCE_VIS = 80, AREA_VALORE = 0.7;
function profiloVisibile(c) {
  const s = c.s, r = c.cp.timeScale().getVisibleLogicalRange();
  if (!s?.v || !s.rh || !r) return null;
  const i0 = Math.max(0, Math.floor(r.from)), i1 = Math.min(s.t.length - 1, Math.ceil(r.to));
  if (i1 - i0 < 3) return null;
  const chiave = `${c.tf}|${i0}|${i1}|${s.t.length}|${s.v[i1]}|${s.rc[i1]}`;
  if (c.vis?.chiave === chiave) return c.vis;
  let lo = Infinity, hi = -Infinity;
  for (let i = i0; i <= i1; i++) { if (s.rl[i] < lo) lo = s.rl[i]; if (s.rh[i] > hi) hi = s.rh[i]; }
  const passo = (hi - lo) / FASCE_VIS || 1e-9, tot = new Array(FASCE_VIS).fill(0), su = new Array(FASCE_VIS).fill(0);
  for (let i = i0; i <= i1; i++) {
    const a = Math.min(FASCE_VIS - 1, Math.floor((s.rl[i] - lo) / passo)), b = Math.min(FASCE_VIS - 1, Math.floor((s.rh[i] - lo) / passo));
    const q = (s.v[i] || 0) / (b - a + 1);
    for (let k = a; k <= b; k++) { tot[k] += q; if (s.rc[i] >= s.ro[i]) su[k] += q; }
  }
  const somma = tot.reduce((x, y) => x + y, 0), mx = Math.max(...tot);
  if (!somma) return null;
  const pi = tot.indexOf(mx);
  let a = pi, b = pi, acc = mx;
  while (acc < AREA_VALORE * somma) {
    const sopra = b + 1 < FASCE_VIS ? tot[b + 1] : -1, sotto = a > 0 ? tot[a - 1] : -1;
    if (sopra >= sotto) { b++; acc += tot[b]; } else { a--; acc += tot[a]; }
  }
  return c.vis = { chiave, lo, passo, tot, su, mx, a, b, poc: lo + (pi + 0.5) * passo, vah: lo + (b + 1) * passo, val: lo + a * passo };
}

// barre dal bordo destro verso sinistra, lunghe al massimo il 24 % della larghezza; POC arancione su tutta la larghezza,
// VAH e VAL bianche lungo le barre
function barreVisibile(c, g, V, larg) {
  const lung = larg * 0.24, x0 = larg;
  for (let i = 0; i < FASCE_VIS; i++) {
    const y1 = c.candele.priceToCoordinate(V.lo + (i + 1) * V.passo), y2 = c.candele.priceToCoordinate(V.lo + i * V.passo);
    if (y1 === null || y2 === null) continue;
    const h = Math.max(1, y2 - y1 - 0.5), ws = lung * V.su[i] / V.mx, wg = lung * (V.tot[i] - V.su[i]) / V.mx, dentro = i >= V.a && i <= V.b;
    g.fillStyle = dentro ? STILE.barraSuVa : STILE.barraSu; g.fillRect(x0 - ws, y1, ws, h);
    g.fillStyle = dentro ? STILE.barraGiuVa : STILE.barraGiu; g.fillRect(x0 - ws - wg, y1, wg, h);
  }
  const riga = (prezzo, col, w, tratteggio, da) => {
    const y = c.candele.priceToCoordinate(prezzo);
    if (y === null) return;
    g.strokeStyle = col; g.lineWidth = w; g.setLineDash(tratteggio);
    g.beginPath(); g.moveTo(da, y); g.lineTo(larg, y); g.stroke(); g.setLineDash([]);
  };
  riga(V.vah, STILE.vaVis, 1, [4, 3], x0 - lung); riga(V.val, STILE.vaVis, 1, [4, 3], x0 - lung);
  riga(V.poc, STILE.pocVis, 2, [6, 3], 0);
}

function lineaPoc(c, g, P, larg) {
  const y = c.candele.priceToCoordinate(P.poc), x0 = xDi(c, P.t), xf = c.cp.timeScale().logicalToCoordinate(c.s.t.length + 2);
  if (y === null || xf === null) return;
  const voce = voceProfilo(c, P), a = Math.max(x0 ?? 0, 0), b = Math.min(xf, larg), scelto = G.scelta?.k === voce.k;
  g.strokeStyle = STILE.poc; g.lineWidth = scelto ? 4.5 : 2.5; g.setLineDash(scelto ? [] : [2, 3]);
  g.beginPath(); g.moveTo(a, y); g.lineTo(b, y); g.stroke(); g.setLineDash([]);
  voce.seg.push([a, y, b, y]);
}

// Trendline lunghe (W1, D1), canali e figure (H4, H8, D1) trovate da bradipo/figure.py: proposte da guardare, in arancione
function figure(c, g, larg) {
  const s = c.s;
  const tratto = ([[t0, p0], [t1, p1]], col, w, tratteggio, voce) => {
    const a = xDi(c, t0), b = xDi(c, t1), ya = c.candele.priceToCoordinate(p0), yb = c.candele.priceToCoordinate(p1);
    if (a === null || b === null || ya === null || yb === null) return null;
    const scelto = G.scelta?.k === voce?.k;
    g.strokeStyle = col; g.lineWidth = scelto ? w + 2 : w; g.setLineDash(scelto ? [] : tratteggio || []);
    g.beginPath(); g.moveTo(a, ya); g.lineTo(b, yb); g.stroke(); g.setLineDash([]);
    if (scelto) for (const [x, y] of [[a, ya], [b, yb]]) { g.fillStyle = "#1c1c1c"; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 4.5, 0, 7); g.fill(); g.stroke(); }
    voce?.seg.push([a, ya, b, yb]);
    return [Math.min(b, larg - 4), yb];
  };
  const nome = (q, testo, col) => {
    if (!q) return;
    g.font = "11px IBM Plex Sans, sans-serif";
    const w = g.measureText(testo).width + 8, x = Math.max(2, q[0] - w);
    g.fillStyle = "rgba(30,30,30,.72)"; g.fillRect(x, q[1] - 17, w, 15);
    g.fillStyle = col; g.fillText(testo, x + 4, q[1] - 6);
  };
  // una figura tolta non si disegna più su questo strumento e TF; si rimette dal menu Figure o con Ctrl+Z
  const voce = (nome, t0) => {
    const k = chiaveFigura(c, nome, t0);
    if (O.tolti.includes(k)) return null;
    const v = { k, nome, seg: [], barre: [], togli: () => togliFigura(k) };
    c.colpibili.push(v);
    return v;
  };
  if (O.trend) for (const f of s.trend || []) { const v = voce(f.nome, f.linee[0][0][0]); if (v) nome(tratto(f.linee[0], STILE.trend, 1.75, null, v), f.nome, STILE.trend); }
  if (O.canale && s.canale) {
    const q = k => [s.canale[k][0], s.canale[k].at(-1)], v = voce("canale", s.canale.alta[0][0]);
    if (v) { tratto(q("alta"), STILE.figura, 1.5, null, v); nome(tratto(q("bassa"), STILE.figura, 1.5, null, v), "canale", STILE.figura); }
  }
  if (O.figure) for (const f of s.figure || []) {
    const v = voce(f.nome, f.linee[0][0][0]);
    if (!v) continue;
    const fine = f.linee.map(l => tratto(l, STILE.figura, 1.75, [6, 3], v));
    nome(fine[0], f.nome, STILE.figura);
  }
}

// ---------- scegliere e togliere (utente 31/10): tutto quello che sta sul grafico oltre al layout di base ----------
// Trendline, canali, figure, profili con POC, medie, profilo di quello che vedi: clic per sceglierlo, poi ✕ togli, Canc o il cestino.
// Ctrl+Z lo rimette. I pannelli in più hanno la loro ✕. Restano fuori candele, SAR, segnali, TSI, stocastico e le linee dei trade.
const chiaveFigura = (c, nome, t0) => `${G.sym}|${c.tf}|${nome}|${t0}`;
const togliFigura = k => { O.tolti.push(k); salvaO(); aggiornaTutti(); barra(G.box); return () => { O.tolti = O.tolti.filter(x => x !== k); salvaO(); aggiornaTutti(); barra(G.box); }; };
function voceProfilo(c, P) {
  const k = `p|${P.t}`;
  let v = c.colpibili.find(x => x.k === k);
  if (!v) c.colpibili.push(v = { k, nome: `Profilo ${P.nome || ""} · POC ${D.formato(P.poc)}`, seg: [], barre: [], togli: () => {
    O.spenti = [...O.spenti, P.t]; salvaO(); aggiornaTutti(); barra(G.box);
    return () => { O.spenti = O.spenti.filter(x => x !== P.t); salvaO(); aggiornaTutti(); barra(G.box); };
  } });
  return v;
}
function voceVisibile(c, V, larg) {
  const y = c.candele.priceToCoordinate(V.poc);
  if (y !== null) c.colpibili.push({ k: "vis", nome: "Profilo di quello che vedi", seg: [[0, y, larg, y]], barre: [], togli: () => {
    O.visibile = false; salvaO(); aggiornaTutti(); barra(G.box);
    return () => { O.visibile = true; salvaO(); aggiornaTutti(); barra(G.box); };
  } });
}
function voceMedia(m) {
  return { k: m.k, nome: m.nome, togli: () => {
    const [via] = O.medie.splice(m.i, 1);
    salvaO(); G.scelta = null; medieDaCapo(); barra(G.box);
    return () => { O.medie.splice(m.i, 0, via); salvaO(); medieDaCapo(); barra(G.box); };
  } };
}
const VICINO_X = 6;
function cercaVoce(c, x, y, ancheBarre) {
  if (c.pane || !c.colpibili) return null;
  for (let i = c.colpibili.length - 1; i >= 0; i--) if (c.colpibili[i].seg.some(s => distanza(x, y, s) <= VICINO_X)) return c.colpibili[i];
  const j = Math.round(c.cp.timeScale().coordinateToLogical(x) ?? -1);
  for (const m of c.medie) {
    const v = m.v[j], yy = v === null || v === undefined ? null : m.q.priceToCoordinate(v);
    if (yy !== null && Math.abs(yy - y) <= VICINO_X) return voceMedia(m);
  }
  if (ancheBarre) for (const v of c.colpibili) if (v.barre.some(([a, b, w, h]) => x >= a && x <= a + w && y >= b && y <= b + h)) return v;
  return null;
}
D.sopraAltro = (c, x, y) => cercaVoce(c, x, y, false);
D.suClic = (c, x, y) => {
  if (D.strumento) return;
  const v = cercaVoce(c, x, y, true);
  G.scelta = v ? { ...v, c, x, y } : null;
  medieDaCapo(); aggiornaTutti(); cartellino();
};
function togliElemento() {
  if (togliScelto()) return true;
  if (!G.scelta) return false;
  const rimetti = G.scelta.togli();
  G.pila.push({ n: D.storia.length, rimetti });
  G.scelta = null; cartellino(); aggiornaTutti();
  return true;
}
// Ctrl+Z e ↶: l'ultima cosa fatta, che sia un disegno o un elemento tolto
function torna() {
  if (G.pila.length && G.pila.at(-1).n >= D.storia.length) { G.pila.pop().rimetti(); return; }
  indietro();
}
// il cartellino col nome e ✕ togli, accanto al clic: vale anche per i disegni a mano
function cartellino() {
  document.querySelectorAll(".gr-scelta").forEach(x => x.remove());
  if (D.sel) { G.scelta = null; medieDaCapo(); }
  const dis = D.sel && D.lista.find(x => x.id === D.sel), dove = dis ? D.clic : G.scelta;
  if ((!dis && !G.scelta) || !dove || !dove.c.el?.isConnected) return;
  const NOMI = { trend: "Linea", raggio: "Raggio", oriz: "Orizzontale", vert: "Verticale", canale: "Canale", rett: "Rettangolo", fib: "Fibonacci", matita: "Matita" };
  const el = document.createElement("div");
  el.className = "gr-scelta";
  el.innerHTML = `<span></span><button type="button" title="Togli · Canc">✕ togli</button>`;
  el.querySelector("span").textContent = dis ? NOMI[dis.tipo] || "Disegno" : G.scelta.nome;
  el.querySelector("button").addEventListener("click", togliElemento);
  dove.c.el.appendChild(el);
  const r = dove.c.ep.getBoundingClientRect(), q = dove.c.el.getBoundingClientRect();
  el.style.left = `${Math.max(4, Math.min(q.width - el.offsetWidth - 4, r.left - q.left + dove.x + 10))}px`;
  el.style.top = `${r.top - q.top + (dove.y > 40 ? dove.y - 36 : dove.y + 14)}px`;   // vicino al bordo alto sta sotto il clic, per non coprire i TF
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
  const i = indice({ s, passo: 1 }, t);
  return i < 0 ? -1 : Math.min(Math.floor(i), s.t.length - 1);
}

function marcatori(c) {
  if (!c.s) { c.candele.setMarkers([]); return; }
  const m = !O.segnali ? [] : c.s.segnali.map(x => {
    const su = x.lato === "long";
    return { time: x.t, position: su ? "belowBar" : "aboveBar", color: su ? STILE.long : STILE.short,
             shape: su ? "arrowUp" : "arrowDown", size: 1, text: su ? "B" : "S" };
  });
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
  const sim = G.piano || G.trade ? [] : G.dati?.sim || [], fatte = new Set();   // col piano o un trade aperto solo le loro linee
  for (const p of sim) for (const [v, col] of [[p.prezzo, "#ffffff"], [p.sl, STILE.short], [p.tp, STILE.long]]) {
    if (fatte.has(v)) continue;
    fatte.add(v);
    riga(v, col, 1, 2, "");
  }
  // la scala dei prezzi comprende anche stop e target, altrimenti sull'H1 il target resta fuori dal grafico
  const P = G.piano;
  if (P) {
    riga(P.ingresso, "#ffffff", 2, 0, "");
    riga(P.stop, STILE.short, 2, 0, "");
    riga(P.target, STILE.long, 2, 0, "");
  }
  const T = G.trade, ii = candeleTrade(c);
  const estremi = [...sim, ...(P ? [{ sl: P.stop, tp: P.target }] : []), ...(T && ii ? [{ sl: T.sl0, tp: T.tp }] : [])].flatMap(p => [p.sl, p.tp]).filter(Boolean);
  c.candele.applyOptions({ autoscaleInfoProvider: base => {
    const r = base();
    if (!r || !estremi.length) return r;
    return { ...r, priceRange: { minValue: Math.min(r.priceRange.minValue, ...estremi),
                                 maxValue: Math.max(r.priceRange.maxValue, ...estremi) } };
  } });
  // SAR sempre su tutti gli strumenti (utente 16/10): è dove va lo stop di ogni trade; dal 30/10 si spegne dal menu
  c.sar.setData(!s.sar || !O.sar ? [] : s.t.map((t, i) => ({ time: t, value: s.sar[i] })));
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

function riempi(c) {
  const s = G.dati?.[c.tf];
  if (!s) return;
  const dg = G.dati.digits;
  c.s = s; c.passo = SEC[c.tf];
  // valute a 5 decimali: la scala ne mostra 4 (1.1227 invece di 1.12270), etichette più corte su telefono
  const px = dg === 5 ? 4 : dg;
  c.candele.applyOptions({ priceFormat: { type: "price", precision: px, minMove: Math.pow(10, -px) } });
  c.vista = O.vere ? { o: s.ro, h: s.rh, l: s.rl, c: s.rc } : { o: s.o, h: s.h, l: s.l, c: s.c };
  c.candele.setData(s.t.map((t, i) => ({ time: t, open: c.vista.o[i], high: c.vista.h[i], low: c.vista.l[i], close: c.vista.c[i] })));
  marcatori(c);
  datiPannelli(c);
  datiMedie(c);
  // sfondo Bradipo: verde o rosso dove il TF è d'accordo con quello sopra, vuoto dove è contro
  c.sfondo.setData(!O.sfondo ? [] : (s.bradipo || []).map((b, i) => ({ time: s.t[i], value: b && b[0] && b[1] ? 1 : 0,
    color: b && b[0] > 0 ? "rgba(127,211,106,0.13)" : "rgba(255,90,80,0.13)" })));
  for (const l of c.linee) c.candele.removePriceLine(l);
  c.linee = [];
  posizioni(c, s);
  if (s.prezzo != null) c.linee.push(c.candele.createPriceLine(
    { price: s.prezzo, color: "#ffffff", lineWidth: 2, lineStyle: 2, axisLabelVisible: true, title: "" }));
  c.el.querySelector(".gr-testa b").textContent = G.dati.nome;
  for (const b of c.el.querySelectorAll(".gr-tf button")) {
    b.setAttribute("aria-pressed", b.dataset.tf === c.tf);
    b.disabled = !G.dati?.[b.dataset.tf];
  }
  c.testata({});
  c.cp.priceScale("right").applyOptions({ mode: O.log ? 1 : 0 });
  const ii = c.centra && candeleTrade(c);
  if (ii) {                              // trade dal Registro: il trade in mezzo, con un po' di candele prima e dopo
    const largo = Math.max(30, (ii[1] - ii[0]) * 1.5);
    c.cp.timeScale().setVisibleLogicalRange({ from: ii[0] - largo, to: Math.min(s.t.length + 3, ii[1] + largo) });
    c.centra = c.primo = false;
  } else if (c.primo) {                  // la prima volta le ultime candele; poi resta dove l'hai lasciato
    vistaIniziale(c);
    c.primo = false;
  }
  c.sporco = true;
}

// quante candele si vedono aprendo: W1 e D1 larghi per vedere i profili, come nelle foto di Luigi
function vistaIniziale(c) {
  const n = c.s.t.length, quante = { W1: 340, D1: 420 }[c.tf] || 110;
  c.cp.timeScale().setVisibleLogicalRange({ from: Math.max(0, n - quante), to: n + 3 });
}

// lasciando la pagina: i grafici vanno smontati
export function chiudiGrafici() {
  for (const c of Object.values(G.col)) {
    c.via = true; c.scollega?.();
    togliPannelli(c);
    c.cp.remove();
  }
  G.col = {};
  G.sym = null;
}

// ---------- la griglia: uno o due grafici ----------
function montaGriglia(box) {
  for (const c of Object.values(G.col)) { c.via = true; c.scollega?.(); togliPannelli(c); c.cp.remove(); }
  G.col = {};
  box.querySelector(".gr-griglia")?.remove();
  const gr = document.createElement("div");
  gr.className = "gr-griglia" + (G.due ? " due" : "");
  box.querySelector(".gr-area").appendChild(gr);
  const posti = G.due ? { a: "H8", b: "H1" } : { a: "D1" };
  for (const [posto, base] of Object.entries(posti)) {
    const el = document.createElement("div");
    el.className = "gr-col";
    gr.appendChild(el);
    G.col[posto] = colonna(el, tfDi(`${G.due ? "due" : "uno"}.${posto}`, base), posto);
  }
  for (const c of Object.values(G.col)) { if (!G.dati?.[c.tf]) c.tf = "D1"; riempi(c); }
  adattaAltezza();
}

// il grafico arriva al fondo della finestra, senza scorrere (utente 30/10); a tutto schermo e su telefono ci pensa il CSS
function adattaAltezza() {
  const box = G.box, g = box?.querySelector(".gr-griglia");
  if (!g) return;
  if (document.fullscreenElement === box || innerWidth <= 900) { g.style.height = ""; return; }
  g.style.height = `${Math.max(470, innerHeight - g.getBoundingClientRect().top - scrollY - 14)}px`;
}
addEventListener("resize", adattaAltezza);

function cambiaLayout(box, due) {
  G.due = due;
  try { localStorage.setItem(`bradipo.layout.${box.classList.contains("grande") ? "analisi" : "grafici"}`, due ? "2" : "1"); } catch (e) {}
  montaGriglia(box);
  barra(box);
}

function coppia(a, b) {
  for (const [c, tf] of [[G.col.a, a], [G.col.b, b]]) if (c) cambiaTf(c, tf);
  barra(G.box);
}

// pulsanti in testa al grafico: lo stesso strumento su un altro TF, ricordato in questo browser
function cambiaTf(c, tf) {
  if (tf === c.tf || !G.dati?.[tf]) return;
  c.tf = tf;
  if (G.scelta?.c === c) { G.scelta = null; cartellino(); }
  try { localStorage.setItem(`bradipo.tf.${G.due ? "due" : "uno"}.${c.posto}`, tf); } catch (e) {}
  c.primo = true; c.centra = !!G.trade;
  riempi(c);
  barra(G.box);
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
  G.box = box;
  G.dati = g;
  D.formato = v => v.toFixed(g.digits === 5 ? 5 : g.digits);
  if (G.sym !== sym || !box.querySelector(".gr-griglia")) {
    G.sym = sym;
    caricaDisegni(sym);
    G.scelta = null; G.pila = []; cartellino();
    let due = box.classList.contains("grande");
    try { const v = localStorage.getItem(`bradipo.layout.${due ? "analisi" : "grafici"}`); if (v) due = v === "2"; } catch (e) {}
    G.due = due;
    await caricaManuali(sym);
    montaGriglia(box);
    lato(box);
    box.querySelector(".gr-griglia")?.classList.toggle("due", G.due);
  } else {
    await caricaManuali(sym);
    for (const c of Object.values(G.col)) { if (!g[c.tf]) c.tf = "D1"; riempi(c); }
  }
  tabellaAtr(box, g);
  box.querySelector(".gr-titolo").textContent = `${g.nome} · dati ${server || ""}`;
  barra(box);
}

// ---------- profili ancorati a mano: restano in questo browser, si ricalcolano a ogni giro dal server ----------
const manualiSalvati = sym => { try { return JSON.parse(localStorage.getItem(`bradipo.vp.${sym}`)) || []; } catch (e) { return []; } };
async function caricaManuali(sym) {
  if (!LOCALE) { G.manuali[sym] = []; return; }
  const tt = manualiSalvati(sym);
  G.manuali[sym] = (await Promise.all(tt.map(async t => {
    try { const r = await fetch(`api/profilo?sym=${encodeURIComponent(sym)}&t=${t}`, { cache: "no-store" }); return r.ok ? { ...(await r.json()), t, nome: "a mano" } : null; } catch (e) { return null; }
  }))).filter(Boolean);
}
D.suAncora = async t => {
  const l = manualiSalvati(G.sym);
  if (!l.includes(t)) l.push(t);
  try { localStorage.setItem(`bradipo.vp.${G.sym}`, JSON.stringify(l)); } catch (e) {}
  await caricaManuali(G.sym);
  aggiornaTutti(); barra(G.box);
};

// ---------- le barre: strumenti a sinistra, opzioni in alto ----------
function lato(box) {
  const el = box.querySelector(".gr-lato");
  if (!el) return;
  el.innerHTML = STRUMENTI.map(([id, ic, tit, tasto]) => `<button type="button" data-strumento="${id}" title="${tit}${tasto ? " · " + tasto : ""}" aria-label="${tit}" aria-pressed="false">${ic}</button>`).join("")
    + (LOCALE ? `<button type="button" data-strumento="vp" title="Profilo di volume da una candela: clicca la candela" aria-label="Profilo di volume da una candela" aria-pressed="false">▤</button>` : "")
    + `<span class="gr-lato-sep"></span><button type="button" data-azione="magnete" title="Magnete: i punti si agganciano alle candele" aria-label="Magnete" aria-pressed="${D.magnete}">🧲</button>`
    + `<button type="button" data-azione="indietro" title="Torna indietro · Ctrl+Z" aria-label="Torna indietro">↶</button>`
    + `<button type="button" data-azione="togli" title="Togli quello che hai scelto sul grafico · Canc" aria-label="Togli quello che hai scelto sul grafico">🗑</button>`
    + `<button type="button" data-azione="tutti" title="Togli tutti i disegni dello strumento" aria-label="Togli tutti i disegni">✕</button>`
    + `<span class="gr-lato-sep"></span>` + COLORI.map(col => `<button type="button" class="gr-colore" data-colore="${col}" style="--c:${col}" title="colore" aria-label="colore ${col}"></button>`).join("");
  if (el.dataset.pronta) return;
  el.dataset.pronta = "1";
  el.addEventListener("click", e => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.strumento) scegliStrumento(b.dataset.strumento);
    else if (b.dataset.colore) coloraScelto(b.dataset.colore);
    else if (b.dataset.azione === "magnete") { D.magnete = !D.magnete; statoLato(); }
    else if (b.dataset.azione === "indietro") torna();
    else if (b.dataset.azione === "togli") togliElemento();
    else if (b.dataset.azione === "tutti") togliTutti();
  });
  statoLato();
}
function statoLato() {
  const el = G.box?.querySelector(".gr-lato");
  if (!el) return;
  for (const b of el.querySelectorAll("[data-strumento]")) b.setAttribute("aria-pressed", b.dataset.strumento === D.strumento);
  el.querySelector("[data-azione=magnete]")?.setAttribute("aria-pressed", D.magnete);
  for (const b of el.querySelectorAll(".gr-colore")) b.classList.toggle("scelto", b.dataset.colore === D.colore);
  for (const c of Object.values(G.col)) for (const e of [c.ep, ...c.pannelli.map(p => p.el)]) e.classList.toggle("disegna", !!D.strumento);
}
D.aggiorna = aggiornaTutti;
D.cambiato = () => { statoLato(); cartellino(); };
// il cartellino del righello: quanto, in %, in candele, nel tempo e in ATR del TF
D.misure = (c, a, b) => {
  const dp = b[1] - a[1], pct = 100 * dp / a[1], can = Math.round(indice(c, b[0]) - indice(c, a[0]));
  const sec = Math.abs(b[0] - a[0]), g_ = Math.floor(sec / 86400), h = Math.round((sec % 86400) / 3600);
  const dg = G.dati.digits, ar = G.dati.atr5?.[c.tf]?.v, pip = dg === 5 || dg === 3 ? Math.pow(10, dg - 1) : null;
  return [`${dp >= 0 ? "+" : ""}${dp.toFixed(dg)} (${pct >= 0 ? "+" : ""}${pct.toFixed(2)} %)`, pip ? `${Math.round(dp * pip)} pip` : "", `${Math.abs(can)} candele`,
    g_ ? `${g_}g ${h}h` : `${h}h`, ar ? `${(Math.abs(dp) / ar).toFixed(1)} ATR` : ""].filter(Boolean).join(" · ");
};

const spunta = (id, testo, acceso) => `<label class="gr-voce"><input type="checkbox" data-opz="${id}" ${acceso ? "checked" : ""}> ${testo}</label>`;

function barra(box) {
  const el = box?.querySelector(".gr-barra-top");
  if (!el) return;
  const aperti = [...el.querySelectorAll("details[open]")].map(x => x.dataset.menu);
  const scrive = el.contains(document.activeElement) && document.activeElement.tagName === "INPUT" && document.activeElement.type === "number";
  if (scrive) return;                    // non si ridisegna mentre si scrive il periodo di una media
  const fs = document.fullscreenElement === box, tfA = G.col.a?.tf, tfB = G.col.b?.tf;
  const prof = profiliDi(), s = G.col.a?.s, figs = [...(s?.trend || []), ...(s?.figure || []), ...(s?.canale ? [{ nome: "canale" }] : [])];
  const tolte = O.tolti.filter(k => k.startsWith(`${G.sym}|`));
  el.innerHTML = `<span class="gr-gruppo" role="group" aria-label="Quanti grafici">
      <button type="button" class="filtro" data-layout="1" aria-pressed="${!G.due}">▣ Un grafico</button>
      <button type="button" class="filtro" data-layout="2" aria-pressed="${G.due}">◫ Due</button></span>
    ${G.due ? `<span class="gr-gruppo" role="group" aria-label="Ciclo superiore e sottociclo">${COPPIE.map(([a, b]) => `<button type="button" class="filtro" data-coppia="${a}|${b}" aria-pressed="${tfA === a && tfB === b}">${a} | ${b}</button>`).join("")}</span>` : ""}
    <details class="gr-menu" data-menu="ind"><summary class="filtro">Indicatori</summary><div class="gr-menu-box">
      <h4>Sul grafico</h4>${spunta("sar", "SAR", O.sar)}${spunta("segnali", "Segnali Bradipo (B / S)", O.segnali)}${spunta("visibile", "Profilo di volume di quello che vedi (qualsiasi TF)", O.visibile)}${spunta("sfondo", "Sfondo Bradipo (a favore del TF sopra)", O.sfondo)}${spunta("vere", "Candele vere invece di Heikin Ashi", O.vere)}${spunta("log", "Scala logaritmica", O.log)}
      <h4>Pannelli</h4>${Object.entries(PANNELLI).map(([k, v]) => spunta("p." + k, v, O.pannelli[k])).join("")}
      <h4>Medie e bande</h4>${O.medie.map((m, i) => `<div class="gr-voce"><i class="gr-punto" style="--c:${COL_MEDIE[i % COL_MEDIE.length]}"></i> ${{ ema: "EMA", sma: "SMA", boll: "Bollinger" }[m.tipo]} ${m.n}${m.solo ? ` <small>solo ${m.solo}</small>` : ""} <button type="button" class="gr-x" data-togli-media="${i}" aria-label="togli">✕</button></div>`).join("")}
      <div class="gr-voce gr-nuova"><select data-nuova="tipo" aria-label="tipo"><option value="ema">EMA</option><option value="sma">SMA</option><option value="boll">Bollinger</option></select>
        <input type="number" data-nuova="n" value="50" min="2" max="500" aria-label="periodo"><button type="button" class="filtro" data-aggiungi-media>aggiungi</button></div>
    </div></details>
    <details class="gr-menu" data-menu="prof"><summary class="filtro">Profili</summary><div class="gr-menu-box">
      ${spunta("barre", "Barre su W1 e D1", O.barre)}${spunta("barrePiccoli", "Barre anche su H8, H4, H1, M15, M5 (ultimo perno)", O.barrePiccoli)}${spunta("barreVecchi", "…e anche i perni più vecchi sui TF piccoli", O.barreVecchi)}${spunta("va", "Area di valore più piena (70 % del volume)", O.va)}${spunta("poc", "POC su tutti i TF", O.poc)}
      <p class="muto">Profilo di quello che vedi a schermo: dal menu Indicatori.</p>
      <h4>Da ogni grande perno</h4>${prof.map(p => `<div class="gr-voce"><label><input type="checkbox" data-profilo="${p.t}" ${O.spenti.includes(p.t) ? "" : "checked"}> ${p.nome}${p.solo_d1 ? " <small>solo D1</small>" : ""} <small>POC ${D.formato(p.poc)}</small></label>${p.mano ? ` <button type="button" class="gr-x" data-togli-profilo="${p.t}" aria-label="togli">✕</button>` : ""}</div>`).join("") || `<p class="muto">Nessun profilo.</p>`}
      ${LOCALE ? `<p class="muto">▤ a sinistra: clicca una candela per un profilo da lì.</p>` : ""}
    </div></details>
    <details class="gr-menu" data-menu="fig"><summary class="filtro">Figure</summary><div class="gr-menu-box">
      ${spunta("trend", "Trendline lunghe (W1, D1)", O.trend)}${spunta("canale", "Canali (H4, H8)", O.canale)}${spunta("figure", "Figure (H4, H8, D1)", O.figure)}
      <h4>Su questo TF</h4>${figs.map(f => `<div class="gr-voce">${f.nome}</div>`).join("") || `<p class="muto">Nessuna.</p>`}
      ${tolte.length ? `<h4>Tolte a mano</h4>${tolte.map(k => { const [, tf, nome] = k.split("|"); return `<div class="gr-voce">${nome} <small>${tf}</small> <button type="button" class="gr-x" data-rimetti="${k.replace(/"/g, "&quot;")}" aria-label="rimetti">↺</button></div>`; }).join("")}` : ""}
      <p class="muto">Trovate in automatico, non misurate: sono da guardare. Clic su una linea per sceglierla e toglierla.</p>
    </div></details>
    <button type="button" class="filtro" data-azione="adatta" title="torna alle ultime candele">⟲ Adatta</button>
    <button type="button" class="filtro" data-azione="foto" title="copia l'immagine di tutti i grafici a schermo">📷 Foto</button>
    <button type="button" class="filtro gr-pieno" data-azione="pieno" aria-pressed="${fs}" title="grafico a tutto schermo">${fs ? "✕ Esci" : "⛶ Schermo intero"}</button>`;
  for (const m of aperti) el.querySelector(`details[data-menu=${m}]`)?.setAttribute("open", "");
  adattaAltezza();
  if (el.dataset.pronta) return;
  el.dataset.pronta = "1";
  el.addEventListener("click", e => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.layout) cambiaLayout(box, b.dataset.layout === "2");
    else if (b.dataset.coppia) coppia(...b.dataset.coppia.split("|"));
    else if (b.dataset.azione === "adatta") { for (const c of Object.values(G.col)) if (c.s) { vistaIniziale(c); c.cp.priceScale("right").applyOptions({ autoScale: true }); } }
    else if (b.dataset.azione === "foto") fotoTutti(b);
    else if (b.dataset.azione === "pieno") document.fullscreenElement ? document.exitFullscreen() : box.requestFullscreen?.();
    else if (b.dataset.rimetti) { O.tolti = O.tolti.filter(x => x !== b.dataset.rimetti); salvaO(); aggiornaTutti(); barra(box); }
    else if (b.dataset.togliMedia != null) { O.medie.splice(Number(b.dataset.togliMedia), 1); salvaO(); medieDaCapo(); barra(box); }
    else if (b.dataset.aggiungiMedia != null) {
      const n = Number(el.querySelector("[data-nuova=n]").value), tipo = el.querySelector("[data-nuova=tipo]").value;
      if (n >= 2 && n <= 500) { O.medie.push({ tipo, n }); salvaO(); medieDaCapo(); barra(box); }
    } else if (b.dataset.togliProfilo) {
      const t = Number(b.dataset.togliProfilo);
      try { localStorage.setItem(`bradipo.vp.${G.sym}`, JSON.stringify(manualiSalvati(G.sym).filter(x => x !== t))); } catch (er) {}
      caricaManuali(G.sym).then(() => { aggiornaTutti(); barra(box); });
    }
  });
  el.addEventListener("change", e => {
    const i = e.target;
    if (i.dataset.profilo) {
      const t = Number(i.dataset.profilo);
      O.spenti = i.checked ? O.spenti.filter(x => x !== t) : [...O.spenti, t];
      salvaO(); aggiornaTutti();
      return;
    }
    const k = i.dataset.opz;
    if (!k) return;
    if (k.startsWith("p.")) {
      O.pannelli[k.slice(2)] = i.checked; salvaO();
      for (const c of Object.values(G.col)) montaPannelli(c);
      return;
    }
    O[k] = i.checked; salvaO();
    for (const c of Object.values(G.col)) riempi(c);
    aggiornaTutti();
  });
}
const medieDaCapo = () => { for (const c of Object.values(G.col)) datiMedie(c); };

document.addEventListener("fullscreenchange", () => { if (G.box) { barra(G.box); adattaAltezza(); } });
// un menu si chiude cliccando fuori
document.addEventListener("click", e => {
  if (!e.target.isConnected) return;     // il pulsante era dentro un menu appena ridisegnato: il menu resta aperto
  for (const m of document.querySelectorAll(".gr-menu[open]")) if (!m.contains(e.target)) m.removeAttribute("open");
});

// Foto della colonna (prezzo con profili e disegni, pannelli) negli appunti, da incollare su Telegram;
// se il browser non lo permette la scarica come PNG.
function telaColonna(c) {
  const parti = [c.cp, ...c.pannelli.map(p => p.ch)].map(ch => ch.takeScreenshot());
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
    const sopra = i === 0 ? c.cv : c.pannelli[i - 1].cv;   // profili e disegni
    if (sopra.width) g.drawImage(sopra, 0, y, x.width, x.height);
    y += x.height;
  }
  return tela;
}

async function consegna(tela, nome, bottone) {
  const blob = await new Promise(r => tela.toBlob(r, "image/png")), prima = bottone.textContent;
  try {
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    bottone.textContent = "✓ copiata";
  } catch (e) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `${nome}.png`; a.click();
    bottone.textContent = "✓ scaricata";
  }
  setTimeout(() => { bottone.textContent = prima; }, 1500);
}

const foto = c => consegna(telaColonna(c), `${G.sym}-${c.tf}`, c.el.querySelector(".gr-foto"));

// Pulsante della barra (utente 30/10: "lo screen di tutta la schermata" senza tastiera): i grafici a schermo in una foto
// sola, affiancati come si vedono (uno sopra l'altro sul telefono)
function fotoTutti(bottone) {
  const col = Object.values(G.col).filter(c => c.s);
  if (!col.length) return;
  const tele = col.map(telaColonna);
  const sopra = col.length > 1 && Math.abs(col[0].el.getBoundingClientRect().top - col[1].el.getBoundingClientRect().top) > 10;
  const tela = document.createElement("canvas"), spazio = col.length > 1 ? 4 : 0;
  tela.width = sopra ? Math.max(...tele.map(x => x.width)) : tele.reduce((n, x) => n + x.width, 0) + spazio;
  tela.height = sopra ? tele.reduce((n, x) => n + x.height, 0) + spazio : Math.max(...tele.map(x => x.height));
  const g = tela.getContext("2d");
  g.fillStyle = STILE.sfondo; g.fillRect(0, 0, tela.width, tela.height);
  let p = 0;
  for (const x of tele) {
    g.drawImage(x, sopra ? 0 : p, sopra ? p : 0);
    p += (sopra ? x.height : x.width) + spazio;
  }
  consegna(tela, `${G.sym}-${col.map(c => c.tf).join("-")}`, bottone);
}

// tasti: D e H foto dei due grafici; Esc annulla, Canc toglie il disegno scelto, Ctrl+Z indietro, Alt+lettera lo strumento
document.addEventListener("keydown", e => {
  if (!G.box || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); torna(); return; }
  if (e.altKey) {
    const s = { p: "matita", t: "trend", h: "oriz", v: "vert", c: "canale", r: "rett", f: "fib" }[e.key.toLowerCase()];
    if (s) { e.preventDefault(); scegliStrumento(s); }
    return;
  }
  if (e.ctrlKey || e.metaKey) return;
  if (e.key === "Escape") { const c = !!G.scelta; G.scelta = null; annulla(); if (c) { medieDaCapo(); cartellino(); } }
  else if (e.key === "Delete" || e.key === "Backspace") { if (togliElemento()) e.preventDefault(); }
  else {
    const posto = { d: "a", h: "b" }[e.key.toLowerCase()];     // D = grafico di sinistra, H = di destra
    if (posto && G.col[posto]) foto(G.col[posto]);
  }
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
