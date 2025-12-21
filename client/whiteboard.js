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
/** @param {string} mode */
function setCurrentMode(mode) {
	var button = document.querySelector(`.menu-option[data-mode="${mode}"]`);
	if (button == null) throw new Error("Not a valid mode")
	if (! (button instanceof HTMLElement)) throw new Error(`Element for mode "${mode}" is not HTML`)
	button.click()
}

(function updateViewPos() {
	mainCanvas.width = window.innerWidth
	mainCanvas.height = window.innerHeight
})();

/** @param {Rect[]} rects */
function getBoundingBox(rects) {
	var leftPos = Infinity;
	var topPos = Infinity;
	var rightPos = -Infinity;
	var bottomPos = -Infinity;
	for (var rect of rects) {
		if (rect.x < leftPos) leftPos = rect.x
		if (rect.y < topPos) topPos = rect.y
		if (rect.x + rect.w > rightPos) rightPos = rect.x + rect.w
		if (rect.y + rect.h > bottomPos) bottomPos = rect.y + rect.h
	}
	var width = rightPos - leftPos;
	var height = bottomPos - topPos;
	return { x: leftPos, y: topPos, w: width, h: height }
}

class SceneObject {
	static typeID = "[ERROR]"
	/**
	 * @param {number} id
	 * @param {number} layer
	 * @param {Object<string, any>} data
	 */
	constructor(id, layer, data) {
		this.objectID = id
		this.layer = layer
		this.data = data
		this._originalData = structuredClone(this.data)
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
	 * @param {boolean} onAnotherLayer
	 */
	draw(viewport, canvas, selected, onAnotherLayer) {}
	remove() {}
	/**
	 * Creates an object given its type ID, object ID, and data. Does not add the object to the screen.
	 * @param {number} objectID
	 * @param {number} layer
	 * @param {String} typeID
	 * @param {Object<string, any>} data
	 * @returns {SceneObject}
	 */
	static createFromDataAndID(objectID, layer, typeID, data) {
		var objClass = objectTypes[typeID]
		var o = new objClass(objectID, layer, data)
		return o
	}
	static generateObjectID() {
		return Math.floor(Math.random() * 10000000)
	}
	/**
	 * @param {Viewport} viewport
	 * @returns {Rect}
	 */
	getBoundingRect(viewport) {
		throw new Error()
	}
	/**
	 * @param {Viewport} viewport
	 * @param {Line} line
	 */
	collideline(viewport, line) {
		return true
	}
	/**
	 * @param {Viewport} viewport
	 * @param {Rect} rect
	 */
	colliderect(viewport, rect) {
		return true
	}
	/**
	 * @param {number} dx
	 * @param {number} dy
	 */
	linearMove(dx, dy) {
		this.editedTime = Date.now()
	}
	/**
	 * @param {Viewport} viewport
	 * @param {Rect} boundingBox
	 * @returns {Handle[]}
	 */
	getHandles(viewport, boundingBox) { return []; }
	/** @returns {string} */
	// @ts-ignore
	getTypeID() { return this.constructor.typeID; }
}
class DrawingObject extends SceneObject {
	static typeID = "drawing"
	/**
	 * @param {number} id
	 * @param {number} layer
	 * @param {Object<string, any>} data
	 */
	constructor(id, layer, data) {
		super(id, layer, data)
		/** @type {Point[]} */
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
	 * @param {boolean} onAnotherLayer
	 */
	draw(viewport, canvas, selected, onAnotherLayer) {
		canvas.fillStyle = "none"
		canvas.strokeStyle = selected ? "blue" : this.color
		canvas.lineWidth = selected ? 8 : 5
		canvas.globalAlpha = (this.verified ? 1 : 0.5) * (onAnotherLayer ? 0.25 : 1)
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
	 * @returns {Rect}
	 */
	getBoundingRect(viewport) {
		let minX = this.path[0].x;
		let minY = this.path[0].y;
		let maxX = this.path[0].x;
		let maxY = this.path[0].y;
		for (let i = 1; i < this.path.length; i++) {
			const pt = this.path[i];
			if (pt.x < minX) minX = pt.x;
			if (pt.y < minY) minY = pt.y;
			if (pt.x > maxX) maxX = pt.x;
			if (pt.y > maxY) maxY = pt.y;
		}
		return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
	}
	/**
	 * @param {Viewport} viewport
	 * @param {Line} line
	 */
	collideline(viewport, line) {
		for (var i = 0; i < this.path.length - 1; i++) {
			if (line_intersects_line({ start: this.path[i], end: this.path[i + 1] }, line)) {
				return true
			}
		}
		return false
	}
	/**
	 * @param {Viewport} viewport
	 * @param {Rect} rect
	 */
	colliderect(viewport, rect) {
		for (var i = 0; i < this.path.length - 1; i++) {
			if (rectangleIntersectsLine(rect, { start: this.path[i], end: this.path[i + 1] })) {
				return true
			}
		}
		return false;
	}
	/**
	 * @param {number} dx
	 * @param {number} dy
	 */
	linearMove(dx, dy) {
		for (var pos of this.path) {
			pos.x += dx;
			pos.y += dy;
		}
		this.data.d = this.path
		super.linearMove(dx, dy);
	}
}
class TextObject extends SceneObject {
	static typeID = "text"
	/**
	 * @param {number} id
	 * @param {number} layer
	 * @param {Object<string, any>} data
	 */
	constructor(id, layer, data) {
		super(id, layer, data)
		/** @type {Point} */
		this.pos = data.pos
		/** @type {number} */
		this.scale = data.scale
		/** @type {number} */
		this.width = data.width
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
			// Update textbox size
			var previousHeight = _text.elm.style.height;
			_text.elm.style.height = "0px";
			_text.elm.dataset.height = "calc(" + _text.elm.scrollHeight + "px + 0.25em)"
			_text.elm.style.height = previousHeight;
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
		super.verify()
		this.elm.removeAttribute("class")
	}
	unverify() {
		super.unverify()
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
	 * @param {boolean} onAnotherLayer
	 */
	draw(viewport, canvas, selected, onAnotherLayer) {
		// No canvas drawing is needed
		this.elm.setAttribute("style", `top: ${(this.pos.y * viewport.zoom) + viewport.y}px; left: ${(this.pos.x * viewport.zoom) + viewport.x}px; \
width: ${this.width}px; height: ${this.elm.dataset.height}; transform: scale(${viewport.zoom * this.scale}); transform-origin: 0px 0px;`)
		// Focus
		if (selected) {
			this.elm.classList.add("focus-shadow")
		} else {
			this.elm.classList.remove("focus-shadow")
		}
		// Layer
		if (onAnotherLayer) {
			this.elm.classList.add("another-layer")
		} else {
			this.elm.classList.remove("another-layer")
		}
	}
	remove() {
		super.remove()
		this.elm.remove()
	}
	/**
	 * @param {Viewport} viewport
	 * @returns {Rect}
	 */
	getBoundingRect(viewport) {
		var elementRect = this.elm.getBoundingClientRect()
		var stageSize = { x: elementRect.width / viewport.zoom, y: elementRect.height / viewport.zoom }
		// stagePos = this.pos
		return {
			x: this.pos.x,
			y: this.pos.y,
			w: stageSize.x,
			h: stageSize.y
		}
	}
	/**
	 * @param {Viewport} viewport
	 * @param {Line} line
	 */
	collideline(viewport, line) {
		var screenPosStart = viewport.getScreenPosFromStagePos(line.start.x, line.start.y)
		var screenPosEnd = viewport.getScreenPosFromStagePos(line.end.x, line.end.y)
		var domRect = this.elm.getBoundingClientRect()
		return rectangleIntersectsLine({ x: domRect.x, y: domRect.y, w: domRect.width, h: domRect.height }, { start: screenPosStart, end: screenPosEnd })
	}
	/**
	 * @param {Viewport} viewport
	 * @param {Rect} rect
	 */
	colliderect(viewport, rect) {
		var elementRect = this.elm.getBoundingClientRect()
		var stageSize = { x: elementRect.width / viewport.zoom, y: elementRect.height / viewport.zoom }
		// stagePos = this.pos
		return rect.x <= this.pos.x + stageSize.x && rect.x + rect.w >= this.pos.x && rect.y <= this.pos.y + stageSize.y && rect.y + rect.h >= this.pos.y
	}
	/**
	 * @param {number} dx
	 * @param {number} dy
	 */
	linearMove(dx, dy) {
		this.pos.x += dx;
		this.pos.y += dy;
		this.data.pos = this.pos
		super.linearMove(dx, dy);
	}
	/**
	 * @param {Viewport} viewport
	 * @param {Rect} boundingBox
	 * @returns {Handle[]}
	 */
	getHandles(viewport, boundingBox) { return [new TextBoxWidthHandle(viewport, this, boundingBox), new RescalingHandle(viewport, this, boundingBox)]; }
	static createTextarea() {
		var t = document.createElementNS("http://www.w3.org/1999/xhtml", "textarea")
		if (! (t instanceof HTMLTextAreaElement)) {
			throw new Error("newly created element is of the wrong type!!! (This error is definitely not possible)")
		}
		return t
	}
}
class ImageObject extends SceneObject {
	static typeID = "image"
	/**
	 * @param {number} id
	 * @param {number} layer
	 * @param {Object<string, any>} data
	 */
	constructor(id, layer, data) {
		super(id, layer, data)
		/** @type {Point} */
		this.pos = { x: data.x, y: data.y }
		/** @type {number} */
		this.scale = data.scale
		/** @type {string} */
		this.imageData = data.imageData
		delete data.imageData
		/** @type {HTMLImageElement | null} */
		this.loadedImage = null
		this.reload()
	}
	reload() {
		this.pos = { x: this.data.x, y: this.data.y }
		this.scale = this.data.scale
		// Load Image
		/** @type {HTMLImageElement} */
		var image = new Image()
		image.src = "data:image/webp;base64," + this.imageData
		image.onload = (() => {
			this.loadedImage = image
		}).bind(this)
	}
	/**
	 * @param {Viewport} viewport
	 * @param {CanvasRenderingContext2D} canvas
	 * @param {boolean} selected
	 * @param {boolean} onAnotherLayer
	 */
	draw(viewport, canvas, selected, onAnotherLayer) {
		// Draw image onto canvas
		if (this.loadedImage != null) {
			// Find position
			var imagePos = viewport.getScreenPosFromStagePos(this.pos.x, this.pos.y)
			var width = this.loadedImage.width * this.scale * viewport.zoom
			var height = this.loadedImage.height * this.scale * viewport.zoom
			// Draw image
			canvas.globalAlpha = (this.verified ? 1 : 0.5) * (onAnotherLayer ? 0.25 : 1)
			canvas.drawImage(this.loadedImage, imagePos.x, imagePos.y, width, height)
		} else {
			// fallback :(
			canvas.fillStyle = "black"
			canvas.strokeStyle = "none"
			canvas.globalAlpha = 0.5 * (this.verified ? 1 : 0.5) * (onAnotherLayer ? 0.25 : 1)
			canvas.fillRect(this.pos.x, this.pos.y, 50 * this.scale, 50 * this.scale)
		}
	}
	/**
	 * @param {Viewport} viewport
	 * @returns {Rect}
	 */
	getBoundingRect(viewport) {
		return {
			x: this.pos.x,
			y: this.pos.y,
			w: (this.loadedImage?.width ?? 50) * this.scale,
			h: (this.loadedImage?.height ?? 50) * this.scale
		}
	}
	/**
	 * @param {Viewport} viewport
	 * @param {Line} line
	 */
	collideline(viewport, line) {
		return rectangleIntersectsLine({ x: this.pos.x, y: this.pos.y, w: this.loadedImage?.width ?? 50, h: this.loadedImage?.height ?? 50 }, line)
	}
	/**
	 * @param {Viewport} viewport
	 * @param {Rect} rect
	 */
	colliderect(viewport, rect) {
		var stageSize = { x: (this.loadedImage?.width ?? 50) * this.scale, y: (this.loadedImage?.height ?? 50) * this.scale }
		// stagePos = this.pos
		return rect.x <= this.pos.x + stageSize.x && rect.x + rect.w >= this.pos.x && rect.y <= this.pos.y + stageSize.y && rect.y + rect.h >= this.pos.y
	}
	/**
	 * @param {number} dx
	 * @param {number} dy
	 */
	linearMove(dx, dy) {
		this.pos.x += dx;
		this.pos.y += dy;
		this.data.x = this.pos.x
		this.data.y = this.pos.y
		super.linearMove(dx, dy);
	}
	/**
	 * @param {Viewport} viewport
	 * @param {Rect} boundingBox
	 * @returns {Handle[]}
	 */
	getHandles(viewport, boundingBox) { return [new RescalingHandle(viewport, this, boundingBox)]; }
}

/** @type {Object<string, typeof SceneObject>} */
const objectTypes = (() => {
	/** @type {Object<string, typeof SceneObject>} */
	var objectTypes = {};
	for (var cls of [
		DrawingObject,
		TextObject,
		ImageObject
	]) {
		objectTypes[cls.typeID] = cls;
	}
	return objectTypes;
})();

class Handle {
	/** @param {Viewport} viewport */
	constructor(viewport) {
		this.viewport = viewport
		this.pos = { x: 0, y: 0 }
		this.isDragging = false;
	}
	/**
	 * @param {number} x
	 * @param {number} y
	 */
	moveTo(x, y) {
		this.pos.x = x
		this.pos.y = y
	}
	finishMovement() {
		this.isDragging = false;
	}
}
class LinearMovementHandle extends Handle {
	/**
	 * @param {Viewport} viewport
	 * @param {{ objects: SceneObject[], boundingBox: Rect, handles: Handle[] }} selection
	 */
	constructor(viewport, selection) {
		super(viewport)
		this.selection = selection
		// Find handle position
		this.pos.x = this.selection.boundingBox.x;
		this.pos.y = this.selection.boundingBox.y;
	}
	/**
	 * @param {number} x
	 * @param {number} y
	 */
	moveTo(x, y) {
		var dx = x - this.pos.x
		var dy = y - this.pos.y
		this.pos.x = x
		this.pos.y = y
		// Move rect
		this.selection.boundingBox.x += dx;
		this.selection.boundingBox.y += dy;
		// Move objects
		for (var o of this.selection.objects) {
			o.linearMove(dx, dy)
		}
	}
}
class TextBoxWidthHandle extends Handle {
	/**
	 * @param {Viewport} viewport
	 * @param {TextObject} selection
	 * @param {Rect} boundingBox
	 */
	constructor(viewport, selection, boundingBox) {
		super(viewport)
		this.selection = selection
		this.rect = boundingBox;
		// Find handle position
		this.pos.x = this.rect.x + this.rect.w;
		this.pos.y = this.rect.y;
	}
	/**
	 * @param {number} x
	 * @param {number} y
	 */
	moveTo(x, y) {
		this.pos.x = Math.max(x, this.rect.x + 30);
		// Move object
		this.selection.width = (this.pos.x - this.rect.x) / this.selection.scale;
		this.selection.data.width = this.selection.width;
		this.selection.elm.dispatchEvent(new InputEvent("input"))
		// Move rect
		this.rect.w = this.selection.width;
		this.rect.h = this.selection.elm.getBoundingClientRect().height;
	}
}
class RescalingHandle extends Handle {
	/**
	 * @param {Viewport} viewport
	 * @param {TextObject | ImageObject} selection
	 * @param {Rect} boundingBox
	 */
	constructor(viewport, selection, boundingBox) {
		super(viewport)
		this.selection = selection
		this.rect = boundingBox;
		// Find handle position
		this.pos.x = this.rect.x + this.rect.w;
		this.pos.y = this.rect.y + this.rect.h;
	}
	/**
	 * @param {number} x
	 * @param {number} y
	 */
	moveTo(x, y) {
		this.pos.x = Math.max(x, this.rect.x + 5);
		var scaleFactor = (x - this.rect.x) / this.rect.w;
		this.pos.y = this.rect.y + (scaleFactor * (this.pos.y - this.rect.y))
		// Move object
		this.selection.scale *= scaleFactor;
		this.selection.data.scale = this.selection.scale;
		if (this.selection instanceof TextObject) {
			this.selection.elm.dispatchEvent(new InputEvent("input"))
			// Move rect
			this.rect.w = this.selection.width * this.selection.scale;
			this.rect.h = this.selection.elm.getBoundingClientRect().height / this.viewport.zoom;
		} else {
			this.selection.editedTime = Date.now()
			// Move rect
			this.rect.w = (this.selection.loadedImage?.width ?? 50) * this.selection.scale;
			this.rect.h = (this.selection.loadedImage?.height ?? 50) * this.selection.scale;
		}
	}
}

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
	 * @param {Point} origin
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
			obj.draw(this.whiteboard.viewport, mainCanvasCtx, this.whiteboard.selection?.objects.includes(obj) ?? false, this.whiteboard.strictLayer && this.whiteboard.selectedLayer != obj.layer)
		}
		// Render selection
		if (this.whiteboard.selection != null) {
			// Render original border
			{
				let borderPos = this.whiteboard.viewport.getScreenPosFromStagePos(this.whiteboard.selection.originalBoundingBox.x, this.whiteboard.selection.originalBoundingBox.y);
				let borderWidth = this.whiteboard.selection.originalBoundingBox.w * this.whiteboard.viewport.zoom;
				let borderHeight = this.whiteboard.selection.originalBoundingBox.h * this.whiteboard.viewport.zoom;
				// Format
				mainCanvasCtx.strokeStyle = "black"
				mainCanvasCtx.lineWidth = 1
				mainCanvasCtx.globalAlpha = 0.5
				// Draw
				mainCanvasCtx.strokeRect(borderPos.x, borderPos.y, borderWidth, borderHeight)
			}
			// Render border
			{
				let borderPos = this.whiteboard.viewport.getScreenPosFromStagePos(this.whiteboard.selection.boundingBox.x, this.whiteboard.selection.boundingBox.y);
				let borderWidth = this.whiteboard.selection.boundingBox.w * this.whiteboard.viewport.zoom;
				let borderHeight = this.whiteboard.selection.boundingBox.h * this.whiteboard.viewport.zoom;
				// Format
				mainCanvasCtx.strokeStyle = "#008"
				mainCanvasCtx.lineWidth = 1.5
				mainCanvasCtx.globalAlpha = 1
				// Draw
				mainCanvasCtx.strokeRect(borderPos.x, borderPos.y, borderWidth, borderHeight)
			}
			// Render handles
			for (var handle of this.whiteboard.selection.handles) {
				var screenPos = this.whiteboard.viewport.getScreenPosFromStagePos(handle.pos.x, handle.pos.y)
				// Format circle
				mainCanvasCtx.fillStyle = handle.isDragging ? "#008" : "white"
				mainCanvasCtx.lineWidth = 3
				// Draw circle
				mainCanvasCtx.beginPath();
				mainCanvasCtx.arc(screenPos.x, screenPos.y, 10, 0, Math.PI * 2);
				mainCanvasCtx.fill();
				mainCanvasCtx.stroke();
			}
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
				this.whiteboard.doAction(new USIEditObjects(this.whiteboard, [{
					objectID: obj.objectID,
					previousData: obj._originalData,
					data: obj.data
				}]))
				this.whiteboard.updateSelection()
				// Reset object
				obj.editedTime = null
				obj._originalData = structuredClone(obj.data)
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
class Connection {
	/**
	 * @param {Whiteboard} whiteboard
	 * @param {boolean} first
	 */
	constructor(whiteboard, first) {
		this.whiteboard = whiteboard;
		// Create websocket
		var ws = new WebSocket("wss://" + location.hostname + "/ws")
		this.webSocket = ws
		ws.addEventListener("open", () => {
			ws.send((first ? "1" : "0") + (location.pathname.split("/").at(-2) ?? "ERROR"))
			document.querySelector("#lost-connection-menu")?.classList.add("hidden")
		})
		ws.addEventListener("close", () => {
			document.querySelector("#lost-connection-menu")?.classList.remove("hidden")
		})
		ws.addEventListener("message", this.onmessage.bind(this))
	}
	/**
	 * @param {MessageEvent<string>} msgEvent
	 */
	onmessage(msgEvent) {
		/** @type {{ type: "error", data: string } | { type: "create_object", objectID: number, layer: number, typeID: string, data: Object } | { type: "remove_object", objectID: number } | { type: "edit_object", objectID: number, newData: Object }} */
		var message = JSON.parse(msgEvent.data)
		if (message.type == "error") {
			console.error("[Server]", message.data)
		} else if (message.type == "create_object") {
			// Search for existing object
			var obj = this.whiteboard.findObjectSafe(message.objectID)
			// Create new object?
			if (obj == undefined) {
				obj = SceneObject.createFromDataAndID(message.objectID, message.layer, message.typeID, message.data)
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
	 * @param {number} objectID
	 * @param {number} layer
	 * @param {string} typeID
	 * @param {Object} data
	 */
	createObject(objectID, layer, typeID, data) {
		this.webSocket.send(JSON.stringify({
			action: "create_object",
			objectID,
			layer,
			typeID,
			data
		}))
	}
	/**
	 * @param {Blob} imageData
	 */
	createImage(imageData) {
		var x = new XMLHttpRequest()
		x.open("POST", "/create_image?whiteboard=" + location.pathname.split("/").at(-2) + "&layer=" + this.whiteboard.selectedLayer + "&x=" + this.whiteboard.viewport.x + "&y=" + this.whiteboard.viewport.y + "&scale=" + this.whiteboard.viewport.zoom)
		x.send(imageData)
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
class Whiteboard {
	constructor() {
		this.viewport = new Viewport()
		/** @type {SceneObject[]} */
		this.objects = []
		this.selectedLayer = 0;
		this.strictLayer = true;
		/** @type {{ objects: SceneObject[], originalBoundingBox: Rect, boundingBox: Rect, handles: Handle[] } | null} */
		this.selection = null
		this.connection = new Connection(this, true)
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
			if (document.activeElement instanceof HTMLTextAreaElement) {
				// Shortcut keys while editing a text box:
				var focusedElement = document.activeElement
				if (e.key == "Escape") {
					// Un-focus textarea
					focusedElement.blur();
				}
			} else {
				// Generic shortcut keys:
				if (e.key == "Escape") {
					// Remove selection
					this.selection = null;
					this.updateSelection();
				}
				if (this.selection != null && (e.key == "Backspace" || e.key == "Delete" || e.key == "a")) {
					// Delete selection
					this.doAction(new USIEraseObjects(this, this.selection.objects.map((v) => ({
						layer: this.selectedLayer, typeID: v.getTypeID(), objectID: v.objectID, data: v.data
					}))));
					this.selection = null;
					this.updateSelection();
					// Erase shortcut (from Select) leads to Draw
					if (e.key == "a") setCurrentMode("Draw")
				} else if (e.key == "a") setCurrentMode("Erase")
				// Mode shortcuts
				if (e.key == "q") setCurrentMode("Move")
				if (e.key == "w") setCurrentMode("Draw")
				if (e.key == "s") setCurrentMode("Select")
				if (e.key == "x") setCurrentMode("Text")
				// Layer shortcuts
				if (e.key == "ArrowLeft") this.updateLayer(-1, true)
				if (e.key == "ArrowRight") this.updateLayer(1, true)
				// Undo/redo
				if (e.ctrlKey) {
					if (e.key == "z") this.undo()
					if (e.key == "Z") this.redo()
					if (e.key == "y") this.redo()
					if (e.key == "Y") this.undo()
				}
			}
		}).bind(this))
		window.addEventListener("keyup", ((/** @type {KeyboardEvent} */ e) => {
			if (e.key == "Shift") this.shiftKeyDown = false
		}).bind(this))
		window.addEventListener("Custom-Switch-Tools", (() => {
			this.selection = null
			this.updateSelection()
		}).bind(this))
		window.addEventListener("paste", ((/** @type {ClipboardEvent} */ e) => {
			if (e.clipboardData != null) {
				for (var clipboardItem of e.clipboardData.items) {
					// Evaluate this pasted item to see if it can be inserted
					if (clipboardItem.kind == "file") {
						if (clipboardItem.type.startsWith("image/")) {
							var file = clipboardItem.getAsFile()
							if (file) this.connection.createImage(file)
						}
					}
				}
			}
		}).bind(this))
		this.updateUndoButtons()
	}
	attemptPaste() {
		navigator.clipboard.read().then((async (/** @type {ClipboardItem[]} */ items) => {
			for (var clipboardItem of items) {
				// Evaluate this pasted item to see if it can be inserted
				for (var mimeType of clipboardItem.types) {
					if (mimeType.startsWith("image/")) {
						var blob = await clipboardItem.getType(mimeType)
						this.connection.createImage(blob)
					}
				}
			}
		}).bind(this))
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
	updateSelection() {
		const _viewport = this.viewport;
		// update handles / bounding box
		if (this.selection != null) {
			// update bounding box
			Object.assign(this.selection.boundingBox, getBoundingBox(this.selection.objects.map((v) => v.getBoundingRect(_viewport))));
			this.selection.originalBoundingBox = { x: this.selection.boundingBox.x, y: this.selection.boundingBox.y, w: this.selection.boundingBox.w, h: this.selection.boundingBox.h };
			// update handles
			var savedHandles = this.selection.handles.filter((v) => v.isDragging);
			this.selection.handles = this.getAllHandles()
			this.selection.handles = this.selection.handles.filter((v) => Math.min(1000, ...savedHandles.map((h) => dist(v.pos, h.pos))) > 15)
			this.selection.handles.push(...savedHandles)
		}
		// update window
		var window = document.querySelector(".selection-window")
		if (window == null) throw new Error(".selection-window is missing")
		if (this.selection == null) {
			window.classList.remove("active")
		} else {
			window.classList.add("active")
		}
		// update number in window
		var number = document.querySelector("#selection-number")
		if (number == null) throw new Error("#selection-number is missing")
		number.textContent = this.selection?.objects.length.toString() ?? "0";
		// update s in number in window
		var s = document.querySelector("#selection-s")
		if (s == null) throw new Error("#selection-s is missing")
		if (this.selection?.objects.length == 1) s.classList.add("hidden");
		else s.classList.remove("hidden");
	}
	getAllHandles() {
		if (this.selection == null) return [];
		if (this.selection.objects.length == 1) return [
			new LinearMovementHandle(this.viewport, this.selection),
			...this.selection.objects[0].getHandles(this.viewport, this.selection.boundingBox)
		]; else return [new LinearMovementHandle(this.viewport, this.selection)]
	}
	/**
	 * @param {any} amount
	 * @param {boolean} addAndUpdate
	 */
	updateLayer(amount, addAndUpdate) {
		var amountFixed = Math.round(Number(amount))
		if (addAndUpdate) amountFixed += this.selectedLayer
		this.selectedLayer = Math.max(Math.min(amountFixed, 9), -1);
		// Update display
		var layerDisplay = document.querySelector("#layer-display")
		if (addAndUpdate && layerDisplay instanceof HTMLInputElement) layerDisplay.valueAsNumber = whiteboard.selectedLayer;
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



/**
 * List of drawing modes.
 * Each one takes in a list of stage points (drawn by the mouse),
 * and returns another list of stage points (to display).
 * @typedef {(points: Point[]) => Point[]} DrawingMode
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
		// Check if we are dragging on a handle.
		if (this.whiteboard.selection != null) {
			/** @type {Handle | null} */
			var closestHandle = null;
			var closestHandleDistance = 30; // handle distance must be at most 30px
			for (var handle of this.whiteboard.selection.handles) {
				if (handle.isDragging) continue;
				var handleScreenPos = this.whiteboard.viewport.getScreenPosFromStagePos(handle.pos.x, handle.pos.y)
				// Check if this handle is close enough
				if (dist(this, handleScreenPos) < closestHandleDistance) {
					closestHandle = handle;
					closestHandleDistance = dist(this, handleScreenPos);
				}
			}
			if (closestHandle != null) return new HandleDraggingTouchMode(this, closestHandle);
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
		/** @type {Point[]} */
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
		if (this.points.length > 4) {
			this.touch.whiteboard.doAction(new USICreateObjects(this.touch.whiteboard, [{
				layer: this.touch.whiteboard.selectedLayer,
				typeID: "drawing",
				objectID: SceneObject.generateObjectID(),
				data: {
					"d": this.drawing_mode(this.points),
					"color": this.color
				}
			}]))
		}
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
			layer: this.touch.whiteboard.selectedLayer,
			typeID: "text",
			objectID: SceneObject.generateObjectID(),
			data: {
				"pos": this.touch.whiteboard.viewport.getStagePosFromScreenPos(previousX, previousY),
				"width": 200,
				"scale": 1.5 / this.touch.whiteboard.viewport.zoom,
				"text": "Enter text here"
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
		/** @type {Point} */
		this.startPos = this.touch.whiteboard.viewport.getStagePosFromScreenPos(touch.x, touch.y)
		/** @type {Point} */
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
		/** @type {Rect} */
		var rect = { x, y, w: width, h: height }
		// === Select items! ===
		var selectedItems = []
		// Keep previously selected items if shift key is pressed
		if (this.touch.whiteboard.shiftKeyDown && this.touch.whiteboard.selection != null) selectedItems.push(...this.touch.whiteboard.selection.objects)
		// Check all objects...
		for (var i = 0; i < this.touch.whiteboard.objects.length; i++) {
			var obj = this.touch.whiteboard.objects[i];
			// ...except already selected ones
			if (selectedItems.includes(obj)) continue;
			// ...except objects on another layer
			if (this.touch.whiteboard.strictLayer && obj.layer != this.touch.whiteboard.selectedLayer) continue;
			// Check if the object collides with the selection rectangle
			if (obj.colliderect(this.touch.whiteboard.viewport, rect)) {
				selectedItems.push(obj)
			}
		}
		// Update whiteboard selection value
		if (selectedItems.length == 0) this.touch.whiteboard.selection = null;
		else this.touch.whiteboard.selection = { objects: selectedItems, originalBoundingBox: { x: 0, y: 0, w: 0, h: 0 }, boundingBox: { x: 0, y: 0, w: 0, h: 0 }, handles: [] }
		this.touch.whiteboard.updateSelection() // `originalBoundingBox`, `boundingBox` and `handles` will be set here
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
		// Erase around this position
		var touchLoc = this.touch.whiteboard.viewport.getStagePosFromScreenPos(touch.x, touch.y);
		this.eraseLine({
			start: { x: touchLoc.x - 1, y: touchLoc.y - 1 },
			  end: { x: touchLoc.x + 1, y: touchLoc.y + 1 }
		})
		this.eraseLine({
			start: { x: touchLoc.x + 1, y: touchLoc.y + 1 },
			  end: { x: touchLoc.x - 1, y: touchLoc.y - 1 }
		})
	}
	/** @param {Line} line */
	eraseLine(line) {
		var o = [...this.touch.whiteboard.objects]
		for (var i = 0; i < o.length; i++) {
			// Don't erase if the object is unverified
			if (! o[i].verified) continue;
			// Don't erase if we are on another layer
			if (this.touch.whiteboard.strictLayer && o[i].layer != this.touch.whiteboard.selectedLayer) continue;
			// Check for collision
			if (! o[i].collideline(this.touch.whiteboard.viewport, line)) continue;
			// Erase the object
			this.touch.whiteboard.doAction(new USIEraseObjects(this.touch.whiteboard, [{
				layer: this.touch.whiteboard.selectedLayer, typeID: o[i].getTypeID(), objectID: o[i].objectID, data: o[i].data
			}]))
		}
	}
	/**
	 * @param {number} previousX
	 * @param {number} previousY
	 * @param {number} newX
	 * @param {number} newY
	 */
	onMove(previousX, previousY, newX, newY) {
		this.eraseLine({
			start: this.touch.whiteboard.viewport.getStagePosFromScreenPos(previousX, previousY),
			end: this.touch.whiteboard.viewport.getStagePosFromScreenPos(newX, newY)
		})
	}
	toString() {
		return `EraseTouchMode {}`
	}
}
class HandleDraggingTouchMode extends TouchMode {
	/**
	 * @param {TrackedTouch} touch
	 * @param {Handle} handle
	 */
	constructor(touch, handle) {
		super(touch)
		this.handle = handle
		this.handle.isDragging = true;
	}
	/**
	 * @param {number} previousX
	 * @param {number} previousY
	 * @param {number} newX
	 * @param {number} newY
	 */
	onMove(previousX, previousY, newX, newY) {
		var mouseStagePos = this.touch.whiteboard.viewport.getStagePosFromScreenPos(newX, newY)
		this.handle.moveTo(mouseStagePos.x, mouseStagePos.y)
	}
	/**
	 * @param {number} previousX
	 * @param {number} previousY
	 */
	onEnd(previousX, previousY) {
		this.handle.finishMovement()
		this.touch.whiteboard.updateSelection()
	}
	/**
	 * @param {number} previousX
	 * @param {number} previousY
	 */
	onCancel(previousX, previousY) {
		// this.handle.cancel()
		this.handle.isDragging = false;
	}
	toString() {
		return `HandleTouchMode { ${this.handle} }`
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
			if (e.buttons > 1) {
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
		mainContainer.addEventListener("contextmenu", (e) => {
			e.preventDefault()
			e.stopPropagation()
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
		}, true);
		mainContainer.addEventListener("touchmove", (e) => {
			if (e.target instanceof HTMLTextAreaElement && getCurrentMode() == "Text") return
			e.preventDefault();
			_this.handleTouches(e.touches)
			return false
		}, true);
		mainContainer.addEventListener("touchcancel", (e) => {
			if (e.target instanceof HTMLTextAreaElement && getCurrentMode() == "Text") return
			e.preventDefault();
			_this.handleTouches(e.touches)
			return false
		}, true);
		mainContainer.addEventListener("touchend", (e) => {
			if (e.target instanceof HTMLTextAreaElement && getCurrentMode() == "Text") return
			e.preventDefault();
			_this.handleTouches(e.touches)
			return false
		}, true);
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
	 * @param {{ layer: number, typeID: string, objectID: number, data: Object }[]} objects
	 */
	constructor(whiteboard, objects) { super(whiteboard); this.objects = objects; }
	do() {
		for (var o of this.objects) {
			this.whiteboard.add(SceneObject.createFromDataAndID(o.objectID, this.whiteboard.selectedLayer, o.typeID, o.data));
			this.whiteboard.connection.createObject(o.objectID, o.layer, o.typeID, o.data);
		}
	}
	invert() { return new USIEraseObjects(this.whiteboard, [...this.objects]) }
}
class USIEraseObjects extends UndoStackItem {
	/**
	 * @param {Whiteboard} whiteboard
	 * @param {{ layer: number, typeID: string, objectID: number, data: Object }[]} objects
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
class USIEditObjects extends UndoStackItem {
	/**
	 * @param {Whiteboard} whiteboard
	 * @param {{ objectID: number, previousData: Object, data: Object }[]} objects
	 */
	constructor(whiteboard, objects) { super(whiteboard); this.objects = objects; }
	do() {
		for (var o of this.objects) {
			var realObj = this.whiteboard.findObject(o.objectID);
			realObj.data = o.data;
			realObj.reload();
			this.whiteboard.connection.editObject(o.objectID, o.data);
			this.whiteboard.updateSelection();
		}
	}
	invert() { return new USIEditObjects(this.whiteboard, this.objects.map((v) => ({
		objectID: v.objectID,
		previousData: v.data,
		data: v.previousData
	}))) }
}



var whiteboard = new Whiteboard()
whiteboard.renderer.renderLoop()
