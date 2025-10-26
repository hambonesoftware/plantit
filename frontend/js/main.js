import { initShell } from "./views/_shell.js";
import { createRouter } from "./router.js";
import { createToastManager } from "./ui/toast.js";
import { createAPIClient } from "./services/apiClient.js";
import { createRequestQueue } from "./services/requestQueue.js";
import { emit, subscribe } from "./state.js";
import { HomeVM } from "./viewmodels/HomeVM.js";
import { createHomeView } from "./views/home-view.js";
import { VillageVM } from "./viewmodels/VillageVM.js";
import { createVillageView } from "./views/village-view.js";
import { PlantVM } from "./viewmodels/PlantVM.js";
import { createPlantView } from "./views/plant-view.js";
import { TasksVM } from "./viewmodels/TasksVM.js";
import { createTasksView } from "./views/tasks-view.js";
import { createExportImportView } from "./views/export-import.js";

const shell = initShell();
createToastManager();
const requestQueue = createRequestQueue();
export const apiClient = createAPIClient({ baseUrl: "/api/v1", requestQueue });

let queueRefreshHandle = null;
function scheduleDashboardRefresh() {
  if (queueRefreshHandle) {
    return;
  }
  queueRefreshHandle = setTimeout(() => {
    queueRefreshHandle = null;
    homeVM.loadDashboard().catch((error) => console.error("Failed to refresh dashboard after sync", error));
  }, 300);
}

if (typeof window !== "undefined") {
  window.addEventListener("offline", () => {
    emit("toast", { type: "warning", message: "You are offline. Changes will sync when back online." });
  });
  window.addEventListener("online", () => {
    emit("toast", { type: "success", message: "Back online. Resuming sync." });
  });
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/js/pwa/sw.js")
        .catch((error) => console.error("Service worker registration failed", error));
    });
  }
}

const defaultSidebar = () => {
  const wrapper = document.createElement("section");
  wrapper.innerHTML = `
    <h2>Today</h2>
    <p>Stay tuned! Detailed widgets will appear here as features land.</p>
  `;
  return wrapper;
};

const setDefaultSidebar = () => shell.setSidebar(defaultSidebar());
setDefaultSidebar();

const homeVM = new HomeVM({ apiClient });
subscribe("requestQueue:success", (entry) => {
  if (!entry || typeof entry.path !== "string") {
    return;
  }
  if (entry.path.includes("/tasks") || entry.path.includes("/plants") || entry.path.includes("/villages")) {
    scheduleDashboardRefresh();
  }
});

function placeholderView({ title, description, sidebar }) {
  return {
    mount(target) {
      target.innerHTML = `
        <section>
          <header>
            <h1>${title}</h1>
            <p>${description}</p>
          </header>
        </section>
      `;
      const sidebarContent = typeof sidebar === "function" ? sidebar() : sidebar;
      if (sidebarContent) {
        shell.setSidebar(sidebarContent);
      } else {
        setDefaultSidebar();
      }
    },
    unmount() {
      setDefaultSidebar();
    },
  };
}

const router = createRouter({
  outlet: shell.main,
  routes: [
    {
      path: "/",
      loader: async () =>
        createHomeView({
          vm: homeVM,
          shell,
          resetSidebar: setDefaultSidebar,
        }),
    },
    {
      path: "/v/:id",
      loader: async ({ params }) => {
        const vm = new VillageVM({ apiClient, villageId: Number(params.id) });
        return createVillageView({ vm, shell, resetSidebar: setDefaultSidebar });
      },
    },
    {
      path: "/p/:id",
      loader: async ({ params }) => {
        const vm = new PlantVM({ apiClient, plantId: Number(params.id) });
        return createPlantView({ vm, shell, resetSidebar: setDefaultSidebar });
      },
    },
    {
      path: "/tasks",
      loader: async () => {
        const vm = new TasksVM({ apiClient });
        return createTasksView({ vm, shell, resetSidebar: setDefaultSidebar });
      },
    },
    {
      path: "/settings",
      loader: async () =>
        createExportImportView({ apiClient, shell, resetSidebar: setDefaultSidebar }),
    },
  ],
  notFound: async () => ({
    mount(target) {
      target.innerHTML = `
        <section>
          <h1>Page not found</h1>
          <p>The page you are looking for does not exist.</p>
        </section>
      `;
      setDefaultSidebar();
    },
  }),
});

subscribe("router:navigated", () => {
  shell.focusMain();
});

const searchForm = document.querySelector(".app-shell__search");
if (searchForm) {
  searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(searchForm);
    const query = (formData.get("q") || "").toString().trim();
    if (query.length === 0) {
      return;
    }
    emit("toast", {
      type: "info",
      message: `Search for "${query}" is coming soon!`,
    });
  });
}

router.handleNavigation(router.getCurrentPath());

export { router };
