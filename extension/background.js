// Menu contextuel « Chercher dans Lexique » sur une sélection de texte.
// L'app lit le paramètre q : fiche ouverte si le nom existe, recherche sinon.

const LEXIQUE_URL = "https://sebastien544.github.io/lexique/";
const MAX_LEN = 100; // une sélection plus longue n'est pas un terme

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "chercher-lexique",
    title: "Chercher « %s » dans Lexique",
    contexts: ["selection"],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== "chercher-lexique") return;
  const q = (info.selectionText || "").trim().replace(/\s+/g, " ").slice(0, MAX_LEN);
  if (!q) return;
  const url = new URL(LEXIQUE_URL);
  url.searchParams.set("q", q);
  chrome.tabs.create({ url: url.href, index: tab ? tab.index + 1 : undefined });
});
