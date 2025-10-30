const searchParams = new URLSearchParams(window.location.search);
const disableServiceWorkers = searchParams.get("no-sw") === "1";
const explicitSafeBoot = searchParams.get("safe") === "1";
const safeBoot = explicitSafeBoot || disableServiceWorkers;

const unregisterServiceWorkers = async () => {
  if (!disableServiceWorkers || !("serviceWorker" in navigator)) {
    return;
  }

  console.info("Boot: service worker disable requested");

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    if (registrations.length === 0) {
      console.info("Boot: no service workers to unregister");
      return;
    }

    await Promise.all(
      registrations.map(async (registration) => {
        await registration.unregister();
      })
    );
    console.info("Boot: service workers unregistered");
  } catch (error) {
    console.warn("Boot: failed to unregister service workers", error);
  }
};

const createSafeModeBanner = () => {
  if (!safeBoot) {
    return null;
  }

  const banner = document.createElement("div");
  banner.id = "safe-mode-banner";
  banner.textContent = "Safe Mode — Router/Store disabled.";
  Object.assign(banner.style, {
    backgroundColor: "#7f1d1d",
    color: "#ffffff",
    fontWeight: "bold",
    padding: "0.75rem 1rem",
    textAlign: "center",
    width: "100%",
  });
  return banner;
};

console.info("Boot: pre-init");

unregisterServiceWorkers();

const onReady = () => {
  console.info("Boot: DOM ready");
  const root = document.getElementById("app");
  if (!root) {
    console.warn("Boot: missing #app root");
  } else if (safeBoot) {
    const banner = createSafeModeBanner();
    if (banner) {
      document.body.prepend(banner);
      root.style.marginTop = "1rem";
    }
    root.textContent = "Plantit — Safe Shell";
  } else {
    root.textContent = "Plantit — Shell Ready";
  }
  console.info("Boot: shell mounted");
};

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", onReady, { once: true });
} else {
  onReady();
}

export { safeBoot };
