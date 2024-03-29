# @steeringwaves/pinkypromise

![workflow](https://github.com/github/docs/actions/workflows/test.yml/badge.svg)

A typescript promise library built for the real world.

## Installation

```sh
npm install @steeringwaves/context
npm install @steeringwaves/pinkypromise

# for typescript you also need typings for bluebird
npm install --save-dev @types/bluebird
```

## Example

### basic usage

```js
import Context from "@steeringwaves/context";
import PinkyPromise, { Cancelable } from "@steeringwaves/pinkypromise";

const fn = () =>
	new PinkyPromise(new Promise(resolve, reject) => {
		resolve();
	});

fn().then();
```

### retry conditions

```js
let count = 0;
const fn = () =>
	new PinkyPromise(
		new Promise(resolve, reject) => {
			count++;
			resolve();
		},
		{
			While: () => count < 10
		}
	);

fn()
	.then(() => {
		console.log(count); // 10
	})
	.catch((err) => {
		console.log(err);
	});
```

### retry conditions where condition is async

```js
let count = 0;
const fn = () =>
	new PinkyPromise(
		new Promise(resolve, reject) => {
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
	);

fn()
	.then(() => {
		console.log(count); // 10
	})
	.catch((err) => {
		console.log(err);
	});
```

### retry attempts

```js
let count = 0;
const fn = () =>
	new PinkyPromise(
		new Promise(resolve, reject) => {
			count++;
			if (count < 10) {
				reject();
			} else {
				resolve();
			}
		},
		{
			Interval: 100, // 100ms
			Retries: 10
		}
	);

// could also do fn().setInterval(100).setRetries(10)

fn()
	.then(() => {
		console.log(count); // 10
	})
	.catch((err) => {
		console.log(err);
	});
```

### using context

```js
const fn = () =>
	new PinkyPromise(
		new Promise(resolve, reject) => {
			callback();
			resolve();
		},
		{ Context: ctx }
	);

fn().then();

// or
const fn = () =>
	new PinkyPromise(new Promise(resolve, reject) => {
		callback();
		resolve();
	});

fn().setContext(ctx).then();
```

### typescript usage

```ts
import Context from "@steeringwaves/context";
import PinkyPromise, { Cancelable } from "@steeringwaves/pinkypromise";

const ctx = new Context();

const fn: Cancelable<void> = () =>
	new PinkyPromise(
		new Promise(resolve: any, reject: any) => {
			callback();
			resolve();
		},
		{ Context: ctx }
	);

fn().then();
```
