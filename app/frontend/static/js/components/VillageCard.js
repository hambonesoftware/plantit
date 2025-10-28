export function VillageCard(vm){
  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML = `
    <div class="img"></div>
    <div class="body">
      <h4 class="title">${vm.name}</h4>
      <div class="row">
        <span class="badge green">Due today ${vm.due_today}</span>
        <span class="badge ${vm.overdue>0?'red':'gray'}">${vm.overdue>0?vm.overdue+' overdue':'0 overdue'}</span>
      </div>
      <div class="meta">Last watered ${vm.last_watered_human}</div>
      <div class="actions">
        <button class="btn">Open</button>
        <button class="btn">Quick add plant</button>
      </div>
    </div>
  `;
  return card;
}
