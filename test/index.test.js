/* eslint-env node,mocha,jest */

/* eslint-disable no-unused-vars */
const BluebirdPromise = require("bluebird");
const Context = require("@steeringwaves/context").default;
const PinkyPromise = require("../index").default;
// const Sleep = require("@steeringwaves/sleep").default;
const Sleep = require("../../js-sleep/index").default;

BluebirdPromise.config({
	// Enable cancellation
	cancellation: true,
	// Enable async hooks
	asyncHooks: true
});

let fakeTimeInterval;

/* eslint-enable no-unused-vars */
describe("PinkyPromise real time tests", () => {
	it("should verify promise", async () => {
		const callback = jest.fn();
		const doneCallback = jest.fn();

		const parentCtx = new Context();
		const ctx = new Context({ Parent: parentCtx });
		ctx.on("done", doneCallback);

		// At this point in time, the callback should not have been called yet
		expect(callback).not.toBeCalled();

		await expect(
			new PinkyPromise(
				(resolve, reject) => {
					callback();
					resolve();
				},
				{ Context: ctx }
			)
		).resolves.not.toThrow();

		expect(callback).toHaveBeenCalledTimes(1);

		parentCtx.Cancel();
		expect(doneCallback).toHaveBeenCalledTimes(1);

		await expect(
			new PinkyPromise(
				(resolve, reject) => {
					callback();
					resolve();
				},
				{ Context: ctx }
			)
		).rejects.toThrow(/context/gi);
		expect(callback).toHaveBeenCalledTimes(1);
	});

	it("should verify promise does not run after parent context is cancelled", async () => {
		const callback = jest.fn();
		const doneCallback = jest.fn();

		const parentCtx = new Context();
		const ctx = new Context({ Parent: parentCtx });
		ctx.on("done", doneCallback);

		// At this point in time, the callback should not have been called yet
		expect(callback).not.toBeCalled();

		await expect(
			new PinkyPromise(
				(resolve, reject) => {
					callback();
					resolve();
				},
				{ Context: ctx }
			)
		).resolves.not.toThrow();

		expect(callback).toHaveBeenCalledTimes(1);

		parentCtx.Cancel();
		expect(doneCallback).toHaveBeenCalledTimes(1);

		await expect(
			new PinkyPromise(
				(resolve, reject) => {
					callback();
					resolve();
				},
				{ Context: ctx }
			)
		).rejects.toThrow(/context/gi);
		expect(callback).toHaveBeenCalledTimes(1);
	});

	it("should count to 10 using a Promise as a condition", (done) => {
		let count = 0;
		new PinkyPromise(
			(resolve, reject) => {
				if (count < 10) {
					resolve();
				} else {
					reject();
				}
			},
			{
				While: () =>
					new Promise((resolve) => {
						count++;
						resolve();
					})
			}
		)
			.then(() => {
				expect(count).toEqual(10);
				done();
			})
			.catch((err) => {
				done(err);
			});
	});

	it("should count to 10 using a regular function as a condition", (done) => {
		let count = 0;
		new PinkyPromise(
			(resolve) => {
				count++;
				resolve();
			},
			{
				While: () => count < 10
			}
		)
			.then(() => {
				expect(count).toEqual(10);
				done();
			})
			.catch((err) => {
				done(err);
			});
	});

	it("should count past 10 using a Promise as a condition, then fail", (done) => {
		let count = 0;
		new PinkyPromise(
			(resolve, reject) => {
				count += 3;
				if (count > 10) {
					reject(new Error("Counted past 10"));
				} else {
					resolve();
				}
			},
			{
				While: () =>
					new Promise((resolve, reject) => {
						if (count < 10) {
							resolve();
						} else {
							reject();
						}
					})
			}
		)
			.then(() => {
				done(new Error("Somehow didn't count past 10"));
			})
			.catch((err) => {
				expect(err.message).toEqual("Counted past 10");
				done();
			});
	});

	it("should count past 10 using a regular function as a condition, then fail", (done) => {
		let count = 0;
		new PinkyPromise(
			(resolve, reject) => {
				count += 3;
				if (count > 10) {
					reject(new Error("Counted past 10"));
				} else {
					resolve();
				}
			},
			{ While: () => count < 10 }
		)
			.then(() => {
				done(new Error("Somehow didn't count past 10"));
			})
			.catch((err) => {
				expect(err.message).toEqual("Counted past 10");
				done();
			});
	});

	it("should count to 3 using a regular function as a condition, then be cancelled", (done) => {
		let count = 0;
		const prom = new PinkyPromise(
			(resolve) => {
				count += 1;
				if (count >= 3) {
					prom.cancel();
				}

				// NOTE: Technically this stops at 5, given the condition. You must pair cancellation and condition together at the moment.
				resolve();
			},
			{ While: () => count < 5 }
		).finally(() => {
			expect(count).toEqual(3);
			done();
		});
	});

	it("should count to 10 using a Promise retry as a condition", async () => {
		let count = 0;
		await expect(
			new PinkyPromise(
				(resolve, reject) => {
					count++;
					if (count < 10) {
						reject();
					} else {
						resolve();
					}
				},
				{
					Interval: 1,
					Retries: 10
				}
			)
		).resolves.not.toThrow();
		expect(count).toEqual(10);
	});

	it("should count to 10 using an async Promise retry as a condition", async () => {
		let count = 0;

		const async_function = async () => {
			count++;
			if (count < 10) {
				throw new Error(count);
			}
		};

		await expect(
			new PinkyPromise(
				async (resolve, reject) => {
					try {
						await async_function();
					} catch (error) {
						reject(error);
						return;
					}

					resolve();
				},
				{
					Interval: 1,
					Retries: 10
				}
			)
		).resolves.not.toThrow();
		expect(count).toEqual(10);
	});

	it("should throw error when failing to count to 10 by exceeding max attempts using a Promise retry as a condition", async () => {
		let count = 0;

		await expect(
			new PinkyPromise(
				async (resolve, reject) => {
					count++;
					if (count < 10) {
						reject(new Error("count too low"));
					} else {
						resolve();
					}
				},
				{
					Interval: 1,
					Retries: 5
				}
			)
		).rejects.toThrow(/count too low/gi);
		expect(count).toEqual(5);
	});

	it("should throw error when failing to count to 10 using a Promise retry as a condition", async () => {
		const count = 0;

		await expect(
			new PinkyPromise(
				async (resolve, reject) => {
					if (count < 10) {
						reject(new Error("count too low"));
					} else {
						resolve();
					}
				},
				{
					Interval: 1,
					Retries: 5
				}
			)
		).rejects.toThrow(/count too low/gi);
		expect(count).toEqual(0);
	});
});

describe("PinkyPromise fake time tests", () => {
	beforeEach(() => {
		jest.useRealTimers();
		if (fakeTimeInterval) {
			clearInterval(fakeTimeInterval);
			fakeTimeInterval = undefined;
		}

		fakeTimeInterval = setInterval(() => {
			jest.advanceTimersByTime(100);
		}, 10);
		jest.useFakeTimers();
	});

	afterEach(() => {
		if (fakeTimeInterval) {
			clearInterval(fakeTimeInterval);
			fakeTimeInterval = undefined;
		}
		jest.useRealTimers();
	});

	it("should verify promise does not run after context expires", async () => {
		const callback = jest.fn();
		const doneCallback = jest.fn();

		const parentCtx = new Context();
		const ctx = new Context({ Parent: parentCtx, Timeout: 1500 });
		ctx.on("done", doneCallback);

		// At this point in time, the callback should not have been called yet
		expect(callback).not.toBeCalled();

		await expect(
			new PinkyPromise(
				(resolve, reject) => {
					callback();
					resolve();
				},
				{ Context: ctx }
			)
		).resolves.not.toThrow();

		expect(callback).toHaveBeenCalledTimes(1);

		await Sleep(1000);

		await expect(
			new PinkyPromise(
				(resolve, reject) => {
					callback();
					resolve();
				},
				{ Context: ctx }
			)
		).resolves.not.toThrow();
		expect(callback).toHaveBeenCalledTimes(2);

		await Sleep(1000);
		expect(doneCallback).toHaveBeenCalledTimes(1);

		await expect(
			new PinkyPromise(
				(resolve, reject) => {
					callback(); // should not run
					resolve();
				},
				{ Context: ctx }
			)
		).rejects.toThrow(/context/gi);

		expect(callback).toHaveBeenCalledTimes(2);
	});

	it("should verify native promise is cancelled properly", async () => {
		const callback = jest.fn();

		const parentCtx = new Context();
		const ctx = new Context({ Parent: parentCtx, Timeout: 1500 });

		// At this point in time, the callback should not have been called yet
		expect(callback).not.toBeCalled();

		await expect(
			new PinkyPromise(
				new Promise((resolve, reject) => {
					callback(); // should be called
					Sleep(500)
						.then(() => {
							callback(); // should be called
							resolve();
						})
						.catch((e) => reject(e));
				}),
				{ Context: ctx }
			)
		).resolves.not.toThrow();
		expect(callback).toHaveBeenCalledTimes(2);

		await expect(
			new PinkyPromise(
				new Promise((resolve, reject) => {
					callback(); // should be called
					Sleep(2000)
						.then(() => {
							callback(); // should not be called
							resolve();
						})
						.catch((e) => reject(e));
				}),
				{ Context: ctx }
			)
		).rejects.toThrow(/context/gi);

		expect(callback).toHaveBeenCalledTimes(3);
	});

	it("should verify bluebird promise is cancelled properly", async () => {
		const callback = jest.fn();

		const parentCtx = new Context();
		const ctx = new Context({ Parent: parentCtx, Timeout: 1500 });

		// At this point in time, the callback should not have been called yet
		expect(callback).not.toBeCalled();

		await expect(
			new PinkyPromise(
				new BluebirdPromise((resolve, reject) => {
					callback(); // should be called
					Sleep(500)
						.then(() => {
							callback(); // should be called
							resolve();
						})
						.catch((e) => reject(e));
				}),
				{ Context: ctx }
			)
		).resolves.not.toThrow();
		expect(callback).toHaveBeenCalledTimes(2);

		await expect(
			new PinkyPromise(
				new BluebirdPromise((resolve, reject) => {
					callback(); // should be called
					Sleep(2000)
						.then(() => {
							callback(); // should not be called
							resolve();
						})
						.catch((e) => reject(e));
				}),
				{ Context: ctx }
			)
		).rejects.toThrow(/context/gi);

		expect(callback).toHaveBeenCalledTimes(3);
	});

	it("should verify async/await is cancelled properly", async () => {
		const callback = jest.fn();

		const parentCtx = new Context();
		const ctx = new Context({ Parent: parentCtx, Timeout: 1500 });

		// At this point in time, the callback should not have been called yet
		expect(callback).not.toBeCalled();

		await expect(
			new PinkyPromise(
				async (resolve) => {
					callback(); // should be called
					await Sleep(500);
					callback(); // should be called
					resolve();
				},
				{ Context: ctx }
			)
		).resolves.not.toThrow();
		expect(callback).toHaveBeenCalledTimes(2);

		await expect(
			new PinkyPromise(
				async (resolve) => {
					callback(); // should be called
					await Sleep(2000);
					callback(); // should not be called
					resolve();
				},
				{ Context: ctx }
			)
		).rejects.toThrow(/context/gi);

		expect(callback).toHaveBeenCalledTimes(3);
	});

	it("should verify native promise is cancelled properly when Sleep is given context", async () => {
		const callback = jest.fn();

		const parentCtx = new Context();
		const ctx = new Context({ Parent: parentCtx, Timeout: 1500 });

		// At this point in time, the callback should not have been called yet
		expect(callback).not.toBeCalled();

		await expect(
			new PinkyPromise(
				new Promise((resolve, reject) => {
					callback(); // should be called
					Sleep(500)
						.setContext(ctx)
						.then(() => {
							callback(); // should be called
							resolve();
						})
						.catch((e) => reject(e));
				})
			)
		).resolves.not.toThrow();
		expect(callback).toHaveBeenCalledTimes(2);

		await expect(
			new PinkyPromise(
				new Promise((resolve, reject) => {
					callback(); // should be called
					Sleep(2000)
						.setContext(ctx)
						.then(() => {
							callback(); // should not be called
							resolve();
						})
						.catch((e) => reject(e));
				})
			)
		).rejects.toThrow(/context/gi);

		expect(callback).toHaveBeenCalledTimes(3);
	});

	it("should verify async is cancelled properly when Sleep is given context", async () => {
		const callback = jest.fn();

		const parentCtx = new Context();
		const ctx = new Context({ Parent: parentCtx, Timeout: 1500 });

		// At this point in time, the callback should not have been called yet
		expect(callback).not.toBeCalled();

		await expect(
			new PinkyPromise(async (resolve, reject) => {
				callback(); // should be called
				try {
					await Sleep(500).setContext(ctx);
				} catch (error) {
					reject(error);
					return;
				}
				callback(); // should be called
				resolve();
			})
		).resolves.not.toThrow();
		expect(callback).toHaveBeenCalledTimes(2);

		await expect(
			new PinkyPromise(async (resolve, reject) => {
				callback(); // should be called
				try {
					await Sleep(2000).setContext(ctx);
				} catch (error) {
					reject(error);
					return;
				}
				callback(); // should not be called
				resolve();
			})
		).rejects.toThrow(/context/gi);

		expect(callback).toHaveBeenCalledTimes(3);
	});

	it("should verify async is cancelled properly when Sleep is not given context, but PinkyPromise is", async () => {
		const callback = jest.fn();

		const parentCtx = new Context();
		const ctx = new Context({ Parent: parentCtx, Timeout: 1500 });

		// At this point in time, the callback should not have been called yet
		expect(callback).not.toBeCalled();

		await expect(
			new PinkyPromise(
				async (resolve) => {
					callback(); // should be called
					await Sleep(500);
					callback(); // should be called
					resolve();
				},
				{ Context: ctx }
			)
		).resolves.not.toThrow();
		expect(callback).toHaveBeenCalledTimes(2);

		await expect(
			new PinkyPromise(
				async (resolve) => {
					callback(); // should be called
					await Sleep(2000);
					callback(); // should not be called
					resolve();
				},
				{ Context: ctx }
			)
		).rejects.toThrow(/context/gi);

		expect(callback).toHaveBeenCalledTimes(3);
	});

	// this test breaks everything because it's overiding the default onCancel function
	// this is seriously messed up
	// it("should verify onCancel fires properly with a cancel function", async () => {
	// 	const callback = jest.fn();
	// 	const pinkyPromiseCancelCallback = jest.fn();
	// 	const sleepCancelCallback = jest.fn();

	// 	const parentCtx = new Context({ Timeout: 1500 });
	// 	const sleepCtx = new Context();

	// 	// At this point in time, the callback should not have been called yet
	// 	expect(callback).not.toBeCalled();

	// 	await expect(
	// 		new PinkyPromise(
	// 			async (resolve) => {
	// 				callback(); // should be called
	// 				await Sleep(500).setContext(sleepCtx).onCancel(sleepCancelCallback);
	// 				callback(); // should be called
	// 				resolve();
	// 			},
	// 			{ Context: parentCtx }
	// 		).onCancel(() => {
	// 			sleepCtx.cancel();
	// 			pinkyPromiseCancelCallback();
	// 		})
	// 	).resolves.not.toThrow();
	// 	expect(callback).toHaveBeenCalledTimes(2);
	// 	expect(sleepCancelCallback).not.toBeCalled();
	// 	expect(pinkyPromiseCancelCallback).not.toBeCalled();

	// 	await expect(
	// 		new PinkyPromise(
	// 			async (resolve) => {
	// 				callback(); // should be called
	// 				await Sleep(2000).setContext(sleepCtx).onCancel(sleepCancelCallback);
	// 				callback(); // should not be called
	// 				resolve();
	// 			},
	// 			{ Context: parentCtx }
	// 		).onCancel(() => {
	// 			sleepCtx.Cancel();
	// 			pinkyPromiseCancelCallback();
	// 		})
	// 	).rejects.toThrow(/context/gi);

	// 	expect(callback).toHaveBeenCalledTimes(3);
	// 	expect(sleepCancelCallback).toHaveBeenCalledTimes(1);
	// 	expect(pinkyPromiseCancelCallback).toHaveBeenCalledTimes(1);
	// });

	// xit("should verify onCancel fires properly when a promise is specified", async () => {
	// 	const callback = jest.fn();
	// 	const pinkyPromiseCancelCallback = jest.fn();
	// 	const sleepCancelCallback = jest.fn();

	// 	const parentCtx = new Context({ Timeout: 1500 });
	// 	const sleepCtx = new Context();

	// 	// At this point in time, the callback should not have been called yet
	// 	expect(callback).not.toBeCalled();

	// 	await expect(
	// 		new PinkyPromise(
	// 			async (resolve, reject) => {
	// 				callback(); // should be called
	// 				try {
	// 					await Sleep(500).setContext(sleepCtx).onCancel(sleepCancelCallback);
	// 				} catch (error) {
	// 					reject(error);
	// 					return;
	// 				}
	// 				callback(); // should be called
	// 				resolve();
	// 			},
	// 			{ Context: parentCtx }
	// 		).onCancel(async () => {
	// 			await Sleep(500);
	// 			sleepCtx.cancel();
	// 			pinkyPromiseCancelCallback();
	// 		})
	// 	).resolves.not.toThrow();
	// 	expect(callback).toHaveBeenCalledTimes(2);
	// 	expect(sleepCancelCallback).not.toBeCalled();
	// 	expect(pinkyPromiseCancelCallback).not.toBeCalled();

	// 	await expect(
	// 		new PinkyPromise(
	// 			async (resolve, reject) => {
	// 				callback(); // should be called
	// 				try {
	// 					await Sleep(2000).setContext(sleepCtx).onCancel(sleepCancelCallback);
	// 				} catch (error) {
	// 					reject(error);
	// 					return;
	// 				}
	// 				callback(); // should not be called
	// 				resolve();
	// 			},
	// 			{ Context: parentCtx }
	// 		).onCancel(async () => {
	// 			await Sleep(500);
	// 			sleepCtx.Cancel();
	// 			pinkyPromiseCancelCallback();
	// 		})
	// 	).rejects.toThrow(/context/gi);

	// 	expect(callback).toHaveBeenCalledTimes(3);
	// 	expect(sleepCancelCallback).toHaveBeenCalledTimes(1);
	// 	expect(pinkyPromiseCancelCallback).toHaveBeenCalledTimes(1);
	// });

	// xit("should verify onCancel fires properly from Sleep", async () => {
	// 	const callback = jest.fn();
	// 	const pinkyPromiseCancelCallback = jest.fn();
	// 	const sleepCancelCallback = jest.fn();

	// 	const parentCtx = new Context();
	// 	const ctx = new Context({ Parent: parentCtx, Timeout: 1500 });

	// 	// At this point in time, the callback should not have been called yet
	// 	expect(callback).not.toBeCalled();

	// 	await expect(
	// 		new PinkyPromise(async (resolve, reject) => {
	// 			callback(); // should be called
	// 			try {
	// 				await Sleep(500).setContext(ctx).onCancel(sleepCancelCallback);
	// 			} catch (error) {
	// 				reject(error);
	// 				return;
	// 			}
	// 			callback(); // should be called
	// 			resolve();
	// 		}).onCancel(pinkyPromiseCancelCallback)
	// 	).resolves.not.toThrow();
	// 	expect(callback).toHaveBeenCalledTimes(2);
	// 	expect(sleepCancelCallback).not.toBeCalled();
	// 	expect(pinkyPromiseCancelCallback).not.toBeCalled();

	// 	await expect(
	// 		new PinkyPromise(async (resolve, reject) => {
	// 			callback(); // should be called
	// 			try {
	// 				await Sleep(2000).setContext(ctx).onCancel(sleepCancelCallback);
	// 			} catch (error) {
	// 				reject(error);
	// 				return;
	// 			}
	// 			callback(); // should not be called
	// 			resolve();
	// 		}).onCancel(pinkyPromiseCancelCallback) // should not be called
	// 	).rejects.toThrow(/context/gi);

	// 	expect(callback).toHaveBeenCalledTimes(3);
	// 	expect(sleepCancelCallback).toHaveBeenCalledTimes(1);
	// 	expect(pinkyPromiseCancelCallback).toHaveBeenCalledTimes(0);
	// });

	it("should fail to count to 10 using a regular function as a condition with a context", async () => {
		let count = 0;

		const ctx = new Context({ Timeout: 1500 });

		await expect(
			new PinkyPromise(async (resolve) => {
				count++;
				resolve();
			})
				.setWhile(() => count < 10)
				.setInterval(200)
				.setContext(ctx)
		).rejects.toThrow(/context/gi);

		expect(count).toEqual(8);
	});

	it("should fail to count to 10 using a regular function as a condition with a context using options", async () => {
		let count = 0;

		const ctx = new Context({ Timeout: 1500 });

		await expect(
			new PinkyPromise(
				(resolve) => {
					count++;
					resolve();
				},
				{
					Interval: 200,
					Context: ctx,
					While: () => count < 10
				}
			)
		).rejects.toThrow(/context/gi);

		expect(count).toEqual(8);
	});

	it("should throw error when failing to count to 10 using a Promise retry and context as a condition", async () => {
		const ctx = new Context({ Timeout: 1000 });

		let count = 0;

		await expect(
			new PinkyPromise(
				async (resolve, reject) => {
					count++;
					if (count < 10) {
						reject(new Error("count too low"));
					} else {
						resolve();
					}
				},
				{
					Interval: 200,
					Retries: 10,
					Context: ctx
				}
			)
		).rejects.toThrow(/context/gi);
		expect(count).toEqual(5);
	});
});
