// Pagina Registro: segnali e svolte degli ultimi giri, i trade del conto simulato (filtri, CSV, equity line) e le serie simulate.
import { computed, reactive, ref, watch, onMounted, onBeforeUnmount } from "vue";
import { D, fmt, segno, nome, quando, ricorda } from "../dati.js";
import { Pannello } from "./ui.js";
import { href, vai } from "../rotta.js";

const breve = t => { const d = new Date(t);
  return d.toDateString() === new Date().toDateString() ? d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" }); };

const Cronologia = {
  components: { Pannello },
  setup: () => ({ D, breve, nome }),
  template: `<Pannello titolo="Registro" nota="segnali e svolte, ultimi giri">
    <ol class="cronologia lunga">
      <li v-if="!D.eventi.length" class="vuota">Ancora nessun segnale o svolta registrati.</li>
      <li v-for="e in D.eventi" :key="e.ts + e.sym + e.testo" :style="{ '--c': e.a === 'long' ? 'var(--long)' : e.a === 'short' ? 'var(--short)' : 'var(--ink)' }">
        <span class="quando">{{ breve(e.ts) }}</span><span class="sym">{{ nome(e.sym) }}</span><span>{{ e.testo }}</span></li></ol></Pannello>`,
};

// Equity line del conto simulato (Lightweight Charts): sopra la base verde, sotto rossa. Base = capitale in euro, 0 in R
const LWC = window.LightweightCharts;
const Equity = {
  props: { punti: Array, base: Number },
  setup(p) {
    const box = ref(null);
    let ch, serie, riga;
    const disegna = () => {
      if (!ch) return;
      serie.applyOptions({ baseValue: { type: "price", price: p.base } });
      if (riga) serie.removePriceLine(riga);
      riga = serie.createPriceLine({ price: p.base, color: "#8a8a8a", lineWidth: 1, lineStyle: 2, axisLabelVisible: false, title: "" });
      serie.setData(p.punti);
      ch.timeScale().fitContent();
    };
    onMounted(() => {
      if (!LWC || !box.value) return;
      ch = LWC.createChart(box.value, { autoSize: true,
        layout: { attributionLogo: false, background: { type: "solid", color: "#3d3d3d" }, textColor: "#cfcfcf", fontFamily: "IBM Plex Mono, monospace", fontSize: 11 },
        grid: { vertLines: { visible: false }, horzLines: { color: "#4a4a4a" } },
        rightPriceScale: { borderColor: "#555" }, timeScale: { borderColor: "#555", timeVisible: true, secondsVisible: false } });
      serie = ch.addBaselineSeries({ lineWidth: 2, priceLineVisible: false,
        topLineColor: "#7fd36a", topFillColor1: "rgba(127,211,106,0.28)", topFillColor2: "rgba(127,211,106,0.03)",
        bottomLineColor: "#ff5a50", bottomFillColor1: "rgba(255,90,80,0.03)", bottomFillColor2: "rgba(255,90,80,0.28)" });
      disegna();
    });
    watch(() => [p.punti, p.base], disegna);
    onBeforeUnmount(() => { ch?.remove(); ch = null; });
    return { box };
  },
  template: `<div class="reg-equity" ref="box" role="img" aria-label="Equity line del conto simulato"></div>`,
};

// I trade del conto simulato (serie SIM_CONTO_SERIE, euro netti di swap e commissioni) uno per riga, con filtri, ordine per risultato, CSV ed equity line (utente 22/10).
// Un clic sulla riga apre la storia del trade sul grafico. Filtri e ordine restano in questo browser.
const ORDINI = { recenti: "più recenti", migliori: "vinte in alto", peggiori: "perse in alto" };
const Operazioni = {
  components: { Pannello, Equity },
  setup() {
    const conto = computed(() => D.stato?.simulati?.conto || null);
    const ms = t => (t - (conto.value?.scarto || 0)) * 1000;          // tempi in ora del broker -> ora italiana
    const F = reactive({ sym: "", lato: "", esito: "", ordine: "recenti", unita: "euro" });
    try { Object.assign(F, JSON.parse(ricorda("registro.filtri") || "{}")); } catch (e) {}
    watch(F, v => ricorda("registro.filtri", JSON.stringify(v)));
    const tutti = computed(() => [...(conto.value?.aperte || []).map(p => ({ ...p, aperto: true })), ...(conto.value?.chiuse || [])]);
    const strumenti = computed(() => [...new Set(tutti.value.map(p => p.sym))].sort((a, b) => nome(a).localeCompare(nome(b))));
    const ris = p => p.euro ?? 0;
    const righe = computed(() => {
      const v = tutti.value.filter(p => (!F.sym || p.sym === F.sym) && (!F.lato || p.lato === F.lato)
        && (!F.esito || (F.esito === "aperte" ? p.aperto : !p.aperto && (F.esito === "vinte" ? ris(p) > 0 : ris(p) <= 0))));
      const fine = p => p.aperto ? 9e12 : p.t_uscita;                    // fra le recenti le aperte stanno in cima
      return v.sort(F.ordine === "migliori" ? (a, b) => (!!a.aperto - !!b.aperto) || ris(b) - ris(a)
                  : F.ordine === "peggiori" ? (a, b) => (!!a.aperto - !!b.aperto) || ris(a) - ris(b)
                  : (a, b) => fine(b) - fine(a));
    });
    const chiuse = computed(() => righe.value.filter(p => !p.aperto));
    const somma = computed(() => ({ n: chiuse.value.length, vinte: chiuse.value.filter(p => ris(p) > 0).length,
      euro: chiuse.value.reduce((n, p) => n + ris(p), 0),
      costi: chiuse.value.reduce((n, p) => n + (p.commissioni || 0) + (p.swap || 0), 0), r: chiuse.value.reduce((n, p) => n + (p.r || 0), 0) }));
    // equity: la base più i trade filtrati in ordine di chiusura; tempi in ora del broker come gli altri grafici
    const base = computed(() => F.unita === "r" ? 0 : conto.value?.capitale ?? 0);
    const punti = computed(() => {
      const v = [...chiuse.value].sort((a, b) => a.t_uscita - b.t_uscita), out = [];
      if (!v.length) return out;
      let tot = base.value;
      out.push({ time: v[0].t, value: tot });                             // si parte dall'entrata del primo trade
      for (const p of v) {
        tot += F.unita === "r" ? p.r || 0 : ris(p);
        out.push({ time: Math.max(p.t_uscita, out.at(-1).time + 1), value: Math.round(tot * 100) / 100 });   // tempi tutti diversi
      }
      return out;
    });
    // CSV per Excel italiano: punto e virgola, virgola decimale, BOM perché gli accenti arrivino giusti
    const csv = () => {
      const n = (v, dg = 2) => v == null ? "" : Number(v).toFixed(dg).replace(".", ",");
      const d = t => t ? new Date(ms(t)).toLocaleString("it-IT") : "";
      const testa = ["entrata", "uscita", "strumento", "lato", "lotti", "prezzo entrata", "stop iniziale", "target", "prezzo uscita",
                     "motivo", "R", "euro netti", "euro del prezzo", "commissioni", "swap", "punti", "tipo stop", "segnale"];
      const dati = righe.value.map(p => [d(p.t), p.aperto ? "aperto" : d(p.t_uscita), nome(p.sym), p.lato, n(p.lotti),
        n(p.prezzo, p.dg), n(p.sl0, p.dg), n(p.tp, p.dg), n(p.aperto ? p.ora : p.uscita, p.dg), p.aperto ? "in corso" : p.motivo,
        n(p.r), n(p.euro), n(p.lordo), n(p.commissioni), n(p.swap), n(p.punti, p.dg), p.tipo_sl, p.segnale]);
      const testo = [testa, ...dati].map(r => r.map(x => `"${String(x ?? "").replace(/"/g, '""')}"`).join(";")).join("\r\n");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob(["﻿" + testo], { type: "text/csv;charset=utf-8" }));
      a.download = `conto-simulato-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };
    // utente 22/10 notte: nell'app solo il conto (dal 23/10 la serie mm) e la base, le altre girano in background
    const sim = computed(() => [...new Set([conto.value?.serie, "base"])].filter(Boolean).map(k => ({ k, ...(D.stato?.simulati?.[k] || {}) })).filter(s => s.chiuse != null));
    const tinta = v => v == null ? "var(--muted)" : v >= 0 ? "var(--long)" : "var(--short)";
    return { conto, F, ORDINI, strumenti, righe, somma, base, punti, csv, sim, ms, tinta, fmt, segno, nome, quando, href, vai };
  },
  template: `<Pannello titolo="Conto simulato" nota="trade sui prezzi di Pure · clic su una riga: il trade sul grafico">
    <p v-if="conto" class="muto">saldo <b class="num">{{ fmt(conto.saldo, 2) }} €</b> · equity <b class="num">{{ fmt(conto.equity, 2) }} €</b>
      · realizzato <b class="num" :style="{ color: tinta(conto.realizzato) }">{{ segno(conto.realizzato) }} €</b></p>
    <div class="reg-filtri" role="group" aria-label="Filtri dei trade">
      <label>strumento <select v-model="F.sym"><option value="">tutti</option><option v-for="s in strumenti" :key="s" :value="s">{{ nome(s) }}</option></select></label>
      <label>lato <select v-model="F.lato"><option value="">tutti</option><option>long</option><option>short</option></select></label>
      <label>esito <select v-model="F.esito"><option value="">tutti</option><option value="vinte">vinte</option><option value="perse">perse</option><option value="aperte">aperte</option></select></label>
      <label>ordine <select v-model="F.ordine"><option v-for="(t, k) in ORDINI" :key="k" :value="k">{{ t }}</option></select></label>
      <button type="button" class="filtro" @click="csv" :disabled="!righe.length" title="i trade filtrati, per Excel">⤓ CSV</button></div>
    <div class="reg-testa-eq">
      <p class="muto"><b class="num">{{ somma.n }}</b> chiuse · <b class="num">{{ somma.vinte }}</b> vinte
        <template v-if="somma.n">({{ fmt(somma.vinte / somma.n * 100, 0) }} %)</template> ·
        <b class="num" :style="{ color: tinta(somma.euro) }">{{ segno(somma.euro) }} €</b> ·
        <b class="num" :style="{ color: tinta(somma.r) }">{{ segno(somma.r) }} R</b>
        <template v-if="somma.costi"> · di cui swap e commissioni <b class="num">{{ segno(somma.costi) }} €</b></template></p>
      <div class="schede" role="group" aria-label="Unità dell'equity line">
        <button type="button" class="filtro" :aria-pressed="F.unita === 'euro'" @click="F.unita = 'euro'">€</button>
        <button type="button" class="filtro" :aria-pressed="F.unita === 'r'" @click="F.unita = 'r'">R</button></div></div>
    <Equity v-if="punti.length > 1" :punti="punti" :base="base"/>
    <p v-else class="muto">L'equity line compare con almeno un trade chiuso fra quelli filtrati.</p>
    <div class="scorre reg-trade"><table class="cot carte"><thead><tr><th>strumento</th><th class="num">entrata</th><th class="num">uscita</th>
      <th class="num">R</th><th class="num">euro</th><th class="num">swap + comm.</th><th>come</th></tr></thead>
      <tbody><tr v-if="!righe.length"><td colspan="7" class="muto">Nessun trade con questi filtri.</td></tr>
        <tr v-for="p in righe" :key="p.sym + p.t" class="reg-riga" @click="vai('grafici', p.sym, 'trade', p.t)">
          <th scope="row" class="testa"><a :href="href('grafici', p.sym, 'trade', p.t)" @click.stop>{{ nome(p.sym) }}</a>&nbsp;<span :style="{ color: 'var(--' + p.lato + ')' }">{{ p.lato }}</span></th>
          <td class="num" data-l="entrata">{{ quando(ms(p.t)) }}</td>
          <td class="num" data-l="uscita">{{ p.aperto ? "aperto" : quando(ms(p.t_uscita)) }}</td>
          <td class="num" data-l="R" :style="{ color: tinta(p.r) }">{{ p.r == null ? "–" : segno(p.r) }}</td>
          <td class="num" data-l="euro" :style="{ color: tinta(p.euro) }">{{ p.euro == null ? "–" : segno(p.euro) + " €" }}</td>
          <td class="num muto" data-l="swap + comm." :title="'commissioni ' + fmt(p.commissioni ?? 0, 2) + ' € · swap ' + fmt(p.swap ?? 0, 2) + ' €'">{{ p.commissioni == null ? "–" : segno((p.commissioni || 0) + (p.swap || 0)) + " €" }}</td>
          <td class="a-capo" data-l="come">{{ p.aperto ? "in corso" : p.motivo }}</td></tr></tbody></table></div>
    <h4>Trade simulati su Pure</h4>
    <table class="cot"><thead><tr><th>serie</th><th class="num">chiusi</th><th class="num">vinti</th><th class="num">R totale</th><th class="num">aperti</th></tr></thead>
      <tbody><tr v-for="s in sim" :key="s.k"><th scope="row">{{ s.k }} <small class="muto">{{ s.descrizione }}</small></th>
        <td class="num">{{ s.chiuse }}</td><td class="num">{{ s.vinte }}</td>
        <td class="num" :style="{ color: s.r_totale >= 0 ? 'var(--long)' : 'var(--short)' }">{{ segno(s.r_totale) }}</td>
        <td class="num">{{ s.aperte?.length ?? 0 }}</td></tr></tbody></table></Pannello>`,
};

export const Registro = {
  components: { Cronologia, Operazioni },
  template: `<div class="quadro"><Cronologia/><Operazioni/></div>`,
};
