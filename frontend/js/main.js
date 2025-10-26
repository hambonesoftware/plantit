import { initShell } from "./views/_shell.js";
import { createRouter } from "./router.js";
import { createToastManager } from "./ui/toast.js";
import { createAPIClient } from "./services/apiClient.js";
import { emit, subscribe } from "./state.js";
import { HomeVM } from "./viewmodels/HomeVM.js";
import { createHomeView } from "./views/home-view.js";
import { VillageVM } from "./viewmodels/VillageVM.js";
import { createVillageView } from "./views/village-view.js";

const shell = initShell();
createToastManager();
export const apiClient = createAPIClient({ baseUrl: "/api/v1" });

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
      loader: async ({ params }) => placeholderView({
        title: `Plant ${params.id}`,
        description: "Plant detail appears after Phase 08.",
      }),
    },
    {
      path: "/tasks",
      loader: async () => placeholderView({
        title: "Tasks",
        description: "Track upcoming plant care tasks here soon.",
      }),
    },
    {
      path: "/settings",
      loader: async () => placeholderView({
        title: "Settings",
        description: "Configure Plantit preferences and data export options.",
      }),
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
