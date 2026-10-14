/**
 * presenterTimer.js — timer presenter (logika murni, `now` di-inject untuk tes).
 * Total berjalan saat Start; waktu per scene diukur dari waktu total saat scene berganti.
 */
export function createTimer(now = () => Date.now()) {
  let acc = 0, t0 = null, sceneMark = 0, scene = null;
  const elapsed = () => acc + (t0 == null ? 0 : now() - t0);
  return {
    get running() { return t0 != null; },
    start() { if (t0 == null) t0 = now(); },
    pause() { if (t0 != null) { acc += now() - t0; t0 = null; } },
    toggle() { if (t0 == null) this.start(); else this.pause(); },
    reset() { acc = 0; sceneMark = 0; if (t0 != null) t0 = now(); },
    /** Catat scene aktif; waktu scene mulai dari nol saat nomor berubah. */
    markScene(n) { if (n !== scene) { scene = n; sceneMark = elapsed(); } },
    /** ms total. */
    total: elapsed,
    /** ms di scene aktif. */
    sceneElapsed() { return elapsed() - sceneMark; },
  };
}

/**
 * Status tampilan timer. @param {number|null|undefined} targetMin target durasi scene (menit; opsional)
 * @returns {{total:number, scene:number, targetMs:number|null, over:boolean, remaining:number|null}}
 */
export function timerView(timer, targetMin) {
  const scene = timer.sceneElapsed(), targetMs = targetMin > 0 ? targetMin * 60000 : null;
  return { total: timer.total(), scene, targetMs, over: targetMs != null && scene > targetMs, remaining: targetMs == null ? null : targetMs - scene };
}
