import { HomeThinVM } from "../thinvms/HomeThinVM.js";

export function renderHomeView(root) {
  const vm = new HomeThinVM();
  const section = document.createElement("section");
  section.className = "card";
  section.innerHTML = `
    <h2>Overview</h2>
    <div data-state="content">
      <p>Loading...</p>
    </div>
  `;
  root.replaceChildren(section);

  const content = section.querySelector('[data-state="content"]');

  vm.subscribe((state) => {
    if (state.loading) {
      content.innerHTML = "<p>Loading...</p>";
      return;
    }
    if (state.error) {
      content.innerHTML = `<p role="alert">${state.error}</p>`;
      return;
    }
    const { villages, plants } = state.data;
    content.innerHTML = `
      <p><strong>Villages:</strong> ${villages.total}</p>
      <p><strong>Plants:</strong> ${plants.total}</p>
    `;
  });

  vm.load();
}
