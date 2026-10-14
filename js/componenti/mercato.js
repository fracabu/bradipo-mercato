// Pagina Mercato USA: mappa delle azioni (widget ufficiale TradingView), ETF della tabella di Luigi e VIX.
import { computed, onMounted, ref, watch } from "vue";
import { D, fmt, segno, ricorda } from "../dati.js";
import { Pannello, Schede } from "./ui.js";

// Mappa delle azioni USA: il widget si ricrea quando si cambia indice (gratuito da incorporare)
const Mappa = {
  components: { Pannello, Schede },
  setup() {
    const box = ref(null), fonte = ref(ricorda("mappa") || "SPX500");
    const disegna = () => {
      if (!box.value) return;
      const scuro = matchMedia("(prefers-color-scheme: dark)").matches && document.documentElement.dataset.theme !== "light";
      box.value.innerHTML = '<div class="tradingview-widget-container" style="height:100%;width:100%"><div class="tradingview-widget-container__widget" style="height:100%;width:100%"></div></div>';
      const sc = document.createElement("script");
      sc.src = "https://s3.tradingview.com/external-embedding/embed-widget-stock-heatmap.js";
      sc.async = true;
      sc.textContent = JSON.stringify({ exchanges: [], dataSource: fonte.value, grouping: "sector", blockSize: "market_cap_basic",
        blockColor: "change", locale: "it", symbolUrl: "", colorTheme: scuro ? "dark" : "light", hasTopBar: false,
        isDataSetEnabled: false, isZoomEnabled: true, hasSymbolTooltip: true, isMonoSize: false, width: "100%", height: "100%" });
      box.value.firstChild.appendChild(sc);
    };
    onMounted(disegna);
    watch(fonte, f => { ricorda("mappa", f); disegna(); });
    return { box, fonte, INDICI: [{ id: "SPX500", testo: "S&P 500" }, { id: "NASDAQ100", testo: "Nasdaq 100" }, { id: "DJDJI", testo: "Dow" }] };
  },
  template: `<Pannello class="mappa" titolo="Mappa azioni USA" nota="grandezza = capitalizzazione, colore = variazione di oggi · TradingView">
    <Schede :voci="INDICI" v-model="fonte" etichetta="Indice della mappa"/>
    <div class="mappa-box" ref="box"></div></Pannello>`,
};

// ETF: riquadri colorati per variazione (oggi o 5 giorni), SPY RSP MAGS in testa, poi i settori dal più forte al più debole
const ETF_RIF = ["SPY", "RSP", "MAGS"];
const Etf = {
  components: { Pannello, Schede },
  setup() {
    const k = ref(ricorda("etf") || "oggi");
    watch(k, v => ricorda("etf", v));
    const E = computed(() => D.stato?.etf?.etf);
    const riq = computed(() => {
      const lista = E.value || [], pieno = k.value === "oggi" ? 2 : 5;
      const stile = x => { const v = x[k.value], q = Math.round(Math.min(1, Math.abs(v) / pieno) * 45);
        return { background: `color-mix(in srgb, var(--${v >= 0 ? "long" : "short"}) ${q}%, var(--panel))` }; };
      return { rif: ETF_RIF.map(t => lista.find(x => x.t === t)).filter(Boolean).map(x => ({ ...x, stile: stile(x) })),
               set: lista.filter(x => !ETF_RIF.includes(x.t)).sort((a, b) => b[k.value] - a[k.value]).map(x => ({ ...x, stile: stile(x) })) };
    });
    return { k, E, riq, fmt, segno, FINESTRE: [{ id: "oggi", testo: "Oggi" }, { id: "cinque", testo: "5 giorni" }] };
  },
  template: `<Pannello v-if="E" titolo="ETF USA" nota="settori dell'S&P 500, pesi uguali e Mag 7 · Yahoo, ~15 min di ritardo">
    <Schede :voci="FINESTRE" v-model="k" etichetta="Variazione della mappa ETF"/>
    <ul v-for="(gruppo, i) in [riq.rif, riq.set]" :key="i" class="etf-mappa" :class="{ rif: !i }">
      <li v-for="x in gruppo" :key="x.t" class="etf-riq" :style="x.stile" :title="x.nome + ': ' + segno(x[k]) + ' %'">
        <b>{{ x.t }}</b><span>{{ x.nome }}</span><em>{{ segno(x[k]) }} %</em></li></ul>
    <div class="cot-box"><table class="cot etf"><thead><tr><th></th><th class="num">prezzo</th><th class="num">oggi</th><th class="num">5 giorni</th></tr></thead>
      <tbody><tr v-for="x in E" :key="x.t"><th scope="row">{{ x.nome }} <small>{{ x.t }}</small></th>
        <td class="num" :style="{ color: x.oggi >= 0 ? 'var(--long)' : 'var(--short)' }">{{ fmt(x.prezzo, 2) }}</td>
        <td class="num"><span class="pill-pieno" :style="{ '--c': x.oggi >= 0 ? 'var(--long)' : 'var(--short)' }">{{ segno(x.oggi) }} %</span></td>
        <td class="num muto" :style="{ color: x.cinque >= 0 ? 'var(--long)' : 'var(--short)' }">{{ segno(x.cinque) }} %</td></tr></tbody></table></div>
    <p class="muto">Se RSP (tutte le aziende con lo stesso peso) fa peggio di SPY, l'indice lo tirano poche aziende grandi; se MAGS fa meglio di RSP comandano le 7.</p>
  </Pannello>`,
};

// VIX: l'indice della paura sull'S&P 500 (Yahoo ^VIX, ~15 min di ritardo), ultimi 60 giorni con le soglie
const COL_VIX = { calmo: "long", normale: "fermo", tensione: "osserva", paura: "contro" };
const Vix = {
  components: { Pannello },
  setup() {
    const W = 300, H = 60;
    const V = computed(() => D.stato?.vix?.valore != null ? D.stato.vix : null);
    const g = computed(() => {
      const s = V.value.storia || [], lo = Math.min(...s) - 1, hi = Math.max(...s) + 1;
      const y = v => (H - 4 - (v - lo) / (hi - lo) * (H - 8)).toFixed(1);
      return { pt: s.map((v, i) => `${(i / Math.max(1, s.length - 1) * W).toFixed(1)},${y(v)}`).join(" "),
               soglie: [15, 20, 30].filter(v => v > lo && v < hi).map(v => ({ v, y: y(v) })), min: Math.min(...s), max: Math.max(...s) };
    });
    return { V, g, W, H, fmt, segno, COL_VIX };
  },
  template: `<Pannello v-if="V" titolo="VIX" nota="indice della paura sull'S&P 500 · Yahoo, ~15 min di ritardo">
    <div class="vix-riga"><b class="vix-val num" :style="{ color: 'var(--' + COL_VIX[V.fascia] + ')' }">{{ fmt(V.valore, 2) }}</b>
      <span class="num" :style="{ color: V.var_pct > 0 ? 'var(--short)' : 'var(--long)' }">{{ segno(V.var_pct, 1) }} %</span>
      <span>ieri {{ fmt(V.ieri, 2) }} · <b>{{ V.fascia }}</b> · più alto del {{ V.percentile_1a }} % dei giorni dell'ultimo anno</span></div>
    <svg class="vix-grafico" :viewBox="'0 0 ' + W + ' ' + H" preserveAspectRatio="none" role="img" aria-label="VIX ultimi 60 giorni">
      <line v-for="s in g.soglie" :key="s.v" x1="0" :x2="W" :y1="s.y" :y2="s.y" class="soglia"><title>{{ s.v }}</title></line>
      <polyline :points="g.pt" fill="none" :stroke="'var(--' + COL_VIX[V.fascia] + ')'" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>
    <p class="muto">Ultimi 60 giorni: minimo {{ fmt(g.min, 2) }}, massimo {{ fmt(g.max, 2) }}. Sotto 15 calmo, 15-20 normale, 20-30 tensione, sopra 30 paura.
      Il VIX sale quando l'S&P scende: un VIX che sale con gli indici long è un segnale di cautela.</p></Pannello>`,
};

export const Mercato = {
  components: { Mappa, Etf, Vix },
  template: `<Mappa/><div class="quadro"><Vix/><Etf/></div>`,
};
