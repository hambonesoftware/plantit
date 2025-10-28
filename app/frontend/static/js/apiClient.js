export const api = {
  async get(path){
    const res = await fetch(path, {headers:{'Accept':'application/json'}});
    if(!res.ok) throw new Error('GET '+path+' '+res.status);
    return await res.json();
  },
  async post(path, body){
    const res = await fetch(path, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body||{})});
    if(!res.ok) throw new Error('POST '+path+' '+res.status);
    return await res.json();
  }
};
