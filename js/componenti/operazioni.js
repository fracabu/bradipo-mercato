// Pagina Operazioni: il conto simulato sui prezzi di Pure come una piattaforma di trading (utente 19/10), con le posizioni
// aperte in diretta (prezzo, stop che va in trailing, target, lotti, euro) e quelle chiuse.
// In locale si aggiorna ogni 2 secondi da api/operazioni; online legge il conto pubblicato a ogni giro.
import { reactive, ref, computed, watch, onMounted, onUnmounted, onBeforeUnmount } from "vue";
import { D, LOCALE, fmt, segno, nome, quando, ricorda } from "../dati.js";
import { Pannello } from "./ui.js";

const V = reactive({ conto: null, errore: null });

async function aggiorna() {
  if (!LOCALE) return;
  try {
    const r = await fetch("api/operazioni", { cache: "no-store" });
    if (!r.ok) throw new Error(r.status);
    Object.assign(V, await r.json(), { errore: null });
  } catch (e) { V.errore = "server dell'app non raggiungibile"; }
}

const euro = v => v == null ? "–" : `${segno(v)} €`;
const tinta = v => v == null ? "var(--muted)" : v >= 0 ? "var(--long)" : "var(--short)";
const ora = t => new Date(t * 1000).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

// Grafico H1 della posizione scelta (Lightweight Charts, stile dei grafici di Luigi): candele Heikin Ashi, puntini del SAR
// H1, lo stop a gradini dietro al SAR dall'ingresso, ingresso, target e prezzo di adesso che si muove ogni 2 secondi.
// Le candele si ricaricano a ogni giro; i tempi sono tutti in ora del broker, come nella pagina Grafici.
const LWC = window.LightweightCharts;
const COL = { sfondo: "#3d3d3d", testo: "#cfcfcf", su: "#efefef", giu: "#141414", sar: "#ffd60a", stop: "#ff5a50", target: "#7fd36a" };

const GraficoPosizione = {
  props: { p: Object },
  setup(props) {
    const box = ref(null), boxTsi = ref(null), boxStoc = ref(null), vera = ref("");
    let ch, ct, cs, candele, sar, stop, tsi, ema, k, d, linee = {}, s = null, timer;
    const ultimo = () => props.p;
    const gradini = () => {           // lo stop in vigore su ogni candela H1 dall'ingresso, più la candela di adesso
      if (!s) return [];
      const p = ultimo(), st = p.storia || [[p.t, p.sl0]];
      const out = [];
      for (const t of s.t) {
        if (t + 3600 <= p.t) continue;
        let v = p.sl0;
        for (const [ts, x] of st) if (ts < t + 3600) v = x;
        out.push({ time: t, value: v });
      }
      if (out.length) out[out.length - 1].value = p.sl;       // l'ultimo gradino è lo stop di adesso
      return out;
    };
    // sulla scala solo il prezzo colorato, senza scritte; stop e stop iniziale senza linea piena (c'è quella a gradini)
    const linea = (k, prezzo, colore, larg, stile, tutta = true) => {
      if (prezzo == null) return;
      if (linee[k]) linee[k].applyOptions({ price: prezzo });
      else linee[k] = candele.createPriceLine({ price: prezzo, color: colore, lineWidth: larg, lineStyle: stile, lineVisible: tutta,
                                                axisLabelVisible: true, title: "" });
    };
    // i prezzi veri di Pure della candela sotto il mouse (le candele disegnate sono Heikin Ashi); senza mouse l'ultima
    const scrivi = t => {
      if (!s?.rc) { vera.value = ""; return; }
      const i = t ? s.t.indexOf(t) : s.t.length - 1, dg = ultimo().dg, f = v => fmt(v, dg);
      if (i < 0) return;
      const d = new Date(s.t[i] * 1000), z = n => String(n).padStart(2, "0");
      vera.value = `${z(d.getUTCDate())}/${z(d.getUTCMonth() + 1)} ${z(d.getUTCHours())}:00 · candela vera: apre ${f(s.ro[i])} · max ${f(s.rh[i])} · min ${f(s.rl[i])} · chiude ${f(s.rc[i])}`
        + (s.sar?.[i] != null ? ` · SAR ${f(s.sar[i])}` : "");
    };
    const vivo = () => {              // ogni 2 s: prezzo di adesso e stop
      if (!ch || !s) return;
      const p = ultimo();
      linea("ora", p.ora, "#ffffff", 1, 2);
      linea("sl", p.sl, COL.stop, 2, 0, false);
      stop.setData(gradini());
    };
    const carica = async () => {
      const p = ultimo();
      try {
        const r = await fetch(LOCALE ? `api/grafico?sym=${encodeURIComponent(p.sym)}` : `dati/grafici/${encodeURIComponent(p.sym)}.json`, { cache: "no-store" });
        if (!r.ok) return;
        s = (await r.json()).H1;
      } catch (e) { return; }
      if (!s || !ch) return;
      const px = p.dg === 5 ? 4 : p.dg, punti = key => s.t.map((t, i) => ({ time: t, value: s[key][i] })).filter(x => x.value != null);
      candele.applyOptions({ priceFormat: { type: "price", precision: px, minMove: Math.pow(10, -px) } });
      candele.setData(s.t.map((t, i) => ({ time: t, open: s.o[i], high: s.h[i], low: s.l[i], close: s.c[i] })));
      sar.setData(s.sar ? s.t.map((t, i) => ({ time: t, value: s.sar[i] })) : []);
      tsi.setData(punti("tsi")); ema.setData(punti("ema")); k.setData(punti("k")); d.setData(punti("d"));
      let j = -1;
      for (let i = 0; i < s.t.length && s.t[i] <= p.t; i++) j = i;
      candele.setMarkers(j < 0 ? [] : [{ time: s.t[j], position: p.lato === "long" ? "belowBar" : "aboveBar",
        color: p.lato === "long" ? COL.target : COL.stop, shape: p.lato === "long" ? "arrowUp" : "arrowDown" }]);
      linea("in", p.prezzo, "#bdbdbd", 1, 0);
      linea("tp", p.tp, COL.target, 2, 0);
      linea("sl0", p.sl0 !== p.sl ? p.sl0 : null, "rgba(255,90,80,.45)", 1, 2, false);
      const vede = Math.max(0, Math.min(j - 15, s.t.length - 60));
      ch.timeScale().setVisibleLogicalRange({ from: vede, to: s.t.length + 3 });
      scrivi();
      vivo();
    };
    const opzioni = asse => ({
      autoSize: true,
      layout: { attributionLogo: false, background: { type: "solid", color: COL.sfondo }, textColor: COL.testo, fontFamily: "IBM Plex Mono, monospace", fontSize: 11 },
      grid: { vertLines: { visible: false }, horzLines: { visible: false } },
      rightPriceScale: { borderColor: "#555", minimumWidth: 74 },
      timeScale: { visible: asse, borderColor: "#555", timeVisible: true, secondsVisible: false, rightOffset: 4 },
      crosshair: { mode: 0 },
    });
    const riga = { priceLineVisible: false, crosshairMarkerVisible: false };
    onMounted(() => {
      if (!LWC || !box.value) return;
      ch = LWC.createChart(box.value, opzioni(false));
      ct = LWC.createChart(boxTsi.value, opzioni(false));
      cs = LWC.createChart(boxStoc.value, opzioni(true));
      candele = ch.addCandlestickSeries({ upColor: COL.su, downColor: COL.giu, borderUpColor: "#9a9a9a", borderDownColor: "#000",
        wickUpColor: "#bdbdbd", wickDownColor: COL.giu, priceLineVisible: false, lastValueVisible: false,
        // la scala comprende sempre stop iniziale e target
        autoscaleInfoProvider: base => { const r = base(), p = ultimo(); if (!r) return r;
          const v = [p.sl0, p.sl, p.tp].filter(x => x != null);
          return { ...r, priceRange: { minValue: Math.min(r.priceRange.minValue, ...v), maxValue: Math.max(r.priceRange.maxValue, ...v) } }; } });
      sar = ch.addLineSeries({ ...riga, color: COL.sar, lineVisible: false, pointMarkersVisible: true, pointMarkersRadius: 2, lastValueVisible: false });
      stop = ch.addLineSeries({ ...riga, color: COL.stop, lineWidth: 3, lineType: 1, lastValueVisible: false });
      // oscillatori come nella pagina Grafici: TSI 8,3 con media 5 e livelli ±50, stocastico 8,5,3 con 20/80
      for (const c of [ct, cs]) c.priceScale("right").applyOptions({ textColor: "rgba(0,0,0,0)" });
      tsi = ct.addLineSeries({ ...riga, color: "#e8231f", lineWidth: 3 });
      ema = ct.addLineSeries({ ...riga, color: "#ffffff", lineWidth: 2 });
      tsi.createPriceLine({ price: 0, color: "#ffffff", lineWidth: 1, lineStyle: 0, axisLabelVisible: false });
      for (const v of [50, -50]) tsi.createPriceLine({ price: v, color: "#c9a227", lineWidth: 1, lineStyle: 1, axisLabelVisible: true });
      k = cs.addLineSeries({ ...riga, color: "#2f8a1c", lineWidth: 3 });
      d = cs.addLineSeries({ ...riga, color: "#ffffff", lineWidth: 2 });
      for (const v of [20, 80]) k.createPriceLine({ price: v, color: "#8a8a8a", lineWidth: 1, lineStyle: 1, axisLabelVisible: true });
      // i tre riquadri scorrono e zoomano insieme
      let sync = false;
      for (const c of [ch, ct, cs]) c.timeScale().subscribeVisibleLogicalRangeChange(r => {
        if (!r || sync) return;
        sync = true;
        for (const o of [ch, ct, cs]) if (o !== c) o.timeScale().setVisibleLogicalRange(r);
        sync = false;
      });
      for (const c of [ch, ct, cs]) c.subscribeCrosshairMove(x => scrivi(x.time));
      carica();
      timer = setInterval(carica, 60000);
    });
    watch(() => [props.p.ora, props.p.sl], vivo);
    onBeforeUnmount(() => { clearInterval(timer); for (const c of [ch, ct, cs]) c?.remove(); ch = null; });
    return { box, boxTsi, boxStoc, vera };
  },
  template: `<div class="op-grafici" role="img" :aria-label="'grafico H1 di ' + p.sym + ' con stop, SAR, target, TSI e stocastico'">
    <p class="muto num op-vera">{{ vera }}</p>
    <div class="op-grafico" ref="box"></div><div class="op-osc" ref="boxTsi"></div><div class="op-osc" ref="boxStoc"></div></div>`,
};

// Una posizione aperta: euro di adesso e la barra dallo stop iniziale al target, con stop, ingresso e prezzo di adesso
const Posizione = {
  props: { p: Object, scarto: Number },
  setup(props) {
    const pos = v => {
      const { sl0, prezzo } = props.p, tp = props.p.tp ?? prezzo + 2 * (prezzo - sl0);   // senza target: scala a 2 volte lo stop
      const x = (v - sl0) / (tp - sl0);
      return `${Math.min(100, Math.max(0, x * 100)).toFixed(1)}%`;
    };
    const r = computed(() => {
      const p = props.p, rischio = Math.abs(p.prezzo - p.sl0);
      return p.ora == null || !rischio ? null : (p.lato === "long" ? 1 : -1) * (p.ora - p.prezzo) / rischio;
    });
    const trailing = computed(() => props.p.sl !== props.p.sl0);
    return { pos, r, trailing, fmt, euro, tinta, nome, ora };
  },
  template: `<article class="op-card" :style="{ '--c': 'var(--' + p.lato + ')' }">
    <header><b>{{ nome(p.sym) }}</b> <span class="lato">{{ p.lato === "long" ? "▲ long" : "▼ short" }}</span>
      <span class="muto num">{{ fmt(p.lotti, 2) }} lotti</span>
      <span class="op-euro num" :style="{ color: tinta(p.euro) }">{{ euro(p.euro) }}</span></header>
    <div class="op-barra" role="img" :aria-label="'prezzo ' + fmt(p.ora, p.dg) + ' fra stop ' + fmt(p.sl, p.dg) + ' e target ' + fmt(p.tp, p.dg)">
      <i class="stop" :style="{ left: pos(p.sl) }"></i><i class="in" :style="{ left: pos(p.prezzo) }"></i>
      <i v-if="p.ora != null" class="ora" :style="{ left: pos(p.ora) }"></i></div>
    <dl class="op-dati">
      <div><dt>stop {{ trailing ? "in trailing" : "iniziale" }}</dt><dd class="num">{{ fmt(p.sl, p.dg) }} <small :style="{ color: tinta(p.euro_stop) }">{{ euro(p.euro_stop) }}</small></dd></div>
      <div><dt>ingresso</dt><dd class="num">{{ fmt(p.prezzo, p.dg) }} <small class="muto">{{ ora(p.t - (scarto || 0)) }}</small></dd></div>
      <div><dt>adesso</dt><dd class="num">{{ fmt(p.ora, p.dg) }} <small class="muto">{{ r == null ? "" : (r >= 0 ? "+" : "") + fmt(r, 2) + " R" }}</small></dd></div>
      <div><dt>target</dt><dd class="num">{{ fmt(p.tp, p.dg) }} <small :style="{ color: tinta(p.euro_target) }">{{ euro(p.euro_target) }}</small></dd></div>
    </dl>
    <p class="muto op-nota">stop iniziale {{ fmt(p.sl0, p.dg) }}{{ p.tipo_sl ? " (" + p.tipo_sl + ")" : "" }} · {{ p.segnale === "demo" ? "copiata dal demo" : p.segnale === "rientro" ? "rientro H1" : "cambio H1" }}</p>
  </article>`,
};

// Conti veri (utente 20/10): solo nella pagina sul PC, dove c'è il server; online il pannello non esiste.
// Blocca / Riapri le aperture nuove, Chiudi tutto con un secondo clic di conferma. Carta o vero si cambia solo nel file.
const CV = reactive({ conti: [], esito: "", conferma: null, invio: false });
async function caricaConti() {
  if (!LOCALE) return;
  try { const r = await fetch("api/conti", { cache: "no-store" }); if (r.ok) CV.conti = (await r.json()).conti; } catch (e) {}
}
async function comanda(nome, cosa) {
  CV.invio = true; CV.conferma = null;
  try {
    const r = await fetch("api/conti", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nome, cosa }) });
    const j = await r.json();
    CV.esito = j.esito || j.errore || "";
    if (j.conti) CV.conti = j.conti;
  } catch (e) { CV.esito = "server dell'app non raggiungibile"; }
  CV.invio = false;
}

const ContiVeri = {
  components: { Pannello },
  setup() {
    let timer;
    onMounted(() => { caricaConti(); timer = setInterval(caricaConti, 5000); });
    onUnmounted(() => clearInterval(timer));
    // saldo ed equity dal vivo (utente 20/10: "vedere lì il mio saldo e tutto il mio conto")
    const aperto = k => k.posizioni.reduce((s, p) => s + (p.euro || 0), 0);
    return { CV, comanda, fmt, euro, tinta, nome, aperto };
  },
  template: `<Pannello v-if="CV.conti.length" titolo="Conti veri" nota="solo su questo PC · carta o vero si cambia in credentials/conti.json">
    <div v-for="k in CV.conti" :key="k.nome" class="cv-conto">
      <p class="cv-testa"><b>{{ k.nome }}</b>
        <span class="pill" :style="{ '--c': k.modalita === 'vero' ? 'var(--short)' : 'var(--muted)' }">{{ k.modalita === "vero" ? "vero · ordini veri" : k.modalita + " · nessun ordine" }}</span>
        <span :style="{ color: k.acceso ? 'var(--long)' : 'var(--short)' }">● bot {{ k.acceso ? "acceso" : "spento" }}</span>
        <span>aperture <b>{{ k.bloccato ? "bloccate" : "attive" }}</b></span><span v-if="k.chiusura"> · chiusura in corso</span></p>
      <p v-if="k.conto?.fermo" class="cv-avviso">⛔ fermo: {{ k.conto.fermo }}</p>
      <p v-else-if="k.conto && !k.conto.algo && k.modalita === 'vero'" class="cv-avviso">⛔ Algo Trading spento in MT5</p>
      <dl v-if="k.conto" class="op-dati cv-saldo">
        <div><dt>saldo</dt><dd class="num">{{ fmt(k.conto.saldo, 2) }} {{ k.conto.valuta }}</dd></div>
        <div><dt>equity</dt><dd class="num">{{ fmt(k.conto.equity, 2) }} {{ k.conto.valuta }}</dd></div>
        <div><dt>{{ k.modalita === "vero" ? "aperto" : "aperto (farei)" }}</dt>
          <dd class="num" :style="{ color: tinta(aperto(k)) }">{{ euro(aperto(k)) }}</dd></div>
        <div><dt>margine</dt><dd class="num">{{ fmt(k.conto.margine, 2) }}</dd></div>
        <div><dt>conto</dt><dd class="num">{{ k.conto.login }} <small class="muto">{{ k.conto.server }}</small></dd></div>
      </dl>
      <p v-if="!k.posizioni.length" class="muto">Nessuna posizione.</p>
      <ul v-else class="cv-pos"><li v-for="p in k.posizioni" :key="p.sym"><b>{{ nome(p.sym) }}</b>
        <span :style="{ color: 'var(--' + p.lato + ')' }">{{ p.lato }}</span> {{ fmt(p.lotti, 2) }} lotti a {{ p.prezzo }} ·
        ora {{ p.ora ?? "–" }} · stop {{ p.sl }} · target {{ p.tp || "—" }} ·
        <b class="num" :style="{ color: tinta(p.euro) }">{{ euro(p.euro) }}</b></li></ul>
      <div class="cv-tasti">
        <button class="filtro" type="button" :disabled="CV.invio" @click="comanda(k.nome, k.bloccato ? 'riapri' : 'blocca')">
          {{ k.bloccato ? "▶ Riapri le aperture" : "⏸ Blocca le aperture" }}</button>
        <button v-if="CV.conferma !== k.nome" class="filtro cv-rosso" type="button" :disabled="CV.invio" @click="CV.conferma = k.nome">🛑 Chiudi tutto</button>
        <template v-else>
          <button class="filtro cv-rosso" type="button" @click="comanda(k.nome, 'chiudi')">Sì, chiudi tutte le posizioni</button>
          <button class="filtro" type="button" @click="CV.conferma = null">Annulla</button>
        </template>
      </div>
    </div>
    <p v-if="CV.esito" class="muto" role="status">{{ CV.esito }}</p>
  </Pannello>`,
};

export const Operazioni = {
  components: { Pannello, Posizione, GraficoPosizione, ContiVeri },
  setup() {
    let timer;
    onMounted(() => { aggiorna(); timer = setInterval(aggiorna, 2000); });
    onUnmounted(() => clearInterval(timer));
    const c = computed(() => V.conto || D.stato?.simulati?.conto || null);
    // la posizione nel grafico: l'ultima scelta se è ancora aperta, altrimenti la prima
    const voluta = ref(ricorda("operazione"));
    const scelta = computed(() => { const a = c.value?.aperte || []; return a.find(p => p.sym === voluta.value) || a[0] || null; });
    const scegli = sym => { voluta.value = sym; ricorda("operazione", sym); };
    const vinte = computed(() => (c.value?.chiuse || []).filter(x => (x.euro ?? x.r) > 0).length);
    return { V, c, vinte, scelta, scegli, fmt, segno, euro, tinta, nome, ora, quando, LOCALE };
  },
  template: `<div class="operazioni">
    <Pannello titolo="Conto simulato" :nota="'prezzi di Pure · ' + (LOCALE ? 'in diretta ogni 2 s' : 'aggiornato a ogni giro')">
      <p v-if="!c" class="muto">{{ V.errore || "Il conto si prepara al primo giro del server." }}</p>
      <template v-else>
        <div class="op-conto">
          <div><span>capitale</span><b class="num">{{ fmt(c.capitale, 2) }} €</b></div>
          <div><span>saldo</span><b class="num">{{ fmt(c.saldo, 2) }} €</b></div>
          <div><span>in corso</span><b class="num" :style="{ color: tinta(c.flottante) }">{{ euro(c.flottante) }}</b></div>
          <div><span>equity</span><b class="num">{{ fmt(c.equity, 2) }} €</b></div>
          <div><span>chiusi</span><b class="num" :style="{ color: tinta(c.realizzato) }">{{ euro(c.realizzato) }}</b></div>
        </div>
        <p class="muto op-nota"><template v-if="c.lotto_fisso">{{ fmt(c.lotto_fisso, 2) }} lotti su ogni trade.</template>
          <template v-else>Lotti calcolati perché lo stop iniziale costi il {{ fmt(c.rischio * 100, 1) }} % del saldo.</template>
          Stop sul SAR H1 0,13/0,13 se è già girato, altrimenti sulle 7 candele H1; poi segue il SAR H1 quando il SAR ha superato il prezzo d'ingresso (lo stop non si allarga mai). Target ATR(5) H8.
          <span v-if="c.aggiornato"> Aggiornato {{ new Date(c.aggiornato * 1000).toLocaleTimeString("it-IT") }}.</span></p>
      </template>
    </Pannello>
    <ContiVeri v-if="LOCALE"/>
    <Pannello v-if="c" titolo="Posizioni aperte" :nota="c.aperte.length ? c.aperte.length + ' in corso' : ''">
      <p v-if="!c.aperte.length" class="muto">Nessuna posizione aperta: si entra al prossimo segnale H1 a favore del D1.</p>
      <template v-if="scelta">
        <h4 class="op-titolo-grafico">{{ nome(scelta.sym) }} H1 <small class="muto">puntini gialli = SAR 0,13/0,13 · rosso a gradini = lo stop che lo segue · sotto TSI e stocastico · tocca una scheda per cambiare</small></h4>
        <GraficoPosizione :key="scelta.sym + scelta.t" :p="scelta"/>
      </template>
      <div class="op-griglia"><Posizione v-for="p in c.aperte" :key="p.sym + p.t" :p="p" :scarto="c.scarto"
        role="button" tabindex="0" :aria-pressed="p === scelta" @click="scegli(p.sym)" @keydown.enter.space.prevent="scegli(p.sym)"/></div>
    </Pannello>
    <Pannello v-if="c" titolo="Chiuse" :nota="c.chiuse.length ? vinte + ' vinte su ' + c.chiuse.length : ''">
      <p v-if="!c.chiuse.length" class="muto">Ancora nessuna operazione chiusa.</p>
      <div v-else class="scorre"><table class="cot carte"><thead><tr><th>strumento</th><th class="num">chiusa</th>
        <th class="num">ingresso</th><th class="num">uscita</th><th class="num">R</th><th class="num">euro</th><th class="num">lotti</th><th>come</th></tr></thead>
        <tbody><tr v-for="x in c.chiuse.slice(0, 60)" :key="x.sym + x.t"><th scope="row" class="testa">{{ nome(x.sym) }}
          <span :style="{ color: 'var(--' + x.lato + ')' }">{{ x.lato }}</span></th><td class="num" data-l="chiusa">{{ ora(x.t_uscita - (c.scarto || 0)) }}</td>
          <td class="num" data-l="ingresso">{{ fmt(x.prezzo, x.dg) }}</td><td class="num" data-l="uscita">{{ fmt(x.uscita, x.dg) }}</td>
          <td class="num" data-l="R" :style="{ color: tinta(x.r) }">{{ segno(x.r) }}</td>
          <td class="num" data-l="euro" :style="{ color: tinta(x.euro) }">{{ euro(x.euro) }}</td>
          <td class="num" data-l="lotti">{{ fmt(x.lotti, 2) }}</td><td class="a-capo" data-l="come">{{ x.motivo }}</td></tr></tbody></table></div>
    </Pannello>
  </div>`,
};
