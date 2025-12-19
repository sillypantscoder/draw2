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

(function updateViewPos() {
	mainCanvas.width = window.innerWidth
	mainCanvas.height = window.innerHeight
})();

class SceneObject {
	static typeID = "[ERROR]"
	/**
	 * @param {number} id
	 * @param {Object<string, any>} data
	 */
	constructor(id, data) {
		this.data = data
		this.objectID = id
		/** @type {number | null} */
		this.editedTime = null;
		this.verified = false;
	}
	add() {}
	verify() { this.verified = true; }
	unverify() { this.verified = false; }
	reload() {}
	/**
	 * @param {Viewport} viewport
	 * @param {CanvasRenderingContext2D} canvas
	 * @param {boolean} selected
	 */
	draw(viewport, canvas, selected) {}
	remove() {}
	/**
	 * Creates an object given its type ID, object ID, and data. Does not add the object to the screen.
	 * @param {String} typeID
	 * @param {Object<string, any>} data
	 * @param {number} id
	 * @returns {SceneObject}
	 */
	static createFromDataAndID(typeID, data, id) {
		var objClass = objectTypes[typeID]
		var o = new objClass(id, data)
		return o
	}
	static generateObjectID() {
		return Math.floor(Math.random() * 10000000)
	}
	/**
	 * @param {Viewport} viewport
	 * @param {{ x: number, y: number }} pos
	 */
	collidepoint(viewport, pos) {
		return true
	}
	/**
	 * @param {Viewport} viewport
	 * @param {{ x: number, y: number }} pos
	 * @param {{ x: number, y: number }} size
	 */
	colliderect(viewport, pos, size) {
		return true
	}
	/** @returns {string} */
	// @ts-ignore
	getTypeID() { return this.constructor.typeID; }
}
class DrawingObject extends SceneObject {
	static typeID = "drawing"
	/**
	 * @param {number} id
	 * @param {Object<string, any>} data
	 */
	constructor(id, data) {
		super(id, data)
		/** @type {{ x: number, y: number }[]} */
		this.path = data.d
		this.color = data.color
	}
	reload() {
		this.path = this.data.d
		this.color = this.data.color
	}
	/**
	 * @param {Viewport} viewport
	 * @param {CanvasRenderingContext2D} canvas
	 * @param {boolean} selected
	 */
	draw(viewport, canvas, selected) {
		canvas.fillStyle = "none"
		canvas.strokeStyle = selected ? "blue" : this.color
		canvas.lineWidth = selected ? 8 : 5
		canvas.globalAlpha = this.verified ? 1 : 0.5
		// Draw lines
		canvas.beginPath()
		let drawPos = viewport.getScreenPosFromStagePos(this.path[0].x, this.path[0].y); canvas.moveTo(drawPos.x, drawPos.y);
		for (var i = 1; i < this.path.length; i++) {
			let drawPos = viewport.getScreenPosFromStagePos(this.path[i].x, this.path[i].y); canvas.lineTo(drawPos.x, drawPos.y);
		}
		canvas.stroke()
	}
	/**
	 * @param {Viewport} viewport
	 * @param {{ x: number, y: number }} pos
	 */
	collidepoint(viewport, pos) {
		for (var i = 0; i < this.path.length - 1; i++) {
			if (distanceBetweenPointAndLineSegment(pos, this.path[i], this.path[i + 1]) < 3 / viewport.zoom) {
				return true
			}
		}
		return false
	}
	/**
	 * @param {Viewport} viewport
	 * @param {{ x: number, y: number }} pos
	 * @param {{ x: number, y: number }} size
	 */
	colliderect(viewport, pos, size) {
		for (var i = 0; i < this.path.length; i++) {
			var px = this.path[i].x
			var py = this.path[i].y
			if (px >= pos.x && px <= pos.x + size.x && py >= pos.y && py <= pos.y + size.y) return true
		}
		return false;
	}
}
class TextObject extends SceneObject {
	static typeID = "text"
	/**
	 * @param {number} id
	 * @param {Object<string, any>} data
	 */
	constructor(id, data) {
		super(id, data)
		/** @type {{ x: number, y: number }} */
		this.pos = data.pos
		/** @type {string} */
		this.text = data.text
		/** @type {HTMLTextAreaElement} */
		this.elm = TextObject.createTextarea()
		this.elm.setAttribute("class", "unverified")
		// Add event listeners
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
			// Save new text
			_text.text = _text.elm.value
			_text.data.text = _text.text
			if (_text.editedTime == null) _text.editedTime = Date.now()
			// Update text height
			_text.elm.dataset.width = (Math.max(..._text.elm.value.split("\n").map((v) => v.length)) + 3) + "ch"
			_text.elm.style.height = "";
			_text.elm.dataset.height = "calc(" + _text.elm.scrollHeight + "px + 0.25em)"
		})
		this.elm.addEventListener("blur", () => {
			_text.elm.dispatchEvent(new KeyboardEvent("input"))
		})
		// Set textarea initial value
		_text.elm.value = _text.text
		requestAnimationFrame(() => {
			_text.elm.dispatchEvent(new KeyboardEvent("input"))
			_text.editedTime = null
		})
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
	reload() {
		if (document.activeElement == this.elm) return;
		this.pos = this.data.pos
		this.elm.value = this.data.text
		this.elm.dispatchEvent(new KeyboardEvent("input"))
		this.editedTime = null
	}
	/**
	 * @param {Viewport} viewport
	 * @param {CanvasRenderingContext2D} canvas
	 * @param {boolean} selected
	 */
	draw(viewport, canvas, selected) {
		// No canvas drawing is needed
		this.elm.setAttribute("style", `top: ${(this.pos.y * viewport.zoom) + viewport.y}px; left: ${(this.pos.x * viewport.zoom) + viewport.x}px; width: ${this.elm.dataset.width}; height: ${this.elm.dataset.height}; transform: scale(${viewport.zoom}); transform-origin: 0px 0px;`)
		// Focus
		if (selected) {
			this.elm.classList.add("focus-shadow")
		} else {
			this.elm.classList.remove("focus-shadow")
		}
	}
	remove() {
		super.remove()
		this.elm.remove()
	}
	/**
	 * @param {Viewport} viewport
	 * @param {{ x: number, y: number }} pos
	 */
	collidepoint(viewport, pos) {
		var screenPos = viewport.getScreenPosFromStagePos(pos.x, pos.y)
		return document.elementsFromPoint(screenPos.x, screenPos.y).includes(this.elm)
	}
	/**
	 * @param {Viewport} viewport
	 * @param {{ x: number, y: number }} pos
	 * @param {{ x: number, y: number }} size
	 */
	colliderect(viewport, pos, size) {
		var elementRect = this.elm.getBoundingClientRect()
		var stageSize = { x: elementRect.width / viewport.zoom, y: elementRect.height / viewport.zoom }
		// stagePos = this.pos
		return pos.x <= this.pos.x + stageSize.x && pos.x + size.x >= this.pos.x && pos.y <= this.pos.y + stageSize.y && pos.y + size.y >= this.pos.y
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
	constructor() {
		this.x = 0;
		this.y = 0;
		this.zoom = 1;
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
class Renderer {
	/** @param {Whiteboard} whiteboard */
	constructor(whiteboard) {
		this.whiteboard = whiteboard;
		this.loopID = 0;
	}
	render() {
		mainCanvasCtx.clearRect(0, 0, mainCanvas.width, mainCanvas.height)
		mainCanvasCtx.lineCap = "round"
		mainCanvasCtx.lineJoin = "round"
		for (var i = 0; i < this.whiteboard.objects.length; i++) {
			var obj = this.whiteboard.objects[i];
			obj.draw(this.whiteboard.viewport, mainCanvasCtx, this.whiteboard.selection.includes(obj))
		}
		// Render touches
		for (var i = 0; i < this.whiteboard.touchHandler.touches.length; i++) {
			var touch = this.whiteboard.touchHandler.touches[i];
			touch.mode.render(this.whiteboard.viewport, mainCanvasCtx)
		}
	}
	checkForEditedObjects() {
		for (var i = 0; i < this.whiteboard.objects.length; i++) {
			var obj = this.whiteboard.objects[i];
			// Is edited?
			if (obj.editedTime == null) continue;
			var timeDelta = Date.now() - obj.editedTime;
			if (timeDelta > 500) {
				this.whiteboard.connection.editObject(obj.objectID, obj.data)
				obj.editedTime = null
			}
		}
	}
	async renderLoop() {
		while (true) {
			await new Promise((resolve) => requestAnimationFrame(resolve));
			this.render()
			this.checkForEditedObjects()
		}
	}
}
class Whiteboard {
	constructor() {
		this.viewport = new Viewport()
		/** @type {SceneObject[]} */
		this.objects = []
		/** @type {SceneObject[]} */
		this.selection = []
		this.connection = new Connection(this)
		this.renderer = new Renderer(this)
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
			this.updateSelectionWindow()
		}).bind(this))
		this.updateUndoButtons()
	}
	/** @param {SceneObject} obj */
	add(obj) {
		this.objects.push(obj)
		obj.add()
	}
	/** @param {SceneObject} obj */
	remove(obj) {
		this.objects.splice(this.objects.indexOf(obj), 1)
		obj.remove()
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
			if (o[i].verified && o[i].collidepoint(this.viewport, pos)) {
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
		/** @type {{ type: "error", data: string } | { type: "create_object", objectID: number, typeID: string, data: Object } | { type: "remove_object", objectID: number } | { type: "edit_object", objectID: number, newData: Object }} */
		var message = JSON.parse(msgEvent.data)
		if (message.type == "error") {
			console.error("[Server]", message.data)
		} else if (message.type == "create_object") {
			// Search for existing object
			var obj = this.whiteboard.findObjectSafe(message.objectID)
			// Create new object?
			if (obj == undefined) {
				obj = SceneObject.createFromDataAndID(message.typeID, message.data, message.objectID)
				this.whiteboard.add(obj)
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
				this.whiteboard.remove(obj);
			}
		} else if (message.type == "edit_object") {
			// Find object
			var obj = this.whiteboard.findObjectSafe(message.objectID)
			// Remove
			if (obj == undefined) {
				console.error("Can't edit nonexistent object with ID:", message.objectID)
			} else {
				obj.data = message.newData
				obj.reload()
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
	/**
	 * @param {number} objectID
	 * @param {Object} newData
	 */
	editObject(objectID, newData) {
		this.webSocket.send(JSON.stringify({
			action: "edit_object",
			objectID,
			newData
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
	 * @param {Viewport} viewport
	 * @param {CanvasRenderingContext2D} canvas
	 */
	render(viewport, canvas) {}
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
		this.points = [this.getSavedTouchPos()]
		this.color = color
		this.drawing_mode = drawing_mode
	}
	getSavedTouchPos() {
		var exactScreenPos = this.touch.whiteboard.viewport.getStagePosFromScreenPos(this.touch.x, this.touch.y)
		var zoomLevel = this.touch.whiteboard.viewport.zoom * 50
		zoomLevel = Math.pow(10, Math.floor(Math.log10(zoomLevel)));
		return {
			x: Math.round(exactScreenPos.x * zoomLevel) / zoomLevel,
			y: Math.round(exactScreenPos.y * zoomLevel) / zoomLevel
		}
	}
	/**
	 * @param {Viewport} viewport
	 * @param {CanvasRenderingContext2D} canvas
	 */
	render(viewport, canvas) {
		canvas.fillStyle = "none"
		canvas.strokeStyle = "red"
		canvas.lineWidth = 5
		canvas.globalAlpha = 1
		// Get lines from drawing mode
		var points = this.drawing_mode([...this.points])
		// Draw lines
		canvas.beginPath()
		let drawPos = viewport.getScreenPosFromStagePos(points[0].x, points[0].y); canvas.moveTo(drawPos.x, drawPos.y);
		for (var i = 1; i < points.length; i++) {
			let drawPos = viewport.getScreenPosFromStagePos(points[i].x, points[i].y); canvas.lineTo(drawPos.x, drawPos.y);
		}
		canvas.stroke()
	}
	/**
	 * @param {number} previousX
	 * @param {number} previousY
	 * @param {number} newX
	 * @param {number} newY
	 */
	onMove(previousX, previousY, newX, newY) {
		var newPos = this.getSavedTouchPos()
		if (this.points.at(-1)?.x == newPos.x && this.points.at(-1)?.y == newPos.y) return;
		this.points.push(newPos)
	}
	/**
	 * @param {number} previousX
	 * @param {number} previousY
	 */
	onEnd(previousX, previousY) {
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
	onCancel(previousX, previousY) {}
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
	}
	/**
	 * @param {Viewport} viewport
	 * @param {CanvasRenderingContext2D} canvas
	 */
	render(viewport, canvas) {
		canvas.fillStyle = "#AAF"
		canvas.strokeStyle = "none"
		canvas.globalAlpha = 0.5
		// Draw rectangle
		var screenStartPos = viewport.getScreenPosFromStagePos(this.startPos.x, this.startPos.y);
		var screenEndPos = viewport.getScreenPosFromStagePos(this.endPos.x, this.endPos.y);
		var actualSize = { x: screenEndPos.x - screenStartPos.x, y: screenEndPos.y - screenStartPos.y }
		canvas.fillRect(screenStartPos.x, screenStartPos.y, actualSize.x, actualSize.y)
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
		// var width = endStagePos.x - startStagePos.x
		// if (width >= 0) {
		// 	this.elm.setAttribute("x", startStagePos.x.toString())
		// 	this.elm.setAttribute("width", width.toString())
		// } else {
		// 	this.elm.setAttribute("x", (startStagePos.x + width).toString())
		// 	this.elm.setAttribute("width", (-width).toString())
		// }
		// var height = endStagePos.y - startStagePos.y
		// if (height >= 0) {
		// 	this.elm.setAttribute("y", startStagePos.y.toString())
		// 	this.elm.setAttribute("height", height.toString())
		// } else {
		// 	this.elm.setAttribute("y", (startStagePos.y + height).toString())
		// 	this.elm.setAttribute("height", (-height).toString())
		// }
	}
	/**
	 * @param {number} previousX
	 * @param {number} previousY
	 */
	onEnd(previousX, previousY) {
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
			if (this.touch.whiteboard.objects[i].colliderect(this.touch.whiteboard.viewport, rectPos, rectSize)) {
				this.touch.whiteboard.selection.push(this.touch.whiteboard.objects[i])
			}
		}
		this.touch.whiteboard.updateSelectionWindow()
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
		// Get main element
		var mainContainer = document.querySelector(".mainContainer")
		if (mainContainer == null) throw new Error("Main container is missing!")
		if (! (mainContainer instanceof HTMLElement)) throw new Error("Main container is not HTML!")
		// Mouse Listeners
		mainContainer.addEventListener("mousedown", (e) => {
			if (e.target instanceof HTMLTextAreaElement && getCurrentMode() == "Text") return
			if (e.buttons == 4 || e.buttons == 5) {
				_this.mousecancel(0)
				this.touches.push(new TrackedTouch(_this.whiteboard, e.clientX, e.clientY, 0, _this.touches, true));
			} else {
				_this.mouseup(0)
				this.touches.push(new TrackedTouch(_this.whiteboard, e.clientX, e.clientY, 0, _this.touches, false));
			}
		});
		mainContainer.addEventListener("mousemove", (e) => {
			_this.mousemove(0, {
				x: e.clientX,
				y: e.clientY
			});
		});
		mainContainer.addEventListener("mouseup", (e) => {
			_this.mouseup(0);
		});
		mainContainer.addEventListener("wheel", (e) => {
			_this.whiteboard.viewport.zoomView({
				x: e.clientX,
				y: e.clientY
			}, Math.pow(2, e.deltaY / -500));
		});
		// Touch Listeners
		mainContainer.addEventListener("touchstart", (e) => {
			if (e.target instanceof HTMLTextAreaElement && getCurrentMode() == "Text") return
			e.preventDefault();
			_this.handleTouches(e.touches)
			return false
		}, false);
		mainContainer.addEventListener("touchmove", (e) => {
			if (e.target instanceof HTMLTextAreaElement && getCurrentMode() == "Text") return
			e.preventDefault();
			_this.handleTouches(e.touches)
			return false
		}, false);
		mainContainer.addEventListener("touchcancel", (e) => {
			if (e.target instanceof HTMLTextAreaElement && getCurrentMode() == "Text") return
			e.preventDefault();
			_this.handleTouches(e.touches)
			return false
		}, false);
		mainContainer.addEventListener("touchend", (e) => {
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
			this.whiteboard.add(SceneObject.createFromDataAndID(o.typeID, o.data, o.objectID));
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
whiteboard.renderer.renderLoop()
