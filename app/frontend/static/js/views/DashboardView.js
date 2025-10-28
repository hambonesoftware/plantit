import {api} from '../apiClient.js';
import {VillageCard} from '../components/VillageCard.js';
import {Calendar} from '../components/Calendar.js';

export async function DashboardView(){
  const data = await api.get('/api/vm/dashboard');
  const cards = document.getElementById('cards');
  cards.innerHTML = '';
  for(const v of data.villages){
    cards.appendChild(VillageCard(v));
  }

  const right = document.getElementById('right-panel');
  right.innerHTML = '<h3>Today</h3>';
  for(const t of data.today){
    const row = document.createElement('div');
    row.className = 'todo';
    row.innerHTML = `
      <input type="checkbox" data-id="${t.id}">
      <div>
        <div><strong>${t.plant_name}</strong> — ${t.kind}</div>
        <div class="meta">${t.village_name} ${t.overdue_days>0?'<span class="overdue">— overdue '+t.overdue_days+'d</span>':''}</div>
      </div>`;
    row.querySelector('input').addEventListener('change', async (e)=>{
      if(e.target.checked){
        await api.post('/api/tasks/'+t.id+'/complete', {});
        DashboardView(); // refresh
      }
    });
    right.appendChild(row);
  }
  right.appendChild(Calendar(data.calendar));
}
