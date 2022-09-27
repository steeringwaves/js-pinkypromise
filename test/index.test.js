/* eslint-env node,mocha,jest */
/* eslint-disable no-unused-vars */

/* eslint-enable no-unused-vars */

const Dummy = require("../index").default;

describe("Dummy", () => {
	it("Get", () => {
		const d = new Dummy("hello world");
		expect(d.Message).toEqual("hello world");
	});
});
