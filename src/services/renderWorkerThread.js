import { parentPort, workerData } from 'node:worker_threads';
import { analyze, makePng } from '../commands/Tools/render.js';

function sendResult(result) {
  if (Buffer.isBuffer(result) || result instanceof Uint8Array) {
    const transferable = new Uint8Array(result.byteLength);
    transferable.set(result);
    parentPort.postMessage({ ok: true, result: transferable.buffer }, [transferable.buffer]);
    return;
  }
  parentPort.postMessage({ ok: true, result });
}

try {
  if (!parentPort) throw new Error('Schematic worker has no parent message port.');

  let result;
  if (workerData.task === 'analyze') {
    result = analyze(Buffer.from(workerData.input));
  } else if (workerData.task === 'render') {
    result = makePng(workerData.data, workerData.pov, workerData.textureMap);
  } else {
    throw new Error('Unsupported schematic worker task: ' + String(workerData.task));
  }

  sendResult(result);
} catch (error) {
  parentPort?.postMessage({
    ok: false,
    error: {
      message: error instanceof Error ? error.message : String(error)
    }
  });
}
