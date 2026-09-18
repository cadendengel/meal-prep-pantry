/**
 * Stub for tesseract.js, used only by the end-to-end suite.
 *
 * Real OCR is slow and its output varies with rendering, fonts and image
 * compression, which makes it unusable as a regression signal. Everything
 * around the recognition step is worth testing though: file validation,
 * the progress indicator, applying the parsed values, error handling and
 * worker cleanup. This stub makes the recognition step deterministic so
 * those can be tested.
 *
 * A test drives it through `window.__E2E_OCR__`:
 *
 *   text            the text recognize() resolves with
 *   throwOnCreate   createWorker rejects
 *   throwOnRecognize  recognize rejects
 *   errorMessage    the message those rejections carry
 *   delayMs         how long recognition takes, for observing progress
 *
 * It also records calls on `window.__E2E_OCR_CALLS__`, so a test can
 * assert that the worker was terminated.
 *
 * Run the suite with E2E_REAL_OCR=1 to use the real library instead.
 */

function config() {
  if (typeof window === 'undefined') return {};
  return window.__E2E_OCR__ || {};
}

function record(event) {
  if (typeof window === 'undefined') return;
  window.__E2E_OCR_CALLS__ = window.__E2E_OCR_CALLS__ || [];
  window.__E2E_OCR_CALLS__.push(event);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Stand in for tesseract.js createWorker.
 *
 * @param {string} language - Language code, as the real API takes
 * @param {number} oem - Engine mode, unused here
 * @param {{logger?: Function}} [options] - Progress logger
 * @returns {Promise<{recognize: Function, terminate: Function}>} A fake worker
 */
export async function createWorker(language, oem, options = {}) {
  record({ type: 'createWorker', language });

  const settings = config();
  if (settings.throwOnCreate) {
    throw new Error(settings.errorMessage || 'worker failed to start');
  }

  return {
    async recognize() {
      record({ type: 'recognize' });
      const current = config();
      const delay = current.delayMs ?? 0;

      // The real logger reports progress during recognition.
      if (typeof options.logger === 'function') {
        for (const progress of [0, 0.5, 1]) {
          options.logger({ status: 'recognizing text', progress });
          if (delay) await sleep(delay / 3);
        }
      } else if (delay) {
        await sleep(delay);
      }

      if (current.throwOnRecognize) {
        throw new Error(current.errorMessage || 'recognition failed');
      }

      return { data: { text: current.text ?? '' } };
    },

    async terminate() {
      record({ type: 'terminate' });
    },
  };
}

export default { createWorker };
