/*jshint -W117 */

// remoteLog(msg [, whenMs]): send a line to the server's log, if the server's
// config has "stream_logs": true. Asks once (api/client-config); lines logged
// before the answer are held, then sent in batches or dropped.
function remoteLog(msg, when) {
	remoteLog.add(msg, when);
}

(function () {
	var state = "asking"; // then "on" or "off"
	var queue = [];
	var timer = null;
	var perf = window.performance;
	var pageStart = perf && (perf.timeOrigin || (perf.timing && perf.timing.navigationStart)) || new Date().getTime();

	remoteLog.add = function (msg, when) {
		if (state === "off") return;
		when = when || new Date().getTime();
		var d = new Date(when);
		queue.push({at: d.toISOString ? d.toISOString() : String(when), page_ms: when - pageStart, msg: String(msg)});
		if (state === "on" && !timer) timer = setTimeout(flush, 250);
	};

	function flush() {
		timer = null;
		if (!queue.length) return;
		var batch = queue.splice(0, 100);
		$.ajax({
			type: "POST",
			url: "api/log",
			contentType: "application/json",
			data: JSON.stringify({hash: window.svr && svr.hash, client: window.svr && svr.clientid, lines: batch})
		});
		if (queue.length) timer = setTimeout(flush, 250);
	}

	$.getJSON("api/client-config", function (config) {
		state = config.stream_logs ? "on" : "off";
		if (state === "on") flush(); else queue = [];
	}).fail(function () {
		state = "off";
		queue = [];
	});

	remoteLog("page scripts loading: " + location.href);
})();
