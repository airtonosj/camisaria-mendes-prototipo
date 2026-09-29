/** A serial periodic worker. stop() prevents new work and waits for in-flight work. */
export function startWorker(work, intervalMs, reportError) {
  let stopped=false, pending=null;
  const run=()=>{
    if(stopped||pending)return;
    pending=Promise.resolve().then(work).catch(reportError).finally(()=>{pending=null;});
  };
  run();
  const timer=setInterval(run,intervalMs);timer.unref();
  return async ()=>{stopped=true;clearInterval(timer);await pending;};
}
