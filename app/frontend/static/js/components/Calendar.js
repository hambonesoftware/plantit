export function Calendar(calendarVM){
  const wrap = document.createElement('div');
  wrap.className = 'calendar';
  const header = document.createElement('div');
  header.textContent = 'Calendar';
  wrap.appendChild(header);
  const grid = document.createElement('div');
  grid.className = 'grid';
  const days = ['S','M','T','W','T','F','S'];
  for(const d of days){
    const h = document.createElement('div');
    h.style.fontSize='12px'; h.style.textAlign='center'; h.textContent=d;
    grid.appendChild(h);
  }
  // naive: render 1..31 squares, add dots if present
  for(let i=1;i<=31;i++){
    const cell = document.createElement('div');
    cell.className = 'day';
    cell.textContent = i;
    const dotInfo = calendarVM.dots.find(x=>x.day===i);
    if(dotInfo){
      const dot = document.createElement('div');
      dot.className = 'dot';
      dot.title = dotInfo.count+' tasks';
      cell.appendChild(dot);
    }
    grid.appendChild(cell);
  }
  wrap.appendChild(grid);
  return wrap;
}
