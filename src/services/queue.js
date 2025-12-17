import { Queue, Worker } from 'bullmq';

// Since we are aiming for serverless without a guaranteed Redis, 
// we will implement a simple in-memory concurrency limiter (P-Limit style) 
// for the duration of the lambda execution. 
// If a Redis connection IS provided, we could conceptually use BullMQ, 
// but setting up a full worker pattern in Vercel functions is tricky (usually requires separate worker).
// Only "web scraping tasks" need this.

class InMemoryQueue {
    constructor(concurrency = 5) {
        this.concurrency = concurrency;
        this.running = 0;
        this.queue = [];
    }

    async add(task) {
        return new Promise((resolve, reject) => {
            this.queue.push({ task, resolve, reject });
            this.process();
        });
    }

    async process() {
        if (this.running >= this.concurrency || this.queue.length === 0) {
            return;
        }

        this.running++;
        const { task, resolve, reject } = this.queue.shift();

        try {
            const result = await task();
            resolve(result);
        } catch (err) {
            reject(err);
        } finally {
            this.running--;
            this.process();
        }
    }
}

// Exports a singleton queue for scraping operations
export const scrapeQueue = new InMemoryQueue(parseInt(process.env.QUEUE_MAX || 5));
