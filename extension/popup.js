// Liste « à rédiger » : consulter, retirer, copier pour la coller à Claude.
// Les termes qui ont reçu une fiche depuis disparaissent d'eux-mêmes (voir listeAJour).

const $ = id => document.getElementById(id);
let LISTE = [];

const envoyer = msg => chrome.runtime.sendMessage(msg);

function afficher(liste) {
  LISTE = liste;
  $("sous").textContent = liste.length
    ? `${liste.length} terme${liste.length > 1 ? "s" : ""} sans fiche`
    : "Rien à rédiger";
  $("copier").disabled = $("vider").disabled = !liste.length;
  const ul = $("liste");
  ul.replaceChildren();
  if (!liste.length) {
    const li = document.createElement("li"); li.className = "vide";
    li.textContent = "Clic droit sur un mot sans fiche → « Ajouter à la liste à rédiger ».";
    ul.append(li); return;
  }
  for (const x of liste) {
    const li = document.createElement("li");
    const t = document.createElement("div"); t.className = "terme"; t.textContent = x.terme;
    const s = document.createElement("div"); s.className = "src";
    s.textContent = x.sources.map(src => src.titre || src.url).join(" · ");
    s.title = x.sources.map(src => src.url).join("\n");
    li.append(t, s);
    if (x.sources[0]?.contexte) {
      const c = document.createElement("div"); c.className = "ctx"; c.textContent = "« " + x.sources[0].contexte + " »"; li.append(c);
    }
    const b = document.createElement("button"); b.className = "x"; b.textContent = "×"; b.title = "Retirer";
    b.addEventListener("click", async () => afficher((await envoyer({ type: "retirer", terme: x.terme })).liste));
    li.append(b);
    ul.append(li);
  }
}

function texteClaude(liste) {
  const lignes = [`Fiches à rédiger pour Lexique (${liste.length}) :`];
  for (const x of liste) {
    lignes.push(`- ${x.terme}`);
    for (const s of x.sources) {
      lignes.push(`    source : ${s.titre ? s.titre + " — " : ""}${s.url}`);
      if (s.contexte) lignes.push(`    contexte : « ${s.contexte} »`);
    }
  }
  return lignes.join("\n");
}

$("copier").addEventListener("click", async () => {
  await navigator.clipboard.writeText(texteClaude(LISTE));
  $("copier").textContent = "Copié ✓";
  setTimeout(() => { $("copier").textContent = "Copier pour Claude"; }, 1500);
});

$("vider").addEventListener("click", async () => {
  if (!confirm(`Vider les ${LISTE.length} termes de la liste ?`)) return;
  afficher((await envoyer({ type: "vider" })).liste);
});

envoyer({ type: "liste" }).then(r => afficher(r.liste || []));
