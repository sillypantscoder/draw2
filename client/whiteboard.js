// Switch tools
document.querySelector(".menu")?.addEventListener("click", (event) => {
	/** @type {HTMLElement | null} */
	// @ts-ignore
	var menuoption = event.target
	while (menuoption != null) {
		if (menuoption.classList.contains("menu-option")) break;
		menuoption = menuoption.parentElement
	}
	// If we clicked on a menu option:
	if (menuoption != null) {
		// Remove the current selected option.
		document.querySelector('.menu-option-selected')?.classList.remove('menu-option-selected');
		// Add the new selected option.
		menuoption.classList.add("menu-option-selected")
		// Quit button
		if (menuoption.dataset.mode == "Quit") {
			location.assign("/")
			return
		}
	}
	// Set mode output
	var modeOutput = document.querySelector('#mode-output')
	if (modeOutput != null) modeOutput.textContent = getCurrentMode()
	// De-select items
	window.dispatchEvent(new Event("Custom-Switch-Tools"));
	// Draw Mode window
	if (menuoption?.dataset.mode == "Draw") document.querySelector("#drawmode")?.classList.remove("hidden")
	else document.querySelector("#drawmode")?.classList.add("hidden")
}, false)
/** @returns {"Draw" | "Text" | "Move" | "Select" | "Erase"} */
function getCurrentMode() {
	// @ts-ignore
	return document.querySelector(".menu-option-selected").dataset.mode
}

class SceneObject {
	static typeID = "[ERROR]"
	/**
	 * @param {Whiteboard} whiteboard
	 * @param {number} id
	 * @param {Object<string, any>} data
	 */
	constructor(whiteboard, id, data) {
		this.whiteboard = whiteboard
		this.data = data
		this.objectID = id
	}
	add() {
		this.whiteboard.objects.push(this)
	}
	verify() {}
	unverify() {}
	update() {}
	remove() {
		this.whiteboard.objects.splice(this.whiteboard.objects.indexOf(this), 1)
	}
	/**
	 * Creates an object given its type ID, object ID, and data. Adds the object to the screen.
	 * @param {Whiteboard} whiteboard
	 * @param {String} typeID
	 * @param {Object<string, any>} data
	 * @param {number} id
	 * @returns {SceneObject}
	 */
	static createFromDataAndID(whiteboard, typeID, data, id) {
		var objClass = objectTypes[typeID]
		var o = new objClass(whiteboard, id, data)
		o.add()
		return o
	}
	static generateObjectID() {
		return Math.floor(Math.random() * 10000000)
	}
	/** @param {{ x: number, y: number }} pos */
	collidepoint(pos) {
		return true
	}
	/**
	 * @param {{ x: number, y: number }} pos
	 * @param {{ x: number, y: number }} size
	 */
	colliderect(pos, size) {
		return true
	}
	/**
	 * @param {number} x
	 * @param {number} y
	 */
	move(x, y) {
	}
	/** @returns {string} */
	// @ts-ignore
	getTypeID() { return this.constructor.typeID; }
}
class DrawingObject extends SceneObject {
	static typeID = "drawing"
	/**
	 * @param {Whiteboard} whiteboard
	 * @param {number} id
	 * @param {Object<string, any>} data
	 */
	constructor(whiteboard, id, data) {
		super(whiteboard, id, data)
		/** @type {{ x: number, y: number }[]} */
		this.path = data.d
		this.color = data.color
		this.elm = document.createElementNS("http://www.w3.org/2000/svg", "path")
		this.elm.setAttribute("fill", "none")
		this.elm.setAttribute("opacity", "0.5")
		this.update()
	}
	add() {
		super.add()
		theSVG.appendChild(this.elm)
	}
	verify() {
		this.elm.removeAttribute("opacity")
	}
	unverify() {
		this.elm.setAttribute("opacity", "0.5")
	}
	update() {
		const _viewport = this.whiteboard.viewport;
		this.elm.setAttribute("d", pointsToPath(this.path.map((v) => _viewport.getScreenPosFromStagePos(v.x, v.y))))
		// this.elm.setAttribute("stroke-width", (5 * viewPos.zoom).toString())
		if (this.whiteboard.selection.indexOf(this) != -1) {
			this.elm.setAttribute("stroke", "blue")
			this.elm.setAttribute("stroke-width", "8")
		} else {
			this.elm.setAttribute("stroke", this.color)
			this.elm.setAttribute("stroke-width", "5")
		}
	}
	remove() {
		super.remove()
		this.elm.remove()
	}
	/** @param {{ x: number, y: number }} pos */
	collidepoint(pos) {
		for (var i = 0; i < this.path.length - 1; i++) {
			if (distanceBetweenPointAndLineSegment(pos, this.path[i], this.path[i + 1]) < 3 / this.whiteboard.viewport.zoom) {
				return true
			}
		}
		return false
	}
	/**
	 * @param {{ x: number, y: number }} pos
	 * @param {{ x: number, y: number }} size
	 */
	colliderect(pos, size) {
		for (var i = 0; i < this.path.length; i++) {
			var px = this.path[i].x
			var py = this.path[i].y
			if (px >= pos.x && px <= pos.x + size.x && py >= pos.y && py <= pos.y + size.y) return true
		}
		return false;
	}
	/**
	 * @param {number} x
	 * @param {number} y
	 */
	move(x, y) {
		for (var i = 0; i < this.path.length; i++) {
			this.path[i].x += x
			this.path[i].y += y
		}
		this.update()
	}
}
class TextObject extends SceneObject {
	static typeID = "text"
	/**
	 * @param {Whiteboard} whiteboard
	 * @param {number} id
	 * @param {Object<string, any>} data
	 */
	constructor(whiteboard, id, data) {
		super(whiteboard, id, data)
		/** @type {{ x: number, y: number }} */
		this.pos = data.pos
		/** @type {string} */
		this.text = data.text
		/** @type {HTMLTextAreaElement} */
		this.elm = TextObject.createTextarea()
		this.elm.setAttribute("class", "unverified")
		var _text = this
		this.elm.addEventListener("click", (event) => {
			event.stopPropagation()
		}, false)
		this.elm.addEventListener("mousedown", (event) => {
			if (getCurrentMode() == "Text") {
				event.stopPropagation()
			} else {
				event.preventDefault()
			}
		}, false)
		this.elm.addEventListener("touchstart", (event) => {
			event.stopPropagation()
		}, false)
		this.elm.addEventListener("input", () => {
			_text.elm.style.width = (Math.max(..._text.elm.value.split("\n").map((v) => v.length)) + 3) + "ch"
			_text.elm.style.height = "";
			_text.elm.style.height = "calc(" + _text.elm.scrollHeight + "px + 0.25em)"
		})
		this.elm.addEventListener("blur", (event) => {
			_text.text = _text.elm.value
			// @ts-ignore
			_text.sendEdit()
		})
		requestAnimationFrame(() => _text.update())
	}
	add() {
		super.add()
		document.querySelector(".mainContainer")?.appendChild(this.elm)
	}
	verify() {
		this.elm.removeAttribute("class")
	}
	unverify() {
		this.elm.setAttribute("class", "unverified")
	}
	update() {
		if (document.activeElement != this.elm) this.elm.value = this.text
		const _viewport = this.whiteboard.viewport;
		this.elm.setAttribute("style", `top: ${(this.pos.y * _viewport.zoom) + _viewport.y}px; left: ${(this.pos.x * _viewport.zoom) + _viewport.x}px; transform: scale(${_viewport.zoom}); transform-origin: 0px 0px;`)
		this.elm.dispatchEvent(new KeyboardEvent("input"))
		// Focus
		if (this.whiteboard.selection.indexOf(this) != -1) {
			this.elm.classList.add("focus-shadow")
		} else {
			this.elm.classList.remove("focus-shadow")
		}
	}
	remove() {
		super.remove()
		this.elm.remove()
	}
	/** @param {{ x: number, y: number }} pos */
	collidepoint(pos) {
		var screenPos = this.whiteboard.viewport.getScreenPosFromStagePos(pos.x, pos.y)
		return document.elementsFromPoint(screenPos.x, screenPos.y).includes(this.elm)
	}
	/**
	 * @param {{ x: number, y: number }} pos
	 * @param {{ x: number, y: number }} size
	 */
	colliderect(pos, size) {
		var elementRect = this.elm.getBoundingClientRect()
		var stageSize = { x: elementRect.width * this.whiteboard.viewport.zoom, y: elementRect.height * this.whiteboard.viewport.zoom }
		// stagePos = this.pos
		return pos.x <= this.pos.x + stageSize.x && pos.x + size.x >= this.pos.x && pos.y <= this.pos.y + stageSize.y && pos.y + size.y >= this.pos.y
	}
	/**
	 * @param {number} x
	 * @param {number} y
	 */
	move(x, y) {
		this.pos.x += x
		this.pos.y += y
		this.update()
	}
	static createTextarea() {
		var t = document.createElementNS("http://www.w3.org/1999/xhtml", "textarea")
		if (! (t instanceof HTMLTextAreaElement)) {
			throw new Error("newly created element is of the wrong type!!! (This error is definitely not possible)")
		}
		return t
	}
}

/** @type {Object<string, typeof SceneObject>} */
const objectTypes = (() => {
	/** @type {Object<string, typeof SceneObject>} */
	var objectTypes = {};
	for (var cls of [
		DrawingObject,
		TextObject
	]) {
		objectTypes[cls.typeID] = cls;
	}
	return objectTypes;
})();

class Viewport {
	/**
	 * @param {() => void} updateCallback
	 */
	constructor(updateCallback) {
		this.x = 0;
		this.y = 0;
		this.zoom = 1;
		this.updateAllObjects = updateCallback
	}
	/**
	 * @param {number} x
	 * @param {number} y
	 */
	getStagePosFromScreenPos(x, y) {
		var realPos = { x: (x - this.x) / this.zoom, y: (y - this.y) / this.zoom }
		return realPos
	}
	/**
	 * @param {number} x
	 * @param {number} y
	 */
	getScreenPosFromStagePos(x, y) {
		var realPos = { x: (x * this.zoom) + this.x, y: (y * this.zoom) + this.y }
		return realPos
	}
	/**
	 * @param {{ x: number, y: number }} origin
	 * @param {number} amount
	 */
	zoomView(origin, amount) {
		this.x += ((this.x - origin.x) * amount) + (origin.x - this.x)
		this.y += ((this.y - origin.y) * amount) + (origin.y - this.y)
		this.zoom *= amount
	}
}
class Whiteboard {
	constructor() {
		this.viewport = new Viewport(this.updateAllObjects.bind(this))
		/** @type {SceneObject[]} */
		this.objects = []
		/** @type {SceneObject[]} */
		this.selection = []
		this.connection = new Connection(this)
		// Undo stack objects
		this.shiftKeyDown = false
		/** @type {UndoStackItem[]} */
		this.undo_stack = []
		/** @type {UndoStackItem[]} */
		this.redo_stack = []
		this.addEventListeners()
		// Touch handlers
		this.touchHandler = new TouchHandler(this)
		this.touchHandler.addEventListeners()
	}
	addEventListeners() {
		window.addEventListener("keydown", ((/** @type {KeyboardEvent} */ e) => {
			if (e.key == "Shift") this.shiftKeyDown = true
			if (e.key == "Escape") {
				// Remove selection
				this.selection = [];
				this.updateAllObjects();
				this.updateSelectionWindow();
			}
			if (e.key == "Backspace" || e.key == "Delete") {
				// Delete selection
				this.doAction(new USIEraseObjects(this, this.selection.map((v) => ({
					typeID: v.getTypeID(), objectID: v.objectID, data: v.data
				}))));
				this.selection = [];
				this.updateSelectionWindow();
			}
			if (e.ctrlKey) {
				if (e.key == "z") this.undo()
				if (e.key == "Z") this.redo()
				if (e.key == "y") this.redo()
				if (e.key == "Y") this.undo()
			}
		}).bind(this))
		window.addEventListener("keyup", ((/** @type {KeyboardEvent} */ e) => {
			if (e.key == "Shift") this.shiftKeyDown = false
		}).bind(this))
		window.addEventListener("Custom-Switch-Tools", (() => {
			this.selection = []
			this.updateAllObjects()
			this.updateSelectionWindow()
		}).bind(this))
		this.updateUndoButtons()
	}
	updateAllObjects() {
		for (var i = 0; i < this.objects.length; i++) {
			this.objects[i].update()
		}
	}
	/** @param {number} objectID */
	findObject(objectID) {
		for (var o of this.objects) {
			if (o.objectID == objectID) {
				return o;
			}
		}
		throw new Error("Object not found with ID: " + objectID)
	}
	/** @param {number} objectID */
	findObjectSafe(objectID) {
		for (var o of this.objects) {
			if (o.objectID == objectID) {
				return o;
			}
		}
		return undefined;
	}
	/** @param {{ x: number, y: number }} pos */
	eraseAtPoint(pos) {
		var o = [...this.objects]
		for (var i = 0; i < o.length; i++) {
			if (o[i].collidepoint(pos)) {
				this.doAction(new USIEraseObjects(this, [{
					typeID: o[i].getTypeID(), objectID: o[i].objectID, data: o[i].data
				}]))
			}
		}
	}
	updateSelectionWindow() {
		// update window
		var window = document.querySelector(".selection-window")
		if (window == null) throw new Error(".selection-window is missing")
		if (this.selection.length == 0) {
			window.classList.remove("active")
		} else {
			window.classList.add("active")
		}
		// update number
		var number = document.querySelector("#selection-number")
		if (number == null) throw new Error("#selection-number is missing")
		number.textContent = this.selection.length.toString();
		// update s
		var s = document.querySelector("#selection-s")
		if (s == null) throw new Error("#selection-s is missing")
		if (this.selection.length == 1) s.classList.add("hidden");
		else s.classList.remove("hidden");
	}
	/**
	 * @param {UndoStackItem} item
	 */
	doAction(item) {
		item.do()
		this.undo_stack.push(item.invert())
		this.redo_stack = []
		this.updateUndoButtons()
	}
	undo() {
		// Get item
		var item = this.undo_stack.pop()
		if (item == undefined) return
		// Undo
		item.do()
		// Add to redo stack
		this.redo_stack.push(item.invert())
		// Update
		this.updateUndoButtons()
	}
	redo() {
		// Get item
		var item = this.redo_stack.pop()
		if (item == undefined) return
		// Redo
		item.do()
		// Add back to undo stack
		this.undo_stack.push(item.invert())
		// Update
		this.updateUndoButtons()
	}
	updateUndoButtons() {
		// Undo Button
		var u = document.querySelector("button[onclick='whiteboard.undo()']")
		if (u == null) throw new Error("The undo button doesn't exist")
		if (this.undo_stack.length == 0) u.setAttribute("disabled", "true")
		else u.removeAttribute("disabled")
		// Redo Button
		var r = document.querySelector("button[onclick='whiteboard.redo()']")
		if (r == null) throw new Error("The redo button doesn't exist")
		if (this.redo_stack.length == 0) r.setAttribute("disabled", "true")
		else r.removeAttribute("disabled")
	}
}

class Connection {
	/** @param {Whiteboard} whiteboard */
	constructor(whiteboard) {
		this.whiteboard = whiteboard;
		// Create websocket
		var ws = new WebSocket("ws://" + location.hostname + ":8062/")
		this.webSocket = ws
		ws.addEventListener("open", () => {
			ws.send(location.pathname.split("/").at(-2) ?? "ERROR")
		})
		ws.addEventListener("message", this.onmessage.bind(this))
	}
	/**
	 * @param {MessageEvent<string>} msgEvent
	 */
	onmessage(msgEvent) {
		/** @type {{ type: "error", data: string } | { type: "create_object", objectID: number, typeID: string, data: Object } | { type: "remove_object", objectID: number }} */
		var message = JSON.parse(msgEvent.data)
		if (message.type == "error") {
			console.error("[Server]", message.data)
		} else if (message.type == "create_object") {
			// Search for existing object
			var obj = this.whiteboard.findObjectSafe(message.objectID)
			// Create new object?
			if (obj == undefined) {
				obj = SceneObject.createFromDataAndID(this.whiteboard, message.typeID, message.data, message.objectID)
			}
			// Verify object!
			obj.verify()
		} else if (message.type == "remove_object") {
			// Find object
			var obj = this.whiteboard.findObjectSafe(message.objectID)
			// Remove
			if (obj == undefined) {
				console.error("Can't remove nonexistent object with ID:", message.objectID)
			} else {
				obj.remove();
			}
		} else {
			console.error("Got mysterious message from server:", message)
		}
	}
	/**
	 * @param {string} typeID
	 * @param {number} objectID
	 * @param {Object} data
	 */
	createObject(typeID, objectID, data) {
		this.webSocket.send(JSON.stringify({
			action: "create_object",
			objectID,
			typeID,
			data
		}))
	}
	/**
	 * @param {number} objectID
	 */
	removeObject(objectID) {
		this.webSocket.send(JSON.stringify({
			action: "remove_object",
			objectID
		}))
	}
}

/**
 * List of drawing modes.
 * Each one takes in a list of stage points (drawn by the mouse),
 * and returns another list of stage points (to display).
 * @typedef {(points: { x: number, y: number }[]) => { x: number, y: number }[]} DrawingMode
 * @type {Object<string, DrawingMode>}
 */
var drawingModes = {
	"Normal": (points) => {
		return points
	},
	"Line": (points) => {
		return [
			points[0],
			points[points.length - 1]
		]
	},
	"Rectangle": (points) => {
		var start = points[0]
		var end = points[points.length - 1]
		return [
			{ x: start.x, y: start.y },
			{ x: end.x, y: start.y },
			{ x: end.x, y: end.y },
			{ x: start.x, y: end.y },
			{ x: start.x, y: start.y }
		]
	},
	"Circle": (points) => {
		var start = points[0]
		var end = points[points.length - 1]
		var rx = Math.abs(end.x - start.x)
		var ry = Math.abs(end.y - start.y)
		var ravg = Math.sqrt((rx*rx) + (ry*ry))
		// Generate points (by using Ellipse)
		return drawingModes["Ellipse"]([
			start,
			{ x: start.x + ravg, y: start.y + ravg }
		])
	},
	"Ellipse": (points) => {
		var start = points[0]
		var end = points[points.length - 1]
		var rx = Math.abs(end.x - start.x)
		var ry = Math.abs(end.y - start.y)
		// Generate points
		var ellipsePoints = [];
		var resolution = 60;
		for (var i = 0; i <= resolution; i++) {
			var theta = 2 * Math.PI * (i / resolution);
			ellipsePoints.push({
				x: start.x + (rx * Math.cos(theta)),
				y: start.y + (ry * Math.sin(theta))
			});
		}
		return ellipsePoints;
	}
}
var selectedDrawingMode = "Normal"

class TrackedTouch {
	/**
	 * @param {Whiteboard} whiteboard
	 * @param {number} initialX
	 * @param {number} initialY
	 * @param {number} id
	 * @param {TrackedTouch[]} touches
	 * @param {boolean} isEraserButton
	 */
	constructor(whiteboard, initialX, initialY, id, touches, isEraserButton) {
		this.whiteboard = whiteboard
		this.x = initialX
		this.y = initialY
		this.id = id
		this.touches = touches
		this.mode = this.getMode(isEraserButton)
		// blur current element
		var a = document.activeElement
		if (a != null) {
			if (a instanceof HTMLElement) {
				a.blur()
			}
		}
	}
	/**
	 * @param {number} newX
	 * @param {number} newY
	 */
	updatePos(newX, newY) {
		this.mode.onMove(this.x, this.y, newX, newY)
		this.x = newX
		this.y = newY
	}
	remove() {
		this.mode.onEnd(this.x, this.y)
		this.touches.splice(this.touches.indexOf(this), 1)
	}
	cancel() {
		this.mode.onCancel(this.x, this.y)
		this.touches.splice(this.touches.indexOf(this), 1)
	}
	/**
	 * @param {boolean} isEraserButton
	 * @returns {TouchMode}
	 */
	getMode(isEraserButton) {
		if (isEraserButton) return new EraseTouchMode(this)
		// First of all, if there is another touch, we are definitely zooming or panning or something.
		if (this.touches.length >= 1) {
			// Also, so are all the other touches.
			var _t = [...this.touches]
			for (var i = 0; i < _t.length; i++) {
				_t[i].cancel()
				_t[i].mode = new PanTouchMode(_t[i])
				this.touches.push(_t[i])
			}
			return new PanTouchMode(this)
		}
		// Then, find the selected mode in the toolbar.
		var mode = getCurrentMode()
		if (mode == "Draw") return new DrawTouchMode(this, (() => {
			var color = document.querySelector("#draw-color")
			if (color == null) throw new Error("draw color picker is missing :(")
			if (! (color instanceof HTMLSelectElement)) throw new Error("draw color picker is weird looking :O")
			return color.value
		})(), drawingModes[selectedDrawingMode])
		if (mode == "Text") return new TextTouchMode(this)
		if (mode == "Move") return new PanTouchMode(this)
		if (mode == "Select") return new SelectTouchMode(this)
		if (mode == "Erase") return new EraseTouchMode(this)
		// Uhhhh.....
		return new PanTouchMode(this)
	}
	toString() {
		return `TrackedTouch { x: ${this.x}; y: ${this.y}; mode: ${this.mode.toString()} }`
	}
}
class TouchMode {
	/**
	 * @param {TrackedTouch} touch
	 */
	constructor(touch) {
		this.touch = touch
	}
	/**
	 * @param {number} previousX
	 * @param {number} previousY
	 * @param {number} newX
	 * @param {number} newY
	 */
	onMove(previousX, previousY, newX, newY) {}
	/**
	 * @param {number} previousX
	 * @param {number} previousY
	 */
	onEnd(previousX, previousY) {}
	/**
	 * @param {number} previousX
	 * @param {number} previousY
	 */
	onCancel(previousX, previousY) {}
	toString() {
		return `TouchMode { broken }`
	}
}
class DrawTouchMode extends TouchMode {
	/**
	 * @param {TrackedTouch} touch
	 * @param {string} color
	 * @param {DrawingMode} drawing_mode
	 */
	constructor(touch, color, drawing_mode) {
		super(touch)
		/** @type {{ x: number, y: number }[]} */
		this.points = [this.touch.whiteboard.viewport.getStagePosFromScreenPos(touch.x, touch.y)]
		/** @type {SVGPathElement} */
		this.elm = document.createElementNS("http://www.w3.org/2000/svg", "path")
		this.elm.setAttribute("fill", "none")
		this.elm.setAttribute("stroke", "red")
		this.elm.setAttribute("stroke-width", "5")
		theSVG.appendChild(this.elm)
		this.color = color
		this.drawing_mode = drawing_mode
	}
	/**
	 * @param {number} previousX
	 * @param {number} previousY
	 * @param {number} newX
	 * @param {number} newY
	 */
	onMove(previousX, previousY, newX, newY) {
		const _viewport = this.touch.whiteboard.viewport;
		this.points.push(_viewport.getStagePosFromScreenPos(this.touch.x, this.touch.y))
		// Find points to display
		var stagePoints = this.drawing_mode(this.points)
		var screenPoints = stagePoints.map((v) => _viewport.getScreenPosFromStagePos(v.x, v.y))
		this.elm.setAttribute("d", pointsToPath(screenPoints))
		// this.elm.setAttribute("stroke-width", (5 * viewPos.zoom).toString())
	}
	/**
	 * @param {number} previousX
	 * @param {number} previousY
	 */
	onEnd(previousX, previousY) {
		// Remove current display elm
		this.elm.remove()
		// Add drawing to screen
		if (this.points.length > 6) {
			this.touch.whiteboard.doAction(new USICreateObjects(this.touch.whiteboard, [{
				typeID: "drawing",
				objectID: SceneObject.generateObjectID(),
				data: {
					"d": this.drawing_mode(this.points),
					"color": this.color
				}
			}]))
		}
	}
	/**
	 * @param {number} previousX
	 * @param {number} previousY
	 */
	onCancel(previousX, previousY) {
		this.elm.remove()
	}
	toString() {
		return `DrawTouchMode { ${this.points.length} points }`
	}
}
class TextTouchMode extends TouchMode {
	/**
	 * @param {TrackedTouch} touch
	 */
	constructor(touch) {
		super(touch)
	}
	/**
	 * @param {number} previousX
	 * @param {number} previousY
	 * @param {number} newX
	 * @param {number} newY
	 */
	onMove(previousX, previousY, newX, newY) {
	}
	/**
	 * @param {number} previousX
	 * @param {number} previousY
	 */
	onEnd(previousX, previousY) {
		this.touch.whiteboard.doAction(new USICreateObjects(this.touch.whiteboard, [{
			typeID: "text",
			objectID: SceneObject.generateObjectID(),
			data: {
				"text": "Enter text here",
				"pos": this.touch.whiteboard.viewport.getStagePosFromScreenPos(previousX, previousY)
			}
		}]))
	}
	/**
	 * @param {number} previousX
	 * @param {number} previousY
	 */
	onCancel(previousX, previousY) {
	}
	toString() {
		return `TextTouchMode { }`
	}
}
class PanTouchMode extends TouchMode {
	/**
	 * @param {TrackedTouch} touch
	 */
	constructor(touch) {
		super(touch)
	}
	/**
	 * @param {number} previousX
	 * @param {number} previousY
	 * @param {number} newX
	 * @param {number} newY
	 */
	onMove(previousX, previousY, newX, newY) {
		var previousPos = {
			x: avg(this.touch.touches.map((v) => v.x)),
			y: avg(this.touch.touches.map((v) => v.y))
		}
		var previousZoom = avg(this.touch.touches.map((v) => dist(v, previousPos)))
		var target = this.touch
		var newPos = {
			x: avg(this.touch.touches.map((v) => (v == target ? newX : v.x))),
			y: avg(this.touch.touches.map((v) => (v == target ? newY : v.y)))
		}
		var newZoom = avg(this.touch.touches.map((v) => dist(v == target ? {x:newX,y:newY} : v, newPos)))
		var zoom = newZoom / previousZoom
		if (previousZoom == 0 || newZoom == 0) zoom = 1
		var viewport = this.touch.whiteboard.viewport;
		viewport.x += newPos.x - previousPos.x
		viewport.y += newPos.y - previousPos.y
		viewport.zoomView(newPos, zoom)
		// Update
		viewport.updateAllObjects()
	}
	toString() {
		return `PanTouchMode {}`
	}
}
class SelectTouchMode extends TouchMode {
	/**
	 * @param {TrackedTouch} touch
	 */
	constructor(touch) {
		super(touch)
		/** @type {{ x: number, y: number }} */
		this.startPos = this.touch.whiteboard.viewport.getStagePosFromScreenPos(touch.x, touch.y)
		/** @type {{ x: number, y: number }} */
		this.endPos = this.touch.whiteboard.viewport.getStagePosFromScreenPos(touch.x, touch.y)
		/** @type {SVGRectElement} */
		this.elm = document.createElementNS("http://www.w3.org/2000/svg", "rect")
		this.elm.setAttribute("fill", "#AAF8")
		theSVG.appendChild(this.elm)
	}
	/**
	 * @param {number} previousX
	 * @param {number} previousY
	 * @param {number} newX
	 * @param {number} newY
	 */
	onMove(previousX, previousY, newX, newY) {
		this.endPos = this.touch.whiteboard.viewport.getStagePosFromScreenPos(newX, newY)
		// Get screen locations
		var startStagePos = this.touch.whiteboard.viewport.getScreenPosFromStagePos(this.startPos.x, this.startPos.y)
		var endStagePos = this.touch.whiteboard.viewport.getScreenPosFromStagePos(this.endPos.x, this.endPos.y)
		// Apply rect width and height
		var width = endStagePos.x - startStagePos.x
		if (width >= 0) {
			this.elm.setAttribute("x", startStagePos.x.toString())
			this.elm.setAttribute("width", width.toString())
		} else {
			this.elm.setAttribute("x", (startStagePos.x + width).toString())
			this.elm.setAttribute("width", (-width).toString())
		}
		var height = endStagePos.y - startStagePos.y
		if (height >= 0) {
			this.elm.setAttribute("y", startStagePos.y.toString())
			this.elm.setAttribute("height", height.toString())
		} else {
			this.elm.setAttribute("y", (startStagePos.y + height).toString())
			this.elm.setAttribute("height", (-height).toString())
		}
	}
	/**
	 * @param {number} previousX
	 * @param {number} previousY
	 */
	onEnd(previousX, previousY) {
		// Remove current display elm
		this.elm.remove()
		// Normalize the rectangle
		var x = this.startPos.x
		var y = this.startPos.y
		var width = this.endPos.x - this.startPos.x
		if (width < 0) {
			x = this.endPos.x
			width = -width
		}
		var height = this.endPos.y - this.startPos.y
		if (height < 0) {
			y = this.endPos.y
			height = -height
		}
		var rectPos = { x, y }
		var rectSize = { x: width, y: height }
		// Select items!
		if (!this.touch.whiteboard.shiftKeyDown) this.touch.whiteboard.selection = []
		for (var i = 0; i < this.touch.whiteboard.objects.length; i++) {
			if (this.touch.whiteboard.selection.includes(this.touch.whiteboard.objects[i])) continue;
			if (this.touch.whiteboard.objects[i].colliderect(rectPos, rectSize)) {
				this.touch.whiteboard.selection.push(this.touch.whiteboard.objects[i])
			}
		}
		this.touch.whiteboard.updateAllObjects()
		this.touch.whiteboard.updateSelectionWindow()
	}
	/**
	 * @param {number} previousX
	 * @param {number} previousY
	 */
	onCancel(previousX, previousY) {
		this.elm.remove()
	}
	toString() {
		return `SelectTouchMode { start: ${this.startPos.x}, ${this.startPos.y}, end: ${this.endPos.x}, ${this.endPos.y} }`
	}
}
class EraseTouchMode extends TouchMode {
	/**
	 * @param {TrackedTouch} touch
	 */
	constructor(touch) {
		super(touch)
		this.touch.whiteboard.eraseAtPoint(this.touch.whiteboard.viewport.getStagePosFromScreenPos(touch.x, touch.y))
	}
	/**
	 * @param {number} previousX
	 * @param {number} previousY
	 * @param {number} newX
	 * @param {number} newY
	 */
	onMove(previousX, previousY, newX, newY) {
		this.touch.whiteboard.eraseAtPoint(this.touch.whiteboard.viewport.getStagePosFromScreenPos(this.touch.x, this.touch.y))
	}
	toString() {
		return `EraseTouchMode {}`
	}
}

class TouchHandler {
	/** @param {Whiteboard} whiteboard */
	constructor(whiteboard) {
		this.whiteboard = whiteboard
		/** @type {TrackedTouch[]} */
		this.touches = []
	}
	/**
	 * @param {number} id
	 * @param {{ x: number; y: number; }} pos
	 */
	mousemove(id, pos) {
		for (var i = 0; i < this.touches.length; i++) {
			if (this.touches[i].id == id) {
				this.touches[i].updatePos(pos.x, pos.y)
			}
		}
	}
	/**
	 * @param {number} id
	 */
	mouseup(id) {
		for (var i = 0; i < this.touches.length; i++) {
			if (this.touches[i].id == id) {
				this.touches[i].remove()
			}
		}
	}
	/**
	 * @param {number} id
	 */
	mousecancel(id) {
		for (var i = 0; i < this.touches.length; i++) {
			if (this.touches[i].id == id) {
				this.touches[i].cancel()
			}
		}
	}
	/** @param {TouchList} touchList */
	handleTouches(touchList) {
		// Check for new or updated touches
		for (var i = 0; i < touchList.length; i++) {
			// See if we already have this touch
			var touchID = touchList[i].identifier
			var idx = this.touches.findIndex((v) => v.id == touchID)
			if (idx == -1) {
				// New touch!
				var touch = new TrackedTouch(this.whiteboard, touchList[i].clientX, touchList[i].clientY, touchID, this.touches, false)
				this.touches.push(touch);
			} else {
				// Update existing touch!
				this.touches[idx].updatePos(touchList[i].clientX, touchList[i].clientY)
			}
		}
		// Check for old touches
		var _t = [...this.touches]
		for (var i = 0; i < _t.length; i++) {
			var touchID = _t[i].id
			var idx = [...touchList].findIndex((v) => v.identifier == touchID)
			if (idx == -1) {
				// Old touch!
				_t[i].remove()
			}
		}
	}
	addEventListeners() {
		const _this = this;
		// Mouse Listeners
		theSVG.parentElement?.addEventListener("mousedown", (e) => {
			if (e.target instanceof HTMLTextAreaElement && getCurrentMode() == "Text") return
			if (e.buttons == 4 || e.buttons == 5) {
				_this.mousecancel(0)
				this.touches.push(new TrackedTouch(_this.whiteboard, e.clientX, e.clientY, 0, _this.touches, true));
			} else {
				_this.mouseup(0)
				this.touches.push(new TrackedTouch(_this.whiteboard, e.clientX, e.clientY, 0, _this.touches, false));
			}
		});
		theSVG.parentElement?.addEventListener("mousemove", (e) => {
			_this.mousemove(0, {
				x: e.clientX,
				y: e.clientY
			});
		});
		theSVG.parentElement?.addEventListener("mouseup", (e) => {
			_this.mouseup(0);
		});
		theSVG.parentElement?.addEventListener("wheel", (e) => {
			_this.whiteboard.viewport.zoomView({
				x: e.clientX,
				y: e.clientY
			}, Math.pow(2, e.deltaY / -500));
			_this.whiteboard.updateAllObjects();
		});
		// Touch Listeners
		theSVG.parentElement?.addEventListener("touchstart", (e) => {
			if (e.target instanceof HTMLTextAreaElement && getCurrentMode() == "Text") return
			e.preventDefault();
			_this.handleTouches(e.touches)
			return false
		}, false);
		theSVG.parentElement?.addEventListener("touchmove", (e) => {
			if (e.target instanceof HTMLTextAreaElement && getCurrentMode() == "Text") return
			e.preventDefault();
			_this.handleTouches(e.touches)
			return false
		}, false);
		theSVG.parentElement?.addEventListener("touchcancel", (e) => {
			if (e.target instanceof HTMLTextAreaElement && getCurrentMode() == "Text") return
			e.preventDefault();
			_this.handleTouches(e.touches)
			return false
		}, false);
		theSVG.parentElement?.addEventListener("touchend", (e) => {
			if (e.target instanceof HTMLTextAreaElement && getCurrentMode() == "Text") return
			e.preventDefault();
			_this.handleTouches(e.touches)
			return false
		}, false);
	}
}

class UndoStackItem {
	/** @param {Whiteboard} whiteboard */
	constructor(whiteboard) { this.whiteboard = whiteboard; }
	do() { throw new Error(`"UndoStackItem" is an abstract class, "do" must be overridden`); }
	/** @returns {UndoStackItem} */
	invert() { throw new Error(`"UndoStackItem" is an abstract class, "invert" must be overridden`); }
}
class DummyUndoStackItem extends UndoStackItem {
	/**
	 * @param {Whiteboard} whiteboard
	 * @param {number} n
	 * @param {boolean} inverted
	 */
	constructor(whiteboard, n, inverted) { super(whiteboard); this.n = n; this.inverted = inverted; }
	do() {
		console.log(this.inverted ? "redo" : "undo", this.n)
	}
	invert() { return new DummyUndoStackItem(this.whiteboard, this.n, !this.inverted) }
}
class USICreateObjects extends UndoStackItem {
	/**
	 * @param {Whiteboard} whiteboard
	 * @param {{ typeID: string, objectID: number, data: Object }[]} objects
	 */
	constructor(whiteboard, objects) { super(whiteboard); this.objects = objects; }
	do() {
		for (var o of this.objects) {
			SceneObject.createFromDataAndID(this.whiteboard, o.typeID, o.data, o.objectID);
			this.whiteboard.connection.createObject(o.typeID, o.objectID, o.data);
		}
	}
	invert() { return new USIEraseObjects(this.whiteboard, [...this.objects]) }
}
class USIEraseObjects extends UndoStackItem {
	/**
	 * @param {Whiteboard} whiteboard
	 * @param {{ typeID: string, objectID: number, data: Object }[]} objects
	 */
	constructor(whiteboard, objects) { super(whiteboard); this.objects = objects; }
	do() {
		for (var o of this.objects) {
			this.whiteboard.findObject(o.objectID).unverify();
			this.whiteboard.connection.removeObject(o.objectID);
		}
	}
	invert() { return new USICreateObjects(this.whiteboard, [...this.objects]) }
}



var whiteboard = new Whiteboard()

