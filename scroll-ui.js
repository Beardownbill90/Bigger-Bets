function setupScrollUI(){
 const more=$('moreMenu'),trigger=$('openMoreMenu');
 trigger.onclick=()=>more.showModal();$('closeMoreMenu').onclick=()=>more.close();
 more.addEventListener('click',e=>{if(e.target.closest('[data-go]'))more.close()});
 $('menuSeasonTrades').onclick=()=>{more.close();openSeasonTrades()};
 $('backToTop').onclick=()=>window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
 let queued=false;const update=()=>{queued=false;document.body.classList.toggle('pageScrolled',window.scrollY>24);$('backToTop').hidden=window.scrollY<650};
 window.addEventListener('scroll',()=>{if(!queued){queued=true;requestAnimationFrame(update)}},{passive:true});update();
}
