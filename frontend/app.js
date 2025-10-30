const searchParams = new URLSearchParams(window.location.search);
const safeBoot = searchParams.get("safe") === "1";

console.info("Boot: pre-init");

const onReady = () => {
  console.info("Boot: DOM ready");
  const root = document.getElementById("app");
  if (!root) {
    console.warn("Boot: missing #app root");
  } else if (safeBoot) {
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
