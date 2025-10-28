function monthLabel(year, month){
  const date = new Date(year, month - 1);
  return date.toLocaleDateString(undefined, {month:'long'});
}

export function Calendar(calendarVM){
  const wrap = document.createElement('section');
  wrap.className = 'calendar';

  const header = document.createElement('header');
  header.innerHTML = `
    <span>${monthLabel(calendarVM.year, calendarVM.month)} ${calendarVM.year}</span>
    <span>${calendarVM.dots.length} task${calendarVM.dots.length===1?'':'s'}</span>
  `;
  wrap.appendChild(header);

  const grid = document.createElement('div');
  grid.className = 'grid';

  const days = ['S','M','T','W','T','F','S'];
  for(const label of days){
    const cell = document.createElement('div');
    cell.className = 'day';
    cell.style.fontWeight = '600';
    cell.style.color = 'var(--muted)';
    cell.textContent = label;
    grid.appendChild(cell);
  }

  const daysInMonth = new Date(calendarVM.year, calendarVM.month, 0).getDate();
  for(let day=1; day<=daysInMonth; day += 1){
    const cell = document.createElement('div');
    cell.className = 'day';
    cell.textContent = day;
    const dotInfo = calendarVM.dots.find((dot)=> dot.day === day);
    if(dotInfo){
      const dot = document.createElement('div');
      dot.className = 'dot';
      dot.title = `${dotInfo.count} task${dotInfo.count===1?'':'s'}`;
      cell.appendChild(dot);
    }
    grid.appendChild(cell);
  }

  wrap.appendChild(grid);
  return wrap;
}
