function withinGameWindow(m,now=Date.now()){const gap=new Date(m?.date).getTime()-now;return gap>0&&gap<=48*60*60*1000}
function gamePickWindowText(m){return new Date(m.date).getTime()>Date.now()+48*60*60*1000?'OPENS '+new Date(new Date(m.date).getTime()-48*60*60*1000).toLocaleString('en-US',{timeZone:'America/Chicago',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})+' CT · 48H BEFORE START':'PICKS CLOSED'}
function findGamePick(m){return state.history.find(e=>e.matchId===m.id||e.marketType==='parlay'&&e.legs?.some(l=>l.matchId===m.id))}
function gameCardClosed(m){return !withinGameWindow(m)||m.status!=='pre'||m.completed||m.voided||m.postponed||new Date(m.date).getTime()<=Date.now()||state.history.some(e=>!e.marketType&&e.matchId===m.id)}
function gameCardOutline(m){return gameCardClosed(m)?findGamePick(m)?'gameClosedPicked':'gameClosedEmpty':''}
function gameCardLabel(m){if(m.status==='pre'&&!m.voided&&!m.postponed&&new Date(m.date).getTime()>Date.now()+48*60*60*1000)return findGamePick(m)?'✓ PICK SAVED · WINDOW CLOSED':gamePickWindowText(m);return gameCardClosed(m)?findGamePick(m)?'✓ CLOSED · YOU PLACED A BET':'CLOSED · NO BET PLACED':'OPEN FOR PICKS'}
let fastScoresBusy=false,fastScoresTimer;const refreshingGameScores=new Set();
function scoreboardTime(m){
 if(m.voided)return 'CANCELED';if(m.completed)return m.statusText&&/final/i.test(m.statusText)?m.statusText:'FINAL';if(m.postponed)return m.statusText||'DELAYED';if(m.status!=='in')return 'UPCOMING';
 const detail=String(m.statusText||'');if(detail&&!/^(in progress|live)$/i.test(detail))return detail;
 const sport=data.leagues.find(l=>l.name===m.league)?.sport,period=Number(m.period);
 if(!period)return 'Game in progress · clock unavailable';
 if(sport==='baseball')return 'Inning '+period;
 const label=sport==='hockey'?'P'+period:sport==='soccer'?'Half '+period:m.league==='College Basketball'?'Half '+period:'Q'+period;
 if(m.clock===undefined||m.clock===null||!Number.isFinite(Number(m.clock)))return label+' · clock unavailable';
 const seconds=Math.max(0,Math.floor(Number(m.clock)));return label+' · '+Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');
}
function scoreboardStatusHTML(m){const live=m.status==='in'&&!m.postponed&&!m.completed&&!m.voided,checked=m.scoreCheckedAt?new Date(m.scoreCheckedAt).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',second:'2-digit'}):'';return `<div class="scoreboardStatus ${live?'liveScoreStatus':''}"><b>${live?'● LIVE · ':''}${esc(scoreboardTime(m))}</b><small>${m.feedStale?'Feed delayed · last reported score':live?'Scores refresh every 15s':''}${checked?' · '+esc(checked):''}</small><button class="subtle refreshGameScore" data-refresh-score="${esc(m.id)}" ${refreshingGameScores.has(m.id)?'disabled':''}>${refreshingGameScores.has(m.id)?'Updating…':'↻ Refresh score'}</button></div>`}
function featuredScoreHTML(m){const h=teams[m.home],a=teams[m.away];return `${scoreboardStatusHTML(m)}<div class="featuredScoreboard"><div>${teamLogo(a)}<span>${esc(a.short)}</span><strong>${m.score[1]}</strong></div><span>AT</span><div>${teamLogo(h)}<span>${esc(h.short)}</span><strong>${m.score[0]}</strong></div></div>`}
async function refreshActiveScores(){
 if(fastScoresBusy||loadingLive||document.hidden||!state)return;const requested=boardDate,leagues=data.leagues.filter(l=>state.slate.some(m=>m.league===l.name&&(m.status==='in'||m.status==='pre'&&new Date(m.date)<=new Date())));if(!leagues.length)return;fastScoresBusy=true;
 try{const results=await Promise.allSettled(leagues.map(async l=>{const raw=await fetchJSON(feedURL(l,requested));if(!Array.isArray(raw.events))throw Error('Missing score feed');return raw.events.map(e=>parseEvent(e,l,requested)).filter(Boolean)}));if(boardDate!==requested)return;
 results.forEach((r,i)=>{const name=leagues[i].name;if(r.status==='fulfilled'){const fresh=new Map(r.value.map(m=>[m.id,m]));state.slate=state.slate.map(m=>m.league!==name?m:fresh.has(m.id)?fresh.get(m.id):{...m,feedStale:true})}else state.slate=state.slate.map(m=>m.league===name?{...m,feedStale:true}:m)});save();renderMatches();renderFeatured();renderMyBets();
 }finally{fastScoresBusy=false}
}
async function liveScoreTick(){try{await refreshActiveScores()}finally{await autoSettlePending()}}
function setupLiveScores(){document.addEventListener('click',e=>{const button=e.target.closest('[data-refresh-score]');if(button)refreshGameScore(button.dataset.refreshScore)});clearInterval(fastScoresTimer);fastScoresTimer=setInterval(liveScoreTick,15000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)liveScoreTick()})}

async function refreshGameScore(id){if(refreshingGameScores.has(id))return;const match=state.slate.find(m=>m.id===id);if(!match)return;refreshingGameScores.add(id);renderMatches();try{const fresh=await lookupRealGame(match);const current=state.slate.findIndex(m=>m.id===id);if(current<0)return;state.slate[current]={...fresh,feedStale:false,scoreCheckedAt:new Date().toISOString()};save();toast('Score refreshed · '+scoreboardTime(fresh));await autoSettlePending();}catch{const current=state.slate.find(m=>m.id===id);if(current){current.feedStale=true;save()}toast('Score feed unavailable. Keeping the last reported score.');}finally{refreshingGameScores.delete(id);renderMatches();renderFeatured()}}
