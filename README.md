# @steeringwaves/pinkypromise

![workflow](https://github.com/github/docs/actions/workflows/test.yml/badge.svg)

A typescript promise library built for the real world.

## Example

### basic usage

```js
const BluebirdPromise = require("bluebird");
const Context = require("@steeringwaves/context").default;
const PinkyPromise = require("@steeringwaves/pinkypromise").default;

const fn = () =>
	new PinkyPromise((resolve, reject) => {
		resolve();
	});

fn().then();
```

### retry conditions

```js
let count = 0;
const fn = () =>
	new PinkyPromise(
		(resolve, reject) => {
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
		(resolve, reject) => {
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
		(resolve, reject) => {
			callback();
			resolve();
		},
		{ Context: ctx }
	);

fn().then();

// or
const fn = () =>
	new PinkyPromise((resolve, reject) => {
		callback();
		resolve();
	});

fn().setContext(ctx).then();
```
