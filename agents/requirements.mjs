// User instructions outrank speculative criteria from a planning/review model.
// Deterministic narrow safeguards, not semantic proof for arbitrary tasks.
const fps=/\b(?:fps|first[- ]person|förstaperson)\b/i;
const target=/(?:synlig(?:t|a)?\s+(?:initial(?:t|a)?\s+)?mål|(?:visible|initial|starting)\s+(?:target|enemy)|\bmål(?:et)?\b|\btarget\b)/i;
const shooting=/(?:skjut|skott|mellanslag|\bshoot|\bfire|\bspace\b)/i;
const wall=/(?:vägg|\bwalls?\b)/i;
export function userRequiresTarget(question='') {
 return fps.test(question)&&target.test(question)&&shooting.test(question);
}
export const shootingTargetCriterion='När användaren trycker mellanslag skjuts det synliga målet framför spelaren redan från startläget; poäng ökar vid målträff, inte enbart vid väggträff.';
export function enforceUserContract(contract,question='') {
 const notices=[];
 if(!contract||!userRequiresTarget(question))return {contract,notices};
 const result={...contract,criteria:[...(contract.criteria||[])]};
 const incompatible=c=>shooting.test(c.requirement||'')&&wall.test(c.requirement||'')&&!target.test(c.requirement||'');
 result.criteria=result.criteria.map(c=>{
  if(!incompatible(c))return c;
  notices.push({kind:'criterion',id:c.id,previous:c.requirement,replacement:shootingTargetCriterion});
  return {...c,requirement:shootingTargetCriterion};
 });
 if(!result.criteria.some(c=>shooting.test(c.requirement||'')&&target.test(c.requirement||''))) {
  const id='C'+(result.criteria.length+1);
  if(result.criteria.length>=5){
   const index=result.criteria.findIndex(c=>!/(?:\bW\b|\bA\b|\bS\b|\bD\b|r\s*key|reset|canvas|raycast)/i.test(c.requirement));
   const i=index>=0?index:result.criteria.length-1;
   const previous=result.criteria[i];result.criteria[i]={...previous,requirement:shootingTargetCriterion};
   notices.push({kind:'criterion',id:previous.id,previous:previous.requirement,replacement:shootingTargetCriterion});
  }else{result.criteria.push({id,requirement:shootingTargetCriterion});notices.push({kind:'missing_user_requirement',id,replacement:shootingTargetCriterion});}
 }
 if(wall.test(result.objective||'')&&shooting.test(result.objective||'')) {
  notices.push({kind:'objective',previous:result.objective});
  result.objective=String(question).slice(0,360);
 }
 return {contract:result,notices};
}
export function unsupportedReviewerIssue(issue,question='') {
 return userRequiresTarget(question)&&shooting.test(issue)&&wall.test(issue)&&!/(?:mål|target|inte|not|wrong|incorrect|felakt|erroneous|bug|problem|misstag|bör inte|should not)/i.test(issue);
}