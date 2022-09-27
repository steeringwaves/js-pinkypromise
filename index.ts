import * as BluebirdPromise from "bluebird";
import Context from "@steeringwaves/context";

// global.Promise = BluebirdPromise;

BluebirdPromise.config({
	// Enable cancellation
	cancellation: true,
	// Enable async hooks
	asyncHooks: true
});

export class Canceled extends Error {
	constructor(reason: string = "") {
		super(reason);
		Object.setPrototypeOf(this, Canceled.prototype);
	}
}

export interface Cancelable<T> extends BluebirdPromise<T> {
	cancel(reason?: string): Cancelable<T>;
	setContext(newCtx?: Context): Cancelable<T>;
	setWhile(callback: () => any): Cancelable<T>;
	onCancel(callback: (canceled: Canceled) => any): Cancelable<T>;
	setInterval(ms: number): Cancelable<T>;
	setRetries(attempts: number): Cancelable<T>;
}

export interface PinkyPromiseOptions {
	Context?: Context | undefined;
	While?: () => any;
	Interval?: number;
	Retries?: number;
	OnCancel?: (canceled: Canceled) => any;
}

export interface PinkyPromiseOnCancel {
	(canceled: Canceled): any;
}

export default function PinkyPromise<T>(
	promise: Promise<T> | BluebirdPromise<T> | any,
	opts?: PinkyPromiseOptions
): Cancelable<T> {
	let ctx: Context | undefined;
	let listener: boolean = false;
	let running: boolean = false;
	let done: boolean = false;
	let cancelled: boolean = false;
	let ongoing: Promise<T> | BluebirdPromise<T> | any = null;
	let whileCheck: () => any | BluebirdPromise<T> | Promise<T>;
	let cancelCallback: PinkyPromiseOnCancel[] = [];
	let intervalMs: number = 0;
	let attempts: number = 0;
	let retryAttempts: number = 0;
	let interval: NodeJS.Timeout | null = null;
	let self: Cancelable<T>;

	let globalResolve: any = null;
	let globalReject: any = null;

	const setContext: (newCtx: Context) => Cancelable<T> = (newCtx: Context) => {
		// remove old listener if we had one
		if (listener) {
			if (ctx) {
				ctx.removeListener("done", cancel);
			}
			listener = false;
		}

		ctx = newCtx;

		if (ctx) {
			if (ctx.Done()) {
				if (cancel) {
					cancel("Context cancelled");
				}
				return self;
			}

			ctx.on("done", (e: Error) => {
				if (cancel) {
					cancel(e.message);
				}
			});
			listener = true;
		}

		return self;
	};

	const setWhile: (callback: () => any) => Cancelable<T> = (callback: () => any | BluebirdPromise<T> | Promise<T>) => {
		whileCheck = callback;
		return self;
	};

	const onCancel: (callback: PinkyPromiseOnCancel) => Cancelable<T> = (callback: (canceled: Canceled) => any) => {
		cancelCallback.push(callback);
		return self;
	};

	const setInterval: (ms: number) => Cancelable<T> = (ms: number) => {
		intervalMs = ms;
		return self;
	};

	const setRetries: (retries: number) => Cancelable<T> = (retries: number) => {
		retryAttempts = retries;
		return self;
	};

	const cleanup: () => void = () => {
		if (interval) {
			clearTimeout(interval);
			interval = null;
		}

		if (done) {
			return;
		}
		done = true;
		cancelled = true;

		if (listener) {
			if (ctx) {
				ctx.removeListener("done", cancel);
			}
			listener = false;
		}
	};

	const cancel: (reason: string) => Cancelable<T> = (reason: string = "") => {
		retryAttempts = 0;
		if (done || cancelled) {
			return self;
		}
		cancelled = true;

		if (running) {
			try {
				if (ongoing && "function" === typeof ongoing.cancel) {
					ongoing.cancel();
					ongoing = undefined;
				}
			} catch (error) {
				//noop
			}
		}

		if (cancelCallback) {
			try {
				let queue: BluebirdPromise<T>[] = [];

				cancelCallback.forEach((cb: PinkyPromiseOnCancel) => {
					queue.push(
						new BluebirdPromise((resolve, reject) => {
							BluebirdPromise.resolve(cb(new Canceled(reason)))
								.then(resolve)
								.catch(reject);
						})
					);
				});

				BluebirdPromise.all(queue)
					.then(() => selfReject(new Canceled(reason)))
					.catch((e: any) => {
						selfReject(e);
					});
				return self;
			} catch (e: any) {
				// throw user error
				selfReject(e);
				return self;
			}
		}

		selfReject(new Canceled(reason));
		return self;
	};

	const selfResolve: any = async (args: any) => {
		if (done || cancelled) {
			return;
		}

		running = false;

		let readyToResolve = true;
		if (whileCheck) {
			try {
				if (whileCheck instanceof Promise || whileCheck instanceof BluebirdPromise) {
					try {
						await whileCheck();
					} catch (e) {
						readyToResolve = false;
					}
				} else if ("function" === typeof whileCheck && whileCheck()) {
					readyToResolve = false;
				}
			} catch (error) {
				cleanup();
				globalReject(error);
				return;
			}
		}

		if (!readyToResolve) {
			if (interval) {
				clearTimeout(interval);
				interval = null;
			}

			if (ctx && ctx.Done()) {
				cancel("Context cancelled");
				return;
			}

			interval = setTimeout(() => {
				if (!run) {
					return;
				}
				run();
			}, intervalMs);
			return;
		}

		cleanup();
		globalResolve(args);
	};

	const selfReject: any = (e: Error) => {
		if (done) {
			return;
		}
		running = false;

		attempts++;
		if (attempts < retryAttempts) {
			if (interval) {
				clearTimeout(interval);
				interval = null;
			}

			if (ctx && ctx.Done()) {
				cancel("Context cancelled");
				return;
			}

			interval = setTimeout(() => {
				if (!run) {
					return;
				}
				run();
			}, intervalMs);
			return;
		}

		cleanup();

		globalReject(e);
	};

	const promResolve: any = async (args: any) => {
		if (ctx && ctx.Done()) {
			cancel("Context cancelled");
			return undefined;
		}

		return selfResolve(args);
	};

	const promReject: any = (e: Error) => {
		if (ctx && ctx.Done()) {
			cancel("Context cancelled");
			return undefined;
		}

		return selfReject(e);
	};

	const run: () => void = () => {
		if (ctx && ctx.Done()) {
			cancel("Context cancelled");
			return;
		}

		running = true;
		try {
			if ("function" === typeof promise) {
				ongoing = new BluebirdPromise(promise).then(promResolve, promReject).catch(promReject);
			} else if (promise instanceof Promise) {
				const prom: Promise<T> = promise;
				ongoing = prom.then(promResolve, promReject).catch(promReject);
			} else if (promise instanceof BluebirdPromise) {
				const prom: BluebirdPromise<T> = promise;
				ongoing = prom.then(promResolve, promReject).catch(promReject);
			} else {
				throw new Error("Invalid parameters");
			}
		} catch (error) {
			promReject(error);
		}
	};

	self = <Cancelable<T>>new BluebirdPromise((resolve, reject) => {
		globalResolve = resolve;
		globalReject = reject;

		if (opts) {
			if (opts.Context) {
				setContext(opts.Context);
			}

			if (opts.Interval) {
				setInterval(opts.Interval);
			}

			if (opts.Retries) {
				setRetries(opts.Retries);
			}

			if (opts.While) {
				setWhile(opts.While);
			}

			if (opts.OnCancel) {
				onCancel(opts.OnCancel);
			}
		}
	});
	self.cancel = cancel;
	self.setContext = setContext;
	self.setWhile = setWhile;
	// TODO this could cause problems, should we be using an event emitter here? eg what happens if you need multiple cancel callbacks
	self.onCancel = onCancel;
	self.setInterval = setInterval;
	self.setRetries = setRetries;
	run();
	return self;
}
