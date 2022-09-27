export default class Dummy {
	private _msg: string = "";

	constructor(msg: string) {
		this._msg = msg;
	}

	get Message(): string {
		return this._msg;
	}
}
