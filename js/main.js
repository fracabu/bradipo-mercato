// La pagina in Vue 3 senza compilazione: ogni pagina è un componente in componenti/, scelto dall'indirizzo (#/analisi).
import { createApp, computed } from "vue";
import { D, avvia } from "./dati.js";
import { R } from "./rotta.js";
import { Nav, Vivo, Striscia } from "./componenti/testata.js";
import { Tabellone } from "./componenti/tabellone.js";
import { Analisi } from "./componenti/analisi.js";
import { Quadro } from "./componenti/quadro.js";
import { Grafici } from "./componenti/grafici.js";
import { Mercato } from "./componenti/mercato.js";
import { Macro } from "./componenti/macro.js";
import { Registro } from "./componenti/registro.js";
import { Controllo } from "./componenti/controllo.js";
import { Operazioni } from "./componenti/operazioni.js";

const PAGINA = { tabellone: Tabellone, operazioni: Operazioni,analisi: Analisi, quadro: Quadro, grafici: Grafici, usa: Mercato, macro: Macro, registro: Registro, controllo: Controllo };

createApp({
  components: { Nav, Vivo, Striscia },
  setup() {
    const pagina = computed(() => PAGINA[R.parti[0]] || Tabellone);
    return { D, pagina };
  },
  template: `<div class="barra-alta"><Nav/><Vivo/></div>
    <Striscia/>
    <main v-if="D.stato"><component :is="pagina"/></main>
    <p v-else class="pan muto">{{ D.errore || "Carico i dati del giro…" }}</p>`,
}).mount("#app");

avvia();
