// Menu contextuel « Chercher dans Lexique » sur une sélection de texte.
// La définition s'affiche dans une info-bulle sur la page ; si la page refuse
// l'injection (pages chrome://, PDF…) ou si l'index est injoignable, la fiche
// s'ouvre dans un nouvel onglet comme avant.

const LEXIQUE_URL = "https://sebastien544.github.io/lexique/";
const INDEX_URL = LEXIQUE_URL + "lexique-index.json";
const MAX_LEN = 100;        // une sélection plus longue n'est pas un terme
const INDEX_TTL = 3600e3;   // l'index est relu au plus une fois par heure
const MAX_PROCHES = 6;

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "chercher-lexique",
    title: "Chercher « %s » dans Lexique",
    contexts: ["selection"],
  });
});

// mêmes règles que fold() dans index.html : casse, accents et apostrophes ignorés
const fold = s => String(s || "").toLowerCase()
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/œ/g, "oe").replace(/æ/g, "ae")
  .replace(/[’‘`´]/g, "'").replace(/\s+/g, " ").trim();

let INDEX = null; // { at, fiches: [{ n, e, d, l, t, c, s, fn, fe }] }

async function chargerIndex() {
  if (INDEX && Date.now() - INDEX.at < INDEX_TTL) return INDEX.fiches;
  const rep = await fetch(INDEX_URL);
  if (!rep.ok) throw new Error("index Lexique : HTTP " + rep.status);
  const { fiches } = await rep.json();
  for (const f of fiches) { f.fn = fold(f.n); f.fe = fold(f.e); }
  INDEX = { at: Date.now(), fiches };
  return fiches;
}

function chercher(fiches, q) {
  const f = fold(q);
  const exacte = fiches.find(x => x.fn === f) || fiches.find(x => x.fe && x.fe === f);
  if (exacte) return { fiche: exacte };
  const singulier = f.replace(/[sx]$/, "");
  if (singulier !== f) {
    const s = fiches.find(x => x.fn === singulier);
    if (s) return { fiche: s };
  }
  const proches = f.length < 3 ? [] : fiches.filter(x => x.fn.includes(singulier)).slice(0, MAX_PROCHES);
  return { proches };
}

const urlFiche = x => LEXIQUE_URL + "#" + x.l + "/" + x.s;
const urlRecherche = q => { const u = new URL(LEXIQUE_URL); u.searchParams.set("q", q); return u.href; };
const sansCles = ({ fn, fe, ...x }) => ({ ...x, url: urlFiche(x) });

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "chercher-lexique") return;
  const q = (info.selectionText || "").trim().replace(/\s+/g, " ").slice(0, MAX_LEN);
  if (!q) return;
  const ouvrirOnglet = () => chrome.tabs.create({ url: urlRecherche(q), index: tab ? tab.index + 1 : undefined });
  try {
    const r = chercher(await chargerIndex(), q);
    const resultat = {
      q,
      recherche: urlRecherche(q),
      fiche: r.fiche ? sansCles(r.fiche) : null,
      proches: (r.proches || []).map(sansCles),
    };
    await chrome.scripting.executeScript({
      target: { tabId: tab.id, frameIds: [info.frameId || 0] },
      func: afficherBulle,
      args: [resultat],
    });
  } catch (e) {
    console.warn("Lexique :", e.message);
    ouvrirOnglet();
  }
});

// Exécutée dans la page : doit se suffire à elle-même (aucune variable extérieure).
function afficherBulle(r) {
  document.getElementById("lexique-bulle")?.remove();

  const hote = document.createElement("div");
  hote.id = "lexique-bulle";
  const ombre = hote.attachShadow({ mode: "open" });
  ombre.innerHTML = `<style>
    :host { all: initial; }
    .b { position: absolute; z-index: 2147483647; box-sizing: border-box; width: min(380px, calc(100vw - 24px));
      background: #fbf8f2; color: #1c1917; border: 1px solid #d6d0c4; border-radius: 10px;
      box-shadow: 0 8px 28px rgba(0,0,0,.18); padding: 14px 16px 12px;
      font: 14px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; text-align: left; }
    @media (prefers-color-scheme: dark) {
      .b { background: #1f1d1a; color: #ece7dd; border-color: #3a3631; }
      .lex, .cat, .vide { color: #a8a29e !important; }
      a { color: #7dd3c0 !important; }
      .fermer { color: #a8a29e !important; }
    }
    .lex { font-size: 11px; letter-spacing: .06em; text-transform: uppercase; color: #78716c; margin-bottom: 4px; padding-right: 22px; }
    .nom { font: 600 18px/1.25 Georgia, "Times New Roman", serif; margin: 0 0 2px; }
    .cat { font-size: 12px; color: #78716c; margin-bottom: 8px; }
    .def { margin: 0 0 10px; }
    .vide { color: #57534e; margin: 0 0 8px; }
    ul { margin: 0 0 10px; padding: 0; list-style: none; }
    li { margin: 2px 0; }
    a { color: #0f766e; text-decoration: none; cursor: pointer; }
    a:hover { text-decoration: underline; }
    .ouvrir { font-weight: 600; font-size: 13px; }
    .fermer { position: absolute; top: 6px; right: 8px; border: 0; background: none; font-size: 18px;
      line-height: 1; color: #78716c; cursor: pointer; padding: 4px; }
  </style><div class="b" role="dialog" aria-label="Lexique"><button class="fermer" aria-label="Fermer">×</button><div class="contenu"></div></div>`;

  const bulle = ombre.querySelector(".b");
  const contenu = ombre.querySelector(".contenu");
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt) e.textContent = txt; return e; };
  const lien = (txt, url, cls) => { const a = el("a", cls, txt); a.href = url; a.target = "_blank"; a.rel = "noopener"; return a; };

  function montrerFiche(f) {
    contenu.replaceChildren(
      el("div", "lex", f.t),
      el("div", "nom", f.n),
      el("div", "cat", f.c),
      el("p", "def", f.d),
      lien("Ouvrir la fiche dans Lexique →", f.url, "ouvrir"),
    );
  }

  if (r.fiche) montrerFiche(r.fiche);
  else {
    const enfants = [el("div", "lex", "Lexique"), el("p", "vide", `Aucune fiche « ${r.q} ».`)];
    if (r.proches.length) {
      const ul = el("ul");
      for (const p of r.proches) {
        const a = el("a", null, p.n);
        a.addEventListener("click", ev => { ev.preventDefault(); montrerFiche(p); });
        const li = el("li"); li.append(a, document.createTextNode(" · " + p.t)); ul.append(li);
      }
      enfants.push(ul);
    }
    enfants.push(lien("Chercher dans Lexique →", r.recherche, "ouvrir"));
    contenu.replaceChildren(...enfants);
  }

  // sous la sélection, ramenée dans la fenêtre
  const sel = window.getSelection();
  const rect = sel && sel.rangeCount ? sel.getRangeAt(0).getBoundingClientRect() : null;
  const largeur = Math.min(380, window.innerWidth - 24);
  const x = Math.max(12, Math.min((rect ? rect.left : 12), window.innerWidth - largeur - 12));
  const y = rect ? rect.bottom + 8 : 12;
  bulle.style.left = (x + window.scrollX) + "px";
  bulle.style.top = (y + window.scrollY) + "px";

  const fermer = () => { hote.remove(); document.removeEventListener("mousedown", dehors, true); document.removeEventListener("keydown", echap, true); };
  const dehors = ev => { if (!ev.composedPath().includes(hote)) fermer(); };
  const echap = ev => { if (ev.key === "Escape") fermer(); };
  ombre.querySelector(".fermer").addEventListener("click", fermer);
  document.addEventListener("mousedown", dehors, true);
  document.addEventListener("keydown", echap, true);

  document.documentElement.append(hote);

  // trop bas pour tenir sous la sélection : au-dessus
  if (rect) {
    const h = bulle.offsetHeight;
    if (y + h > window.innerHeight - 8 && rect.top - h - 8 > 0) bulle.style.top = (rect.top - h - 8 + window.scrollY) + "px";
  }
}
