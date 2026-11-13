// Local-game protections. An account-backed authoritative server would be needed
// to resist edited browser storage or a changed device clock.
let economyInstalled=false,economyBusy=false;
function awardVerifiedWin(entry){
 if(entry.rewardCounted||entry.manual||entry.marketType==='forecast'||entry.gradeSource?.startsWith('User')||entry.stake<25)return false;
 const legs=entry.legs||[entry];
 if(legs.some(l=>l.manual||l.status==='refunded'||l.gradeSource?.startsWith('User')))return false;
 const probabilities=legs.map(l=>l.oddsSnapshot?.probability??l.modelProbability??(l.marketType==='winner'||!l.marketType?state.slate.find(m=>m.id===l.matchId)?.prob?.[l.option]:undefined));
 // Unknown or extremely likely picks do not generate reward progress.
 if(probabilities.some(p=>!Number.isFinite(p)||p>.8))return false;
 const games=[...new Set(legs.map(l=>l.matchId))];
 if(games.some(id=>!id))return false;
 state.rewardGames=state.rewardGames||state.history.filter(e=>e.earned).flatMap(e=>(e.legs||[e]).map(l=>l.matchId));
 if(games.some(id=>state.rewardGames.includes(id)))return false;
 entry.rewardCounted=true;state.rewardGames.push(...games);state.qualifyingWins=(state.qualifyingWins||0)+1;
 if(state.qualifyingWins>=3&&(!state.rewardPackDate||state.rewardPackDate<dateKey())){state.qualifyingWins-=3;state.free++;state.rewardPackDate=dateKey();entry.earned=true;return true}
 // Do not bank an unlimited backlog of free packs while today's cap is active.
 state.qualifyingWins=Math.min(3,state.qualifyingWins);return false;
}
async function guardedEconomyAction(action,args=[],resolveArgs){
 if(economyBusy){toast('Another reward or pick is being saved. Try again shortly.');return false}
 if(!navigator.locks?.request){toast('Update your browser to securely save coins and packs.');return false}
 economyBusy=true;
 try{return await navigator.locks.request('bigger-bets-economy-v1',{ifAvailable:true},async lock=>{
  if(!lock){toast('Another tab is saving your game. Try again shortly.');return false}
  const raw=localStorage.getItem('bigger-bets-v1');if(raw){const latest=JSON.parse(raw);if((latest.revision||0)>=(state.revision||0))state=latest}
  return await action(...(resolveArgs?resolveArgs(args):args));
 })}catch(error){toast('Could not save this action. Refresh before trying again.');return false}finally{economyBusy=false}
}
async function revealPackCard(packId,index){return guardedEconomyAction(()=>{const p=state.pendingPack;if(!p||p.id!==packId||!Number.isInteger(index)||index<0||index>2)return false;p.revealed[index]=true;save();showPack();return true})}
async function resetProgress(){if(!confirm('Reset all coins, cards and picks on this device? Your current collection will be erased.'))return;return guardedEconomyAction(()=>{const revision=state.revision||0;state=initial();state.revision=revision;state.liveVersion=1;save();render();loadLiveBoard();toast('Fresh start · your old collection was erased.')})}
function installEconomyGuards(){if(economyInstalled)return;economyInstalled=true;
 if(state.pendingPack&&!state.pendingPack.id){state.pendingPack.id='legacy:'+state.pendingPack.cards.map(c=>c.uid).join('|');save()}
 const wrap=f=>(...args)=>guardedEconomyAction(f,args);
 buyPack=wrap(buyPack);finishPack=wrap(finishPack);claimDaily=wrap(claimDaily);
 place=wrap(place);saveGameMarket=wrap(saveGameMarket);placeParlay=wrap(placeParlay);resolvePending=wrap(resolvePending);
 resolveManualForecast=wrap(resolveManualForecast);
 const originalBracket=settleBracket;settleBracket=b=>guardedEconomyAction(current=>current?originalBracket(current):false,[b],args=>[state.brackets?.find(x=>x.id===args[0]?.id)]);
}
