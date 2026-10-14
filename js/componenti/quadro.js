// Pagina Quadro (utente 23/10): per ogni strumento cosa fa il D1, cosa fa l'H1, cosa manca al segnale a favore e i
// livelli sopra e sotto il prezzo. Il clic apre il grafico grande con la stessa lettura sotto.
import { computed } from "vue";
import { D, fmt, strumento } from "../dati.js";
import { R, href } from "../rotta.js";
import { Lato, Pill } from "./ui.js";
import { Riquadro } from "./grafici.js";
import { lettura, ordina } from "../lettura.js";

const STATO = { scattato: ["pronto", "segnale"], attesa: ["osserva", "in attesa"], dentro: ["fermo", "già dentro"], nessuno: ["fermo", "fermo"] };

const Carta = {
  components: { Lato, Pill },
  props: { x: Object, l: Object, link: Boolean },
  setup: () => ({ fmt, href, STATO }),
  template: `<component :is="link ? 'a' : 'div'" class="quadro-carta" :href="link ? href('quadro', x.sym) : null"
      :style="{ '--c': 'var(--' + (l.d1 || 'fermo') + ')' }">
    <div class="qc-testa"><b>{{ x.nome }}</b> <span class="num">{{ fmt(x.prezzo, x.digits) }}</span>
      <span class="muto">D1</span> <Lato :lato="l.d1" :testo="l.d1 ? l.d1 + ' da ' + l.da_d1 : null"/>
      <Pill :c="STATO[l.stato][0]">{{ STATO[l.stato][1] }}</Pill></div>
    <p class="qc-frase">{{ l.frase }}</p>
    <p v-if="l.avvisi.length" class="qc-avvisi">⚠ {{ l.avvisi.join(" · ") }}</p>
    <table class="qc-livelli">
      <tr v-for="v in [...l.sopra].reverse()" :key="'s' + v.prezzo" class="su"><td>{{ v.nome }}</td><td class="num">{{ fmt(v.prezzo, x.digits) }}</td><td class="num muto">{{ fmt(v.atr, 2) }} ATR</td></tr>
      <tr class="ora"><td>prezzo</td><td class="num">{{ fmt(x.prezzo, x.digits) }}</td><td></td></tr>
      <tr v-for="v in l.sotto" :key="'g' + v.prezzo" class="giu"><td>{{ v.nome }}</td><td class="num">{{ fmt(v.prezzo, x.digits) }}</td><td class="num muto">{{ fmt(v.atr, 2) }} ATR</td></tr>
    </table></component>`,
};

const Lista = {
  components: { Carta },
  setup() {
    const voci = computed(() => (D.stato?.strumenti || []).filter(x => !x.errore).map(x => ({ x, l: lettura(x) })).sort(ordina));
    return { voci };
  },
  template: `<section class="pan">
    <h3>Quadro <small>per ogni strumento: D1, cosa fa l'H1, cosa manca al segnale a favore, livelli sopra e sotto (distanza in ATR D1) · clic = grafico</small></h3>
    <ul class="quadro"><li v-for="v in voci" :key="v.x.sym"><Carta :x="v.x" :l="v.l" link/></li></ul></section>`,
};

const Dettaglio = {
  components: { Riquadro, Carta },
  setup() {
    const x = computed(() => strumento(R.parti[1]));
    const l = computed(() => x.value.sym && !x.value.errore ? lettura(x.value) : null);
    return { x, l, href };
  },
  template: `<Riquadro :sym="x.sym" :piano="null" grande>
      <div class="piano-barra"><a class="filtro" :href="href('quadro')" title="tutti gli strumenti">←</a><b class="pb-nome">{{ x.nome }}</b></div>
    </Riquadro>
    <Carta v-if="l" :x="x" :l="l"/>`,
};

export const Quadro = {
  components: { Lista, Dettaglio },
  setup: () => ({ R }),
  template: `<Dettaglio v-if="R.parti[1]"/><Lista v-else/>`,
};
