class RequestScheduler {
  constructor(minIntervalMs = CONFIG.REQUEST_INTERVAL_MS) {
    this.queue = [];
    this.minInterval = minIntervalMs;
    this.lastRequestTime = 0;
    this.processing = false;
    this._onProgress = null;
  }

  onProgress(fn) {
    this._onProgress = fn;
  }

  enqueue(url, useJsonp = true) {
    return new Promise((resolve, reject) => {
      this.queue.push({ url, useJsonp, resolve, reject });
      this.process();
    });
  }

  async process() {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const now = Date.now();
      const waitTime = Math.max(0, this.minInterval - (now - this.lastRequestTime));
      if (waitTime > 0) await new Promise(r => setTimeout(r, waitTime));

      const { url, useJsonp, resolve, reject } = this.queue.shift();
      this.lastRequestTime = Date.now();

      if (this._onProgress) {
        this._onProgress(this.queue.length);
      }

      try {
        const data = useJsonp ? await jsonpFetch(url) : await proxyFetch(url);
        resolve(data);
      } catch (err) {
        reject(err);
      }
    }
    this.processing = false;
  }

  get pendingCount() {
    return this.queue.length;
  }
}

const scheduler = new RequestScheduler();
