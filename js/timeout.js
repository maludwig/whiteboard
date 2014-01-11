/*jshint -W117 */
/*jshint -W098 */

function Timeout(fn, interval) {
    this.cleared = false;
	this.fn = fn;
	this.interval = interval;
	this.func = function() {
		this.cleared = true;
		this.fn();
	};
    this.id = setTimeout(this.func, this.interval);
}
Timeout.prototype.clear = function () {
	this.cleared = true;
	clearTimeout(this.id);
};
Timeout.prototype.reset = function () {
	if(!this.cleared) {
		this.clear();
	}
    this.cleared = false;
    this.id = setTimeout(this.func, this.interval);
};
