/*jshint -W117 */
/*jshint -W098 */

var scratch,modern,historic;
var scratchFlow;
var flows = [];
var redoflows = [];
var t;
function undo() {
	if(flows.length>0) {
		redoflows.push(flows.pop());
		redrawModern();
		menu.activate("#redo");
	}
	if(flows.length===0) {
		menu.deactivate("#undo");
	}
}
function redo() {
	if(redoflows.length>0) {
		flows.push(redoflows.pop());
		redrawModern();
		menu.activate("#undo");
	}
	if(redoflows.length===0) {
		menu.deactivate("#redo");
	}
}
function start(x,y) {
	scratchFlow.point(x,y);
	
}
var cc = 0;
function move(x,y) {
	cc++;
	if(cc%10===0) {
		scratchFlow.point(x,y);
	}
}
function end(x,y) {
	scratchFlow.point(x,y);
	addFlow(scratchFlow);
	scratch.clear();
	scratchFlow = newFlow();
}
function addFlow(newf) {
	newf.tool(t);
	newf.surface(modern);
	if(flows.push(newf)>=20){
		var f = flows.shift();
		f.surface(historic);
		f.redraw();
	}
	redrawModern();
	menu.activate("#undo");
	menu.deactivate("#redo");
	redoflows = [];
}
function redrawModern() {
	modern.clear();
	$.each(flows,function(idx,flow){
		flow.redraw();
	});
}