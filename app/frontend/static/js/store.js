export const Store = {
  listeners: new Set(),
  state: { },
  on(fn){ this.listeners.add(fn); return ()=>this.listeners.delete(fn)},
  emit(){ for(const fn of this.listeners) fn(this.state) }
};
