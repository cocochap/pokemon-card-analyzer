export class RateLimiter {
  private queue: Array<() => void> = []
  private timestamps: number[] = []
  private readonly maxRequests: number
  private readonly windowMs: number

  constructor({ maxRequests, windowMs }: { maxRequests: number; windowMs: number }) {
    this.maxRequests = maxRequests
    this.windowMs = windowMs
  }

  async acquire(): Promise<void> {
    return new Promise((resolve) => {
      this.queue.push(resolve)
      this.process()
    })
  }

  private process() {
    if (this.queue.length === 0) return

    const now = Date.now()
    this.timestamps = this.timestamps.filter((t) => now - t < this.windowMs)

    if (this.timestamps.length < this.maxRequests) {
      this.timestamps.push(now)
      const resolve = this.queue.shift()!
      resolve()
    } else {
      const oldest = this.timestamps[0]
      const wait = this.windowMs - (now - oldest)
      setTimeout(() => this.process(), wait + 100)
    }
  }
}
