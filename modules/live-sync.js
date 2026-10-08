/* Shared read-only refresh controls. Never copy teacher data over admin data. */
(() => {
    let running=false, lastSuccess='', timer;
    const visible=el=>el&&!el.classList.contains('hidden')&&el.getClientRects().length>0;
    function busyEditing(){
        return phase10PendingPbdWrites.size>0||phase10PendingScoreWrites.size>0||
            (visible(document.getElementById('view-pbd'))&&pbdManualEditMode)||
            (visible(document.getElementById('view-marks'))&&marksManualEditMode)||
            [...document.querySelectorAll('[id^="modal-"]')].some(visible)||
            !!document.activeElement?.matches('input,textarea,[contenteditable="true"]');
    }
    function status(text){
        document.querySelectorAll('.live-sync-status').forEach(el=>el.textContent=text);
        document.querySelectorAll('.live-sync-button').forEach(el=>el.disabled=running);
    }
    function stamp(){
        lastSuccess=new Date().toLocaleTimeString('ms-MY',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
        status('Data dikemas kini '+lastSuccess);
    }
    function install(){
        document.querySelectorAll('[id^="view-"]').forEach(view=>{
            if(view.querySelector(':scope > .live-sync-toolbar'))return;
            const bar=document.createElement('div');
            bar.className='live-sync-toolbar';
            const label=document.createElement('span');
            label.className='live-sync-status';label.setAttribute('role','status');
            label.textContent=lastSuccess?'Data dikemas kini '+lastSuccess:'Auto semak setiap 30 saat apabila tidak mengedit';
            const button=document.createElement('button');
            button.type='button';button.className='live-sync-button';button.textContent='↻ Muat semula data';
            button.addEventListener('click',()=>refresh(true));
            bar.append(label,button);view.prepend(bar);
        });
    }
    async function refresh(manual=false){
        install();
        if(running)return false;
        if(!phase10Db||!phase10SignedInUser){
            if(manual)status('Sila log masuk untuk menarik data terkini.');
            return false;
        }
        if(busyEditing()){
            status('Selesaikan Simpan / tutup borang dahulu. Refresh ditangguhkan.');
            return false;
        }
        if(!navigator.onLine){status('Tiada internet — data belum diselaraskan.');return false;}
        running=true;status('Sedang menarik data terkini…');
        try{
            const ok=await phase10LoadRemoteState(phase10CurrentFirebaseProfile||{role:currentUserRole,id:currentUserId},false);
            if(!ok){status('Refresh belum berjaya. Cuba semula; paparan mungkin belum terkini.');return false;}
            if(!busyEditing()){
                phase10ScheduleUiRefresh();
                const view=[...document.querySelectorAll('[id^="view-"]')].find(visible)?.id.slice(5);
                if(view==='analytics-student')initializeStudentProfile();
                if(view==='analytics-class')initializeClassComparison();
                if(view==='intervention')initializeInterventionModule();
                // Generated reports stay unchanged until the user generates them again.
            }
            stamp();return true;
        }catch(error){
            console.warn('Refresh data:',error);
            status('Refresh gagal. Semak sambungan dan cuba semula.');
            return false;
        }finally{running=false;document.querySelectorAll('.live-sync-button').forEach(el=>el.disabled=false);}
    }
    window.iSejarahLiveSync={refresh,busyEditing,stamp,install};
    function start(){
        install();
        timer=setInterval(()=>{if(document.visibilityState==='visible')refresh(false);},30000);
        window.addEventListener('online',()=>refresh(false));
        window.addEventListener('focus',()=>refresh(false));
        document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refresh(false);});
        window.addEventListener('pagehide',()=>clearInterval(timer),{once:true});
    }
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
