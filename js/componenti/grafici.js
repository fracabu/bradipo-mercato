// Grafici D1 e H1 (Lightweight Charts, disegnati da js/grafici.js). Lo stesso componente serve due pagine:
// Grafici (pulsanti degli strumenti, indirizzo #/grafici/EURUSD) e il dettaglio dell'Analisi (con il piano disegnato).
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { D, ricorda, fmt, segno, nome, quando } from "../dati.js";
import { R, href } from "../rotta.js";
import { mostraGrafici, chiudiGrafici, caselle, impostaPiano, impostaTrade } from "../grafici.js";

export const Riquadro = {
  props: { sym: String, piano: Object, trade: Object, grande: Boolean },
  setup(p) {
    const box = ref(null);
    const disegna = async () => {
      if (!p.sym || !box.value) return;
      ricorda("scelto", p.sym);
      await mostraGrafici(box.value, p.sym, D.stato?.server);
      impostaPiano(p.piano || null);
      impostaTrade(p.trade || null);
    };
    onMounted(disegna);
    watch(() => [p.sym, D.stato?.generato], disegna);
    watch(() => p.piano, v => impostaPiano(v || null));
    watch(() => p.trade, v => impostaTrade(v || null));
    onBeforeUnmount(() => { impostaPiano(null); impostaTrade(null); chiudiGrafici(); });
    return { box, iniz: caselle() };
  },
  template: `<section class="grafici" :class="{ grande }" ref="box" aria-label="Grafici D1 e H1">
    <slot/>
    <div class="gr-barra" :hidden="grande"><h3 class="gr-titolo">Grafici</h3></div>
    <div class="gr-opzioni">
      <label class="gr-scelta"><input type="checkbox" id="gr-segnali" :checked="iniz.segnali"> segnali Bradipo (B / S)</label>
      <label class="gr-scelta" hidden><input type="checkbox" id="gr-cme" :checked="iniz.cme"> volume CME (futures)</label>
      <span class="gr-cme-nota muto" id="gr-cme-nota"></span></div>
    <div class="gr-strumenti" role="group" aria-label="Linee sui grafici">
      <button type="button" class="filtro" data-azione="o" aria-pressed="false" title="un clic sul grafico: linea orizzontale su D1 e H1">— orizzontale</button>
      <button type="button" class="filtro" data-azione="t" aria-pressed="false" title="due clic sul grafico: linea obliqua">╱ obliqua</button>
      <button type="button" class="filtro" data-azione="ultima">togli ultima</button>
      <button type="button" class="filtro" data-azione="tutte">togli tutte</button>
      <span class="muto">📷 su ogni grafico, o i tasti D e H</span></div>
    <table class="gr-atr" hidden></table>
  </section>`,
};

export const Grafici = {
  components: { Riquadro },
  setup() {
    const ok = computed(() => (D.stato?.strumenti || []).filter(x => !x.errore));
    // lo strumento viene dall'indirizzo (#/grafici/EURUSD), altrimenti l'ultimo guardato
    const sym = computed(() => {
      const voluto = R.parti[1] || ricorda("scelto");
      return ok.value.some(x => x.sym === voluto) ? voluto : ok.value[0]?.sym;
    });
    // trade del conto simulato scelto nel Registro (#/grafici/DE40/trade/<ora d'entrata>): la sua storia sul grafico
    const trade = computed(() => {
      if (R.parti[2] !== "trade" || !sym.value) return null;
      const sm = D.stato?.simulati || {}, t = Number(R.parti[3]);
      return [...(sm.conto?.chiuse || []), ...(sm.conto?.aperte || []), ...(sm.base?.ultime || []), ...(sm.base?.aperte || [])]
        .find(p => p.sym === sym.value && p.t === t) || null;
    });
    const ms = t => (t - (D.stato?.simulati?.conto?.scarto || 0)) * 1000;     // tempi in ora del broker
    return { R, ok, sym, href, trade, ms, fmt, segno, nome, quando };
  },
  template: `<Riquadro :sym="sym" :trade="trade">
    <div v-if="trade" class="storia-trade" :style="{ '--c': 'var(--' + trade.lato + ')' }">
      <b>{{ nome(trade.sym) }} {{ trade.lato }}</b>
      <span>entrata <span class="num">{{ fmt(trade.prezzo, trade.dg) }}</span> <span class="muto">{{ quando(ms(trade.t)) }}</span></span>
      <span v-if="trade.t_uscita">uscita <span class="num">{{ fmt(trade.uscita, trade.dg) }}</span> <span class="muto">{{ quando(ms(trade.t_uscita)) }} · {{ trade.motivo }}</span></span>
      <span v-else class="muto">ancora aperto</span>
      <span>stop iniziale <span class="num">{{ fmt(trade.sl0, trade.dg) }}</span><template v-if="trade.tp != null"> · target <span class="num">{{ fmt(trade.tp, trade.dg) }}</span></template></span>
      <b v-if="trade.r != null" class="num" :style="{ color: trade.r >= 0 ? 'var(--long)' : 'var(--short)' }">{{ segno(trade.r) }} R<template v-if="trade.euro != null"> · {{ segno(trade.euro) }} €</template></b>
      <span class="muto">{{ (trade.storia?.length || 1) - 1 }} spostamenti dello stop</span>
      <a class="filtro" href="#/registro">← registro</a><a class="filtro" :href="href('grafici', sym)">togli</a></div>
    <p v-else-if="R.parti[2] === 'trade'" class="muto">Trade non trovato fra gli ultimi del conto simulato.</p>

    <div class="schede" role="group" aria-label="Strumento dei grafici">
      <a v-for="x in ok" :key="x.sym" class="filtro" :href="href('grafici', x.sym)" :aria-pressed="x.sym === sym">{{ x.nome }}</a>
      <a v-if="sym" class="filtro" :href="href('analisi', sym)">piano →</a></div>
    <div class="legenda"><span><i style="--c:#e8231f" class="tr"></i>POC del movimento</span><span><i style="--c:rgba(232,35,31,0.7)" class="tr"></i>POC di lungo periodo</span><span><i style="--c:#e8231f"></i>TSI</span><span><i style="--c:#2f8a1c"></i>stocastico %K</span><span><i style="--c:#999"></i>media TSI · %D</span><span><i style="--c:#ffd60a"></i>SAR H1</span><span>grafici: <a href="https://www.tradingview.com/" target="_blank" rel="noopener">TradingView</a> Lightweight Charts</span></div>
  </Riquadro>`,
};
