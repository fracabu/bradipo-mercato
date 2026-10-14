// Pagina Controllo (Luigi 19/10: "la app ci deve riportare alla perfezione quello che succede sul grafico"): per lo
// strumento scelto i valori degli indicatori sulle ultime 3 candele chiuse H1 e D1, da mettere accanto al grafico MT5.
// Le ore sono quelle del broker (le stesse dell'asse del grafico MT5), non quelle italiane.
import { computed } from "vue";
import { D, fmt, strumento } from "../dati.js";
import { R, vai } from "../rotta.js";
import { Lato, Pannello, Schede } from "./ui.js";

const oraBroker = (ts, tf) => {
  const d = new Date(ts * 1000), z = n => String(n).padStart(2, "0");
  const giorno = `${z(d.getUTCDate())}/${z(d.getUTCMonth() + 1)}`;
  return tf === "D1" ? giorno : `${giorno} ${z(d.getUTCHours())}:${z(d.getUTCMinutes())}`;
};
const su = b => b ? "▲" : "▼";

const TabellaTf = {
  components: { Lato, Pannello },
  props: { tf: String, c: Object, dg: Number },
  setup: () => ({ fmt, oraBroker, su }),
  template: `<Pannello :titolo="tf" :nota="'SAR adesso ' + fmt(c.sar_ora, dg)">
    <p>Lato <Lato :lato="c.lato"/> <span class="muto">da {{ c.da ?? "–" }} {{ c.da === 1 ? "candela" : "candele" }}{{ c.segnale ? " · segnale " + c.segnale : "" }}</span></p>
    <div class="cot-box"><table class="cot ctl carte"><thead><tr><th>candela</th><th class="num">apertura</th><th class="num">massimo</th>
      <th class="num">minimo</th><th class="num">chiusura</th><th class="num">TSI / media</th><th>Heikin Ashi</th><th class="num">stoc K / D</th><th class="num">SAR</th></tr></thead>
      <tbody><tr v-for="x in c.candele" :key="x.t">
        <td class="largo testa">{{ oraBroker(x.t, tf) }}</td><td class="num" data-l="apertura">{{ fmt(x.o, dg) }}</td><td class="num" data-l="massimo">{{ fmt(x.h, dg) }}</td>
        <td class="num" data-l="minimo">{{ fmt(x.l, dg) }}</td><td class="num" data-l="chiusura">{{ fmt(x.c, dg) }}</td>
        <td class="num" data-l="TSI / media">{{ fmt(x.tsi, 2) }} / {{ fmt(x.media, 2) }} <b :style="{ color: 'var(--' + (x.tsi > x.media ? 'long' : 'short') + ')' }">{{ su(x.tsi > x.media) }}</b></td>
        <td class="largo" data-l="Heikin Ashi"><span><b :style="{ color: 'var(--' + (x.ha === 'bianca' ? 'long' : 'short') + ')' }">{{ x.ha }}</b> <span class="muto">{{ fmt(x.ha_o, dg) }} → {{ fmt(x.ha_c, dg) }}</span></span></td>
        <td class="num" data-l="stoc K / D">{{ fmt(x.k, 1) }} / {{ fmt(x.d, 1) }} <b :style="{ color: 'var(--' + (x.k > x.d ? 'long' : 'short') + ')' }">{{ su(x.k > x.d) }}</b></td>
        <td class="num" data-l="SAR">{{ fmt(x.sar, dg) }}</td></tr></tbody></table></div></Pannello>`,
};

export const Controllo = {
  components: { Schede, TabellaTf },
  setup() {
    const voci = computed(() => (D.stato?.strumenti || []).map(x => ({ id: x.sym, testo: x.nome })));
    const sym = computed(() => R.parti[1] || voci.value[0]?.id);
    const x = computed(() => strumento(sym.value));
    return { voci, sym, x, scegli: s => vai("controllo", s) };
  },
  template: `<section class="pan">
    <h3>Controllo <small>pagina = grafico MT5: ultime 3 candele chiuse, ore del broker · TSI 8,5 media 3 · stocastico 8,5,3 · SAR 0,13/0,13</small></h3>
    <Schede :voci="voci" :model-value="sym" @update:model-value="scegli" etichetta="Strumento"/></section>
    <template v-if="x.piano?.controllo">
      <TabellaTf v-for="tf in ['H1', 'D1']" :key="tf" :tf="tf" :c="x.piano.controllo[tf]" :dg="x.digits" v-show="x.piano.controllo[tf]"/>
    </template>
    <p v-else class="pan muto">Dati di controllo non ancora arrivati: aspetta il prossimo giro.</p>`,
};
