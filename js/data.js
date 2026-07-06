// ─── SUPABASE + STATE ────────────────────────────────────────────────────────
const SUPA_URL = 'https://zijkjeogvqcjasgcdgna.supabase.co';
const SUPA_KEY = 'sb_publishable_Yfuvwevi6LnzYh1dKRZ6IA_2KFeGtbI';
let supa = null;
try{ supa = window.supabase.createClient(SUPA_URL, SUPA_KEY); }catch(e){}

let storageReady = false;

async function loadState(){
  if(supa){
    try{
      const { data, error } = await supa.from('retroplanning_state').select('data').eq('id','shared').single();
      if(!error && data && data.data){
        storageReady = true;
        const parsed = data.data;
        if(parsed.innovations && parsed.innovations.length) return parsed;
      }
    }catch(e){}
  }
  try{const d=localStorage.getItem('upsa_retro2');if(d)return JSON.parse(d);}catch(e){}
  return {
    innovations:[{
      id:'inno1', name:'Optifen Dolo Duo (example)', category:'Co-marketing Spirig', resp:'Grégoire',
      color:'#4a3aa7', mode:'backward', anchorDate:'2027-06-01',
      phases: [deepCopy(COMARKETING_PHASE), ...deepCopy(DEFAULT_PHASES_CORE)]
    }],
    selectedId:'inno1'
  };
}

let saveTimer = null;
async function save(){
  try{localStorage.setItem('upsa_retro2',JSON.stringify(S));}catch(e){}
  setSyncStatus('saving');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async ()=>{
    if(supa){
      try{
        const { error } = await supa.from('retroplanning_state')
          .upsert({ id:'shared', data:S, updated_at:new Date().toISOString() });
        setSyncStatus(!error);
      }catch(e){ setSyncStatus(false); }
    } else {
      setSyncStatus(false);
    }
  }, 400);
}

function setSyncStatus(state){
  const b = document.getElementById('syncBanner');
  const t = document.getElementById('syncText');
  b.classList.remove('offline');
  if(state==='saving'){ t.textContent='Saving…'; }
  else if(state===true){ b.classList.remove('offline'); t.textContent="Synced — data shared with the whole team"; }
  else { b.classList.add('offline'); t.textContent='Local mode — team connection unavailable, data saved on this device only'; }
}