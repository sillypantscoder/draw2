var log = (() => {
	var logElm = document.createElement("div")
	logElm.setAttribute("style", `position: absolute; bottom: 0; right: 0;`)
	document.body.appendChild(logElm)
	/** @param {string} data */
	function log(data) {
		var e = document.createElement("div")
		logElm.appendChild(e)
		e.innerText = data
		setTimeout(() => {
			e.remove()
		}, 3000)
	}
	return log
})();
/**
 * @param {*} o
 * @returns {string}
 */
function repr(o) {
	if (typeof o == "string") {
		return "\"" + o + "\""
	}
	if (typeof o == "number") {
		return o.toString()
	}
	if (o instanceof Array) {
		return "[" + o.map((v) => repr(v)).join(", ") + "]"
	}
	// object
	var keys = Object.keys(o)
	var r = "{"
	for (var i = 0; i < keys.length; i++) {
		if (i != 0) r += ", "
		r += repr(keys[i])
		r += ": "
		r += repr(o[keys[i]])
	}
	r += "}"
	return r
}
/** @param {number[]} o */
function avg(o) {
	return o.reduce((a, b) => a + b, 0) / o.length
}
/**
 * @param {{ x: number, y: number }} point1
 * @param {{ x: number, y: number }} point2
 */
function dist(point1, point2) {
	return Math.sqrt(Math.pow(point1.x - point2.x, 2) + Math.pow(point1.y - point2.y, 2))
}
const distanceBetweenPointAndLineSegment = (() => {
	/**
	 * @param {number} x
	 */
	function sqr(x) { return x * x }
	/**
	 * @param {{ x: number; y: number; }} v
	 * @param {{ x: number; y: number; }} w
	 */
	function distanceSquared(v, w) { return sqr(v.x - w.x) + sqr(v.y - w.y) }
	/**
	 * @param {{ x: number; y: number; }} point
	 * @param {{ x: number; y: number; }} linePoint1
	 * @param {{ x: number; y: number; }} linePoint2
	 */
	function distToSegmentSquared(point, linePoint1, linePoint2) {
		var l2 = distanceSquared(linePoint1, linePoint2);
		if (l2 == 0) return distanceSquared(point, linePoint1);
		var t = ((point.x - linePoint1.x) * (linePoint2.x - linePoint1.x) + (point.y - linePoint1.y) * (linePoint2.y - linePoint1.y)) / l2;
		t = Math.max(0, Math.min(1, t));
		return distanceSquared(point, { x: linePoint1.x + t * (linePoint2.x - linePoint1.x),
							y: linePoint1.y + t * (linePoint2.y - linePoint1.y) });
	}
	/**
	 * @param {{ x: number; y: number; }} point
	 * @param {{ x: number; y: number; }} linePoint1
	 * @param {{ x: number; y: number; }} linePoint2
	 */
	function distToSegment(point, linePoint1, linePoint2) { return Math.sqrt(distToSegmentSquared(point, linePoint1, linePoint2)); }
	return distToSegment
})();

var mainCanvas = document.createElement("canvas")
document.querySelector(".mainContainer")?.appendChild(mainCanvas)
mainCanvas.id = "mainCanvas"

var mainCanvasCtx = (() => {
	var ctx = mainCanvas.getContext('2d')
	if (ctx == null) throw new Error("Canvas context not found")
	return ctx;
})();

/**
 * @param {{ x: number, y: number }[]} points
 */
function pointsToPath(points) {
	var r = `M ${points[0].x} ${points[0].y}`
	for (var i = 1; i < points.length; i++) {
		r += ` L ${points[i].x} ${points[i].y}`
	}
	return r
}
