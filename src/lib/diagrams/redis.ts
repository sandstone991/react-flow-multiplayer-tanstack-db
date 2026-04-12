import "@tanstack/react-start/server-only";

import { createClient } from "redis";

import { env } from "@/env/server";

type RedisClient = ReturnType<typeof createClient>;
type RedisMessageHandler = (message: string) => void;

export const redisChannel = {
	diagramChanges: (diagramId: string) => `diagrams:${diagramId}:changes`,
	presence: (diagramId: string) => `diagrams:${diagramId}:presence`,
};

export const redisKey = {
	presence: (diagramId: string) => `diagrams:${diagramId}:presence`,
};

class RedisChannelSubscription {
	readonly ready: Promise<void>;
	private readonly handlers = new Set<RedisMessageHandler>();
	private readonly listener: RedisMessageHandler = (message) => {
		for (const handler of this.handlers) {
			handler(message);
		}
	};

	constructor(
		readonly channel: string,
		start: (channel: string, listener: RedisMessageHandler) => Promise<void>,
		onStartError: (channel: string, error: unknown) => void,
	) {
		this.ready = start(channel, this.listener).catch((error) => {
			onStartError(channel, error);
		});
	}

	add(handler: RedisMessageHandler): void {
		this.handlers.add(handler);
	}

	delete(handler: RedisMessageHandler): void {
		this.handlers.delete(handler);
	}

	isEmpty(): boolean {
		return this.handlers.size === 0;
	}
}

class DiagramRedisBus {
	private readonly instanceId = crypto.randomUUID();
	private publisherPromise: Promise<RedisClient> | null = null;
	private subscriberPromise: Promise<RedisClient> | null = null;
	private readonly subscriptions = new Map<string, RedisChannelSubscription>();

	isConfigured(): boolean {
		return Boolean(env.REDIS_URL);
	}

	getOriginId(): string {
		return this.instanceId;
	}

	async publish(channel: string, payload: unknown): Promise<void> {
		if (!this.isConfigured()) return;
		const client = await this.getPublisher();
		await client.publish(channel, JSON.stringify(payload));
	}

	subscribe(channel: string, handler: RedisMessageHandler): () => void {
		if (!this.isConfigured()) return () => {};

		let subscription = this.subscriptions.get(channel);
		if (!subscription) {
			subscription = this.createSubscription(channel);
			this.subscriptions.set(channel, subscription);
		}

		subscription.add(handler);

		return () => {
			this.unsubscribeHandler(channel, handler);
		};
	}

	async hashValues(key: string): Promise<string[]> {
		const client = await this.getPublisher();
		return client.hVals(key);
	}

	async hashSet(key: string, field: string, value: string): Promise<void> {
		const client = await this.getPublisher();
		await client.hSet(key, field, value);
	}

	async hashDelete(key: string, field: string): Promise<void> {
		const client = await this.getPublisher();
		await client.hDel(key, field);
	}

	async expire(key: string, seconds: number): Promise<void> {
		const client = await this.getPublisher();
		await client.expire(key, seconds);
	}

	private createSubscription(channel: string): RedisChannelSubscription {
		return new RedisChannelSubscription(
			channel,
			this.startSubscription.bind(this),
			this.handleSubscriptionStartError.bind(this),
		);
	}

	private async startSubscription(
		channel: string,
		listener: RedisMessageHandler,
	): Promise<void> {
		const client = await this.getSubscriber();
		await client.subscribe(channel, listener);
	}

	private handleSubscriptionStartError(channel: string, error: unknown): void {
		console.error(`[redis:subscriber] Failed to subscribe ${channel}`, error);
		this.subscriptions.delete(channel);
	}

	private unsubscribeHandler(
		channel: string,
		handler: RedisMessageHandler,
	): void {
		const current = this.subscriptions.get(channel);
		if (!current) return;

		current.delete(handler);
		if (!current.isEmpty()) return;

		this.subscriptions.delete(channel);
		current.ready
			.then(async () => {
				if (this.subscriptions.has(channel)) return;
				const client = await this.getSubscriber();
				await client.unsubscribe(channel);
			})
			.catch((error) => {
				console.error(
					`[redis:subscriber] Failed to unsubscribe ${channel}`,
					error,
				);
			});
	}

	private async getPublisher(): Promise<RedisClient> {
		if (!this.publisherPromise) {
			this.publisherPromise = this.createConnection("publisher").catch(
				(error) => {
					this.publisherPromise = null;
					throw error;
				},
			);
		}
		return this.publisherPromise;
	}

	private async getSubscriber(): Promise<RedisClient> {
		if (!this.subscriberPromise) {
			this.subscriberPromise = this.createConnection("subscriber").catch(
				(error) => {
					this.subscriberPromise = null;
					throw error;
				},
			);
		}
		return this.subscriberPromise;
	}

	private async createConnection(role: string): Promise<RedisClient> {
		const url = env.REDIS_URL;
		if (!url) {
			throw new Error("REDIS_URL is not configured.");
		}

		const client = createClient({ url });
		client.on("error", (error) => {
			console.error(`[redis:${role}]`, error);
		});
		await client.connect();
		return client;
	}
}

const redisBus = new DiagramRedisBus();

export function isRedisConfigured(): boolean {
	return redisBus.isConfigured();
}

export function getRedisOriginId(): string {
	return redisBus.getOriginId();
}

export async function publishRedisMessage(
	channel: string,
	payload: unknown,
): Promise<void> {
	await redisBus.publish(channel, payload);
}

export function subscribeRedisChannel(
	channel: string,
	handler: RedisMessageHandler,
): () => void {
	return redisBus.subscribe(channel, handler);
}

export async function redisHashValues(key: string): Promise<string[]> {
	return redisBus.hashValues(key);
}

export async function redisHashSet(
	key: string,
	field: string,
	value: string,
): Promise<void> {
	await redisBus.hashSet(key, field, value);
}

export async function redisHashDelete(
	key: string,
	field: string,
): Promise<void> {
	await redisBus.hashDelete(key, field);
}

export async function redisExpire(key: string, seconds: number): Promise<void> {
	await redisBus.expire(key, seconds);
}
