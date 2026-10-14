// Campanella di Wall Street: suona all'apertura (9:30) e alla chiusura (16:00) di New York, lun-ven, con la pagina aperta.
// L'ora è quella di New York, così i giorni in cui l'ora legale cambia in Europa e in America in date diverse tornano da soli.
// Se c'è web/campanella.mp3 suona quella registrazione; se no un trillo di campanella elettrica fatto qui (niente file da fuori).
// Le feste di Borsa non sono contate.
import { ref, onMounted, onUnmounted } from "vue";
import { ricorda } from "../dati.js";

const ORE = { "09:30": "apre", "16:00": "chiude" };
let ctx = null;

function newYork(d = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d).map(x => [x.type, x.value]));
  return { giorno: p.weekday, hm: `${p.hour}:${p.minute}` };
}

// trillo: martelletto ~16 colpi al secondo su una campana con parziali non armoniche, per 8 s, poi la coda
function trillo(secondi = 8) {
  ctx ||= new AudioContext();
  const t0 = ctx.currentTime + 0.05, fine = t0 + secondi, uscita = ctx.createGain();
  uscita.gain.value = 0.25;
  uscita.connect(ctx.destination);
  for (let t = t0; t < fine; t += 1 / 16) {
    for (const [f, a, dur] of [[1180, 1, 0.5], [2950, 0.5, 0.25], [4370, 0.3, 0.15], [6100, 0.15, 0.1]]) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = f * (1 + (Math.random() - 0.5) * 0.004);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(a * 0.3, t + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, t + (t + 1 / 16 >= fine ? dur * 4 : dur));
      o.connect(g).connect(uscita);
      o.start(t);
      o.stop(t + dur * 4);
    }
  }
}

export function suona() {
  const a = new Audio("campanella.mp3");
  a.play().catch(() => trillo());
}

export const Campanella = {
  setup() {
    const accesa = ref(ricorda("campanella") !== "0");
    let suonata = "", timer;
    const controlla = () => {
      const { giorno, hm } = newYork();
      if (!accesa.value || !ORE[hm] || ["Sat", "Sun"].includes(giorno) || suonata === hm) return;
      suonata = hm;
      suona();
    };
    // il browser fa suonare solo dopo un clic: il primo clic sulla pagina sblocca l'audio
    const sblocca = () => { ctx ||= new AudioContext(); ctx.resume(); };
    const cambia = () => { accesa.value = !accesa.value; ricorda("campanella", accesa.value ? "1" : "0"); if (accesa.value) suona(); };
    onMounted(() => { timer = setInterval(controlla, 1000); document.addEventListener("click", sblocca, { once: true }); });
    onUnmounted(() => clearInterval(timer));
    return { accesa, cambia };
  },
  template: `<button class="filtro" type="button" @click="cambia" :aria-pressed="accesa"
    :title="accesa ? 'Campanella di Wall Street accesa (apre 9:30, chiude 16:00 New York): clic per spegnerla' : 'Campanella spenta: clic per accenderla (suona una prova)'">
    {{ accesa ? "🔔" : "🔕" }} Wall Street</button>`,
};
