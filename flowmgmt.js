/*jshint -W117 */
/*jshint -W098 */

//Requires touch.js, hook.js, flow.js, and surface.js

var scratch,modern,historic;
var scratchFlow;
var flows = [];
var undoMark = 0; //Last flow to be undone
var histoMark = -1; //Last flow to be added to historic
var UNDOCOUNT = 5;
var cc = 0;

var flowActions = {
	add: new Hook(),
	undo: new Hook(),
	redo: new Hook(),
	clear: new Hook(),
	initialize: function() {
		$("#overlay").touchStart(flowActions.start).touchMove(flowActions.move).touchEnd(flowActions.end);
	},
	start: function(x,y) {
		scratchFlow.point(x,y);
	},
	move: function(x,y) {
        scratchFlow.point(x,y);
	},
	end: function(x,y) {
		scratchFlow.point(x,y);
		flowActions.add(scratchFlow);
		scratch.clear();
		scratchFlow = new Flow({surface:scratch});
	}
};

var flowMgmt = {
	initialize: function() {
		hiddensurface = new Surface({drawing:false});
        scratch = new Surface({canvas:"#scratch"});
        modern = new Surface({canvas:"#modern"});
        historic = new Surface({canvas:"#historic"});
		scratchFlow = new Flow({surface:scratch});
        
        //Any calls to flowActions.add/undo/redo/clear will also call flowMgmt's respective function.
		flowActions.add(flowMgmt.add);
		flowActions.undo(flowMgmt.undo);
		flowActions.redo(flowMgmt.redo);
		flowActions.clear(flowMgmt.clear);
	},
	getLastUndo: function() {
		return flows[undoMark];
	},
	getLastRedo: function() {
		return flows[undoMark-1];
	},
	search: function(flow) {
		for(var i=flows.length-1;i>=0;i--){
			if (flows[i] == flow) {
				return i;
			}
		}
		return -1;
	},
	undo: function(flow) {
		var f;
		if(flows.length>0 && undoMark>0) {
			if(typeof flow == "undefined"){
				undoMark--;
				f = flows[undoMark];
				if(f.s == modern) {
					flowMgmt.redrawModern();
				} else {
					flowMgmt.redrawHistoric();
				}
				menu.activate("#redo");
			} else {
				var idx = flowMgmt.search(flow);
				if(idx!=-1) {
					undoMark=idx;
					f = flows[undoMark];
					if(f.s == modern) {
						flowMgmt.redrawModern();
					} else {
						flowMgmt.redrawModern();
						flowMgmt.redrawHistoric();
					}
				}
				menu.activate("#redo");
			}
		}
		if(undoMark===0) {
			menu.deactivate("#undo");
		}
	},
	redo: function() {
		if(flows.length>undoMark) {
			var f = flows[undoMark];
			undoMark++;
			if(f.s == modern) {
				flowMgmt.redrawModern();
			} else {
				flowMgmt.redrawHistoric();
			}
			menu.activate("#undo");
		}
		if(flows.length==undoMark) {
			menu.deactivate("#redo");
		}
	},
	toDataURL: function() {
		for(var i=histoMark+1;i<flows.length;i++){
			flows[i].surface(historic);
			flows[i].redraw();
		}
		histoMark = flows.length-1;
		return historic.toDataURL();
	},
	add: function(newf) {
		var nextHistory;
		if(undoMark!=flows.length) {
			flows = flows.slice(0,undoMark);
			histoMark = Math.min(histoMark,undoMark-1);
		}
		newf.surface(modern);
		if(newf==scratchFlow) {
			newf.tool(menu.tool);
		}
		flows.push(newf);
		nextHistory = flows.length-UNDOCOUNT;
		if(histoMark<nextHistory){
			var f = flows[nextHistory];
			f.surface(historic);
			f.redraw();
			histoMark = nextHistory;
		}
		undoMark = flows.length;
		flowMgmt.redrawModern();
		menu.activate("#undo");
		menu.deactivate("#redo");
	},
	redrawModern: function() {
		var from = Math.max(0,histoMark+1);
		var to = Math.min(flows.length,undoMark);
		modern.clear();
		for(var i=from;i<to;i++) {
			flows[i].redraw();
		}
	},
	redrawHistoric: function() {
		var to = Math.min(histoMark+1,undoMark);
		historic.clear();
		for(var i=0;i<to;i++) {
			flows[i].redraw();
		}
	},
	clear: function() {
		flows = [];
		undoMark = 0; //Last flow to be undone
		histoMark = -1; //Last flow to be added to historic
		scratch.clear();
		modern.clear();
		historic.clear();
	}
};
