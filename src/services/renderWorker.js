import { Worker } from 'node:worker_threads';

const MAX_ACTIVE_WORKERS = 2;
const WORKER_TIMEOUT_MS = 60_000;
const pendingJobs = [];
let activeWorkers = 0;

/**
 * Run CPU-heavy schematic work away from the Discord event loop.
 * Supported tasks: "analyze" (gzip/NBT decode + block extraction) and
 * "render" (2400×1800 PNG rasterization).
 */
export function runRenderWorker(task, payload = {}) {
  return new Promise((resolve, reject) => {
    pendingJobs.push({ task, payload, resolve, reject });
    dispatchNext();
  });
}

function dispatchNext() {
  while (activeWorkers < MAX_ACTIVE_WORKERS && pendingJobs.length) {
    const job = pendingJobs.shift();
    activeWorkers++;
    executeJob(job);
  }
}

function executeJob(job) {
  let worker;
  let settled = false;
  let timeout;

  const finish = (error, result) => {
    if (settled) return;
    settled = true;
    clearTimeout(timeout);
    activeWorkers = Math.max(0, activeWorkers - 1);
    if (error) job.reject(error);
    else job.resolve(result);
    dispatchNext();
  };

  try {
    const workerData = { task: job.task, ...job.payload };
    const transferList = [];

    // Transfer a compact exact copy of the uploaded bytes to avoid cloning a
    // Buffer's potentially oversized backing store.
    if (job.task === 'analyze') {
      const input = Uint8Array.from(job.payload.input);
      workerData.input = input;
      transferList.push(input.buffer);
    }

    worker = new Worker(new URL('./renderWorkerThread.js', import.meta.url), {
      workerData,
      transferList
    });

    timeout = setTimeout(() => {
      worker.terminate()
        .then(() => finish(new Error('Schematic processing exceeded the 60-second worker limit.')))
        .catch(error => finish(error));
    }, WORKER_TIMEOUT_MS);

    worker.once('message', message => {
      if (!message?.ok) {
        return finish(new Error(message?.error?.message || 'Schematic worker failed.'));
      }

      let result = message.result;
      if (job.task === 'render') {
        result = Buffer.from(result);
      }
      finish(null, result);
    });

    worker.once('error', error => finish(error));
    worker.once('exit', code => {
      if (!settled) {
        finish(new Error(code === 0
          ? 'Schematic worker exited without returning a result.'
          : 'Schematic worker exited unexpectedly with code ' + code + '.'));
      }
    });
  } catch (error) {
    finish(error);
  }
}
