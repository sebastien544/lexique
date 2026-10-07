// Produit lexique-index.json, que lit l'extension « Chercher dans Lexique ».
// L'extension ne peut pas exécuter lexique-data.js (Chrome y interdit eval) :
// on lui sert donc, pour chaque nom de fiche, la définition de référence.
// Lancé par le hook pre-commit dès que lexique-data.js ou index.html changent.
//   node outils/generer-index.js

const fs = require("fs");
const path = require("path");

const RACINE = path.join(__dirname, "..");
const data = fs.readFileSync(path.join(RACINE, "lexique-data.js"), "utf8");
const html = fs.readFileSync(path.join(RACINE, "index.html"), "utf8");

const debut = html.indexOf("const LEXIQUES = {");
const fin = html.indexOf("\n};", debut) + 3;
if (debut < 0 || fin < 3) throw new Error("bloc LEXIQUES introuvable dans index.html");
const { LEXIQUES, CAT_LABELS } = new Function(data + "\n" + html.slice(debut, fin) + "\nreturn { LEXIQUES, CAT_LABELS };")();

// mêmes règles que slugify() dans index.html
const slugify = name => name.toLowerCase()
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "");

const fiches = [];
const vus = new Set();
let introuvables = 0;
for (const [lexId, lex] of Object.entries(LEXIQUES)) {
  for (const t of lex.terms()) {
    let home = t, homeId = lexId;
    if (t.ref) {
      const nom = t.refName || t.name;
      home = (LEXIQUES[t.ref]?.terms() || []).find(x => !x.ref && slugify(x.name) === slugify(nom));
      homeId = t.ref;
      if (!home) { introuvables++; continue; }
    }
    // une même notion n'a qu'une fiche de référence : on garde la première entrée par nom
    if (vus.has(t.name)) continue;
    vus.add(t.name);
    fiches.push({
      n: t.name,
      e: home.en || "",
      d: home.def,
      l: homeId,
      t: LEXIQUES[homeId].title,
      c: CAT_LABELS[home.cat] || "",
      s: slugify(home.name),
    });
  }
}

fs.writeFileSync(path.join(RACINE, "lexique-index.json"), JSON.stringify({ fiches }));
console.log(`lexique-index.json : ${fiches.length} noms` + (introuvables ? `, ${introuvables} renvoi(s) sans référence` : ""));
