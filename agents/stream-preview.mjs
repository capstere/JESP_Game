// Presentation-only batching. Never used as model context, final output or tool input.
export function createStreamPreview({
 render,
 requestFrame=callback=>globalThis.requestAnimationFrame(callback),
 cancelFrame=id=>globalThis.cancelAnimationFrame(id),
 setTimer=(callback,ms)=>globalThis.setTimeout(callback,ms),
 clearTimer=id=>globalThis.clearTimeout(id),
 maxChars=6000,
 fallbackMs=100
}={}){
 if(typeof render!=='function')throw new TypeError('render must be a function');
 if(!Number.isInteger(maxChars)||maxChars<2||maxChars>180000)throw new RangeError('Invalid preview limit');
 if(!Number.isFinite(fallbackMs)||fallbackMs<16||fallbackMs>1000)throw new RangeError('Invalid preview delay');
 let text='',metadata={},dirty=false,disposed=false,pending=null;
 function unschedule(){
  const task=pending;pending=null;
  if(!task)return;
  if(task.frame!==null)cancelFrame(task.frame);
  if(task.timer!==null)clearTimer(task.timer);
 }
 function flush(){
  unschedule();
  if(disposed||!dirty)return;
  dirty=false;render(text,{...metadata});
 }
 function schedule(){
  if(pending)return;
  const task={frame:null,timer:null};pending=task;
  // Identity check prevents canceled callbacks from painting a subsequent request.
  const paint=()=>{if(pending===task)flush();};
  task.frame=requestFrame(paint);
  task.timer=setTimer(paint,fallbackMs);
 }
 return {
  append(token,{role,model}={}){
   if(disposed||typeof token!=='string'||!token)return;
   if(role!==undefined&&metadata.role!==undefined&&role!==metadata.role){text='';metadata={};}
   if(role!==undefined)metadata.role=role;
   if(model!==undefined)metadata.model=model;
   text=(text+token).slice(-maxChars);
   // A preview tail must not start halfway through a UTF-16 surrogate pair.
   if(/^[\uDC00-\uDFFF]/.test(text))text=text.slice(1);
   dirty=true;schedule();
  },
  reset(meta={}){
   if(disposed)return;
   unschedule();text='';metadata={...meta};dirty=false;
   render('',{...metadata});
  },
  flush,
  dispose(){
   unschedule();disposed=true;dirty=false;text='';metadata={};
  }
 };
}
