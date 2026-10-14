// Pagina Segnali D1 (Luigi 26/10: "d1..segnale nuovo..a che prezzo.. e idem segnali vecchi / dove è entrato in h4...a che
// prezzo / allora si che creiamo statistica"): per ogni segnale D1 il prezzo secco, l'ingresso H4 e l'ingresso H1 (solo
// in orario) con quanto sono meglio del D1. Sopra il riepilogo per strumento, con i D1 negati (Luigi 11:11: "h1..non riesce
// a girare d1...mentre h4 si / se sappiamo che i segnali d1 sono super affidabili ..entriamo h1 / se no..aspettiamo h4").
import { computed, ref } from "vue";
import { D, fmt, segno, nome } from "../dati.js";
import { Lato } from "./ui.js";

const giorno = t => new Date(t * 1000).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "UTC" });
const ora = iso => iso ? new Date(iso).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" }) : "";
const media = v => v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;

export const Segnali = {
  components: { Lato },
  setup() {
    const tutte = computed(() => Array.isArray(D.stato?.segnali_d1) ? D.stato.segnali_d1 : []);
    const scelto = ref("tutti");
    const simboli = computed(() => [...new Set(tutte.value.map(x => x.sym))]);
    const righe = computed(() => scelto.value === "tutti" ? tutte.value : tutte.value.filter(x => x.sym === scelto.value));
    // riepilogo: solo i segnali chiusi (il D1 ha già rigirato), così ognuno ha avuto tutto il tempo per i suoi ingressi
    const riepilogo = computed(() => simboli.value.map(sym => {
      const v = tutte.value.filter(x => x.sym === sym && x.rigirato);
      const negati = v.filter(x => !x.h4);
      return { sym, n: v.length, unita: v[0]?.unita, negati: negati.length, negati_h1: negati.filter(x => x.h1).length,
               h4: media(v.filter(x => x.h4).map(x => x.h4.meglio)), h1: media(v.filter(x => x.h1).map(x => x.h1.meglio)),
               h4_meglio: v.filter(x => x.h4?.meglio > 0).length, n4: v.filter(x => x.h4).length,
               h1_meglio: v.filter(x => x.h1?.meglio > 0).length, n1: v.filter(x => x.h1).length };
    }));
    // le tabelle del bot, nell'ordine di Luigi (27/10: "d1 h8 h4 h1..e la tabella anche nel sito"): lato, 🆕 o da quante
    // candele, e il prezzo del segnale (la chiusura della candela in cui è scattato); prima i nuovi, poi i più recenti
    const tabelle = computed(() => ["W1", "D1", "H8", "H4", "H1"].map(tf => ({ tf, righe: (D.stato?.strumenti || [])
      .filter(x => !x.errore && x.lato_tf?.[tf]?.lato)
      .map(x => { const l = x.lato_tf[tf]; return { sym: x.sym, lato: l.lato, nuovo: l.segnale === "cambio", da: l.da,
        prezzo: l.prezzo_segnale ?? (l.segnale === "cambio" ? l.chiusura : null), digits: x.digits }; })
      .sort((a, b) => (a.nuovo ? 0 : a.da) - (b.nuovo ? 0 : b.da)) })));
    const pct = (a, b) => b ? Math.round(100 * a / b) + " %" : "–";
    const tinta = v => v == null ? "" : v > 0 ? "var(--long)" : v < 0 ? "var(--short)" : "";
    return { D, tutte, scelto, simboli, righe, riepilogo, tabelle, pct, tinta, giorno, ora, fmt, segno, nome };
  },
  template: `<section class="pan">
    <div class="seg-tab">
      <div v-for="T in tabelle" :key="T.tf" class="cot-box"><table class="cot">
        <thead><tr><th><span class="seg-tf">{{ T.tf }}</span></th><th>lato</th><th class="num">segnale</th><th class="num">prezzo</th></tr></thead>
        <tbody><tr v-for="x in T.righe" :key="x.sym">
          <th scope="row" class="testa">{{ nome(x.sym) }}</th><td><Lato :lato="x.lato"/></td>
          <td class="num"><b v-if="x.nuovo" class="nuovo">nuovo</b><template v-else>da {{ x.da }}c</template></td>
          <td class="num">{{ x.prezzo == null ? "–" : fmt(x.prezzo, x.digits) }}</td></tr></tbody></table></div>
    </div>
    <h3>Segnali D1 <small>prezzo secco del D1, primo H4 e primo H1 (7–19) nel verso del D1 dopo la chiusura della D1; meglio = pip o punti guadagnati sul D1</small></h3>
    <p v-if="!tutte.length" class="muto">Lo storico arriva col prossimo giro.</p>
    <template v-else>
    <div class="cot-box"><table class="cot carte seg-riep">
      <thead><tr><th>strumento</th><th class="num">segnali</th><th class="num" title="il D1 ha rigirato prima che arrivasse il primo H4">D1 negati prima dell'H4</th>
        <th class="num" title="di quei segnali negati, quante volte l'H1 era già entrato">di cui con H1 entrato</th>
        <th class="num">H4 meglio, media</th><th class="num">H4 meglio, volte</th><th class="num">H1 meglio, media</th><th class="num">H1 meglio, volte</th></tr></thead>
      <tbody><tr v-for="s in riepilogo" :key="s.sym">
        <th scope="row" class="testa">{{ nome(s.sym) }}</th>
        <td class="num" data-l="segnali">{{ s.n }}</td>
        <td class="num" data-l="D1 negati prima dell'H4">{{ s.negati }} <small class="muto">{{ pct(s.negati, s.n) }}</small></td>
        <td class="num" data-l="di cui con H1 entrato">{{ s.negati_h1 }}</td>
        <td class="num" data-l="H4 meglio, media" :style="{ color: tinta(s.h4) }">{{ s.h4 == null ? "–" : segno(s.h4, 1) + " " + s.unita }}</td>
        <td class="num" data-l="H4 meglio, volte">{{ pct(s.h4_meglio, s.n4) }}</td>
        <td class="num" data-l="H1 meglio, media" :style="{ color: tinta(s.h1) }">{{ s.h1 == null ? "–" : segno(s.h1, 1) + " " + s.unita }}</td>
        <td class="num" data-l="H1 meglio, volte">{{ pct(s.h1_meglio, s.n1) }}</td></tr></tbody></table></div>

    <div class="schede" role="group" aria-label="Strumento">
      <button class="filtro" type="button" :aria-pressed="scelto === 'tutti'" @click="scelto = 'tutti'">Tutti</button>
      <button v-for="s in simboli" :key="s" class="filtro" type="button" :aria-pressed="scelto === s" @click="scelto = s">{{ nome(s) }}</button></div>

    <div class="cot-box reg-trade"><table class="cot carte">
      <thead><tr><th>D1 del</th><th>strumento</th><th class="num">D1</th><th class="num">H4</th><th class="num">meglio</th><th class="num">H1</th><th class="num">meglio</th></tr></thead>
      <tbody><tr v-for="x in righe" :key="x.sym + x.t">
        <td class="num" data-l="D1 del">{{ giorno(x.t) }}</td>
        <th scope="row" class="testa">{{ nome(x.sym) }} <Lato :lato="x.lato"/></th>
        <td class="num" data-l="D1">{{ fmt(x.d1, x.digits) }}</td>
        <td class="num" data-l="H4" :title="x.h4 ? 'H4 che chiude ' + ora(x.h4.chiude) : ''">
          <template v-if="x.h4">{{ fmt(x.h4.prezzo, x.digits) }} <small class="muto">{{ ora(x.h4.chiude) }}</small></template>
          <span v-else class="muto">{{ x.rigirato ? "D1 negato" : "in attesa" }}</span></td>
        <td class="num" data-l="meglio H4" :style="{ color: tinta(x.h4?.meglio) }">{{ x.h4 ? segno(x.h4.meglio, 1) : "" }}</td>
        <td class="num" data-l="H1" :title="x.h1 ? 'H1 che chiude ' + ora(x.h1.chiude) : ''">
          <template v-if="x.h1">{{ fmt(x.h1.prezzo, x.digits) }} <small class="muto">{{ ora(x.h1.chiude) }}</small></template>
          <span v-else class="muto">{{ x.rigirato ? "nessuno" : "in attesa" }}</span></td>
        <td class="num" data-l="meglio H1" :style="{ color: tinta(x.h1?.meglio) }">{{ x.h1 ? segno(x.h1.meglio, 1) : "" }}</td></tr></tbody></table></div>
    </template></section>`,
};
