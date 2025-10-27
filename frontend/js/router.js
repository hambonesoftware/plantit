import { renderHomeView } from "./views/home-view.js";
import { renderVillagesView } from "./views/villages-view.js";
import { renderVillageDetailView } from "./views/village-detail-view.js";
import { renderPlantDetailView } from "./views/plant-detail-view.js";

const rootElement = document.getElementById("app-main");

const routes = [
  { pattern: /^#\/$/, handler: () => renderHomeView(rootElement) },
  { pattern: /^#\/villages$/, handler: () => renderVillagesView(rootElement) },
  {
    pattern: /^#\/villages\/(.+)$/,
    handler: (match) => renderVillageDetailView(rootElement, match[1]),
  },
  {
    pattern: /^#\/plants\/(.+)$/,
    handler: (match) => renderPlantDetailView(rootElement, match[1]),
  },
];


function handleNavigation() {
  const hash = window.location.hash || "#/";
  for (const route of routes) {
    const match = hash.match(route.pattern);
    if (match) {
      route.handler(match);
      rootElement.focus();
      return;
    }
  }
  window.location.hash = "#/";
}

window.addEventListener("hashchange", handleNavigation);
window.addEventListener("DOMContentLoaded", handleNavigation);
