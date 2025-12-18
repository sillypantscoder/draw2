from server_lib import SafeDict, HTTPServer, HTTPResponse, read_file
import typing
import json
import datetime
import os

hostName = "0.0.0.0"
serverPort = 8060

def dt(time: datetime.datetime | None = None) -> str:
	timezone = datetime.timezone(datetime.timedelta(hours=-6))
	t = datetime.datetime.now(timezone)
	if time != None: t = time
	return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][t.weekday()] + \
		", " + ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][t.month] + \
		" " + str(t.day) + ("th" if t.day//10 == 1 else ("st" if t.day%10 == 1 else ("nd" if t.day%10 == 2 else ("rd" if t.day%10 == 3 else "th")))) + \
		" at " + str(((t.hour - 1) % 12) + 1) + ":" + str(t.minute).rjust(2, '0') + ":" + str(t.second).rjust(2, '0') + " " + ("AM" if t.hour < 12 else "PM")

class SceneObject(typing.TypedDict):
	id: int
	data: dict[str, typing.Any]

class Whiteboard:
	def __init__(self, id: str):
		self.name: str = "New Whiteboard"
		self.created: datetime.datetime = datetime.datetime.now()
		self.objects: list[SceneObject] = []
		self.id = id
		self.temp_messages: list[typing.Any] = []
	@staticmethod
	def nextID():
		id = 0
		while os.path.exists(f"objects/{id}.json"):
			id += 1
		return str(id)
	def saveObjectList(self):
		f = open(f"whiteboards/{self.id}.json", "w")
		f.write(json.dumps({
			"name": self.name,
			"created": self.created.isoformat(),
			"objects": self.objects
		}))
		f.close()
	def loadObjectList(self):
		if not os.path.isfile(f"whiteboards/{self.id}.json"): return
		f = open(f"whiteboards/{self.id}.json", "r")
		data = json.loads(f.read())
		f.close()
		self.name = data["name"]
		self.created = datetime.datetime.fromisoformat(data["created"])
		self.objects = data["objects"]
		print("[Draw] Loaded", len(self.objects), "objects for whiteboard with id", self.id, "(name: " + repr(self.name) + ")")

class Draw2Server(HTTPServer):
	def __init__(self, hostName: str, serverPort: int):
		super().__init__(hostName, serverPort)
		self.whiteboards: list[Whiteboard] = []
		# Load whiteboards
		files = os.listdir("whiteboards")
		for f in files:
			w = Whiteboard(f.split(".")[0])
			w.loadObjectList()
			self.whiteboards.append(w)
	def get(self, path: str, query: SafeDict, headers: SafeDict, cookies: SafeDict) -> HTTPResponse:
		if path == "/":
			return {
				"status": 200,
				"headers": {
					"Content-Type": "text/html"
				},
				"content": read_file("client/index.html")
			}
		elif path == "/whiteboard_data/ls":
			return {
				"status": 200,
				"headers": {
					"Content-Type": "text/plain"
				},
				"content": json.dumps([
					{ "name": w.name, "created": w.created.isoformat(), "id": w.id }
					for w in self.whiteboards
				]).encode("UTF-8")
			}
		elif path == "/utils.js":
			return {
				"status": 200,
				"headers": {
					"Content-Type": "text/javascript"
				},
				"content": read_file("client/utils.js")
			}
		elif path.startswith("/whiteboard/"):
			board_name = path.split("/")[2]
			if board_name not in [w.id for w in self.whiteboards]:
				return {
					"status": 404,
					"headers": {
						"Content-Type": "text/html"
					},
					"content": b""
				}
			return {
				"status": 200,
				"headers": {
					"Content-Type": "text/html"
				},
				"content": read_file("client/whiteboard.html")
			}
		elif path.startswith("/whiteboard_data/messages/"):
			board_name = path.split("/")[3]
			if board_name not in [w.id for w in self.whiteboards]:
				return {
					"status": 404,
					"headers": {
						"Content-Type": "text/html"
					},
					"content": b""
				}
			board = [w for w in self.whiteboards if w.id == board_name][0]
			r = json.dumps(board.temp_messages[:500])
			board.temp_messages = board.temp_messages[500:]
			return {
				"status": 200,
				"headers": {
					"Content-Type": "text/json"
				},
				"content": r.encode("UTF-8")
			}
		elif path == "/whiteboard.js":
			return {
				"status": 200,
				"headers": {
					"Content-Type": "text/javascript"
				},
				"content": read_file("client/whiteboard.js")
			}
		# 404 page
		return {
			"status": 404,
			"headers": {},
			"content": b""
		}
	def post(self, path: str, query: SafeDict, body: bytes) -> HTTPResponse:
		if path == "/new":
			name = body.decode("UTF-8")
			w = Whiteboard(Whiteboard.nextID())
			self.whiteboards.append(w)
			w.name = name
			print(f"[Draw] [{dt()}] New whiteboard with id:", w.id, "name:", repr(w.name), "clients")
			return {
				"status": 200,
				"headers": {},
				"content": w.id.encode("UTF-8")
			}
		elif path == "/rename":
			data = body.decode("UTF-8").split("\n")
			id = data[0]
			newname = data[1]
			for w in self.whiteboards:
				if w.id == id:
					print(f"[Draw] [{dt()}] Renamed whiteboard with id", w.id, " (old name: " + repr(w.name) + ") to:", repr(newname))
					w.name = newname
					w.saveObjectList()
			return {
				"status": 200,
				"headers": {},
				"content": b""
			}
		elif path.startswith("/whiteboard/"):
			board_name = path.split("/")[2]
			if board_name not in [w.id for w in self.whiteboards]:
				return {
					"status": 404,
					"headers": {
						"Content-Type": "text/html"
					},
					"content": b"Not Found"
				}
			board = [w for w in self.whiteboards if w.id == board_name][0]
			op = path.split("/")[3]
			if op == "connect": # Register new client
				clientID = int(body)
				print(f"[Draw] [{dt()}] Login to whiteboard {board.id} with client id {clientID}; {'???'} client(s) connected")
				# board.clients.append({
				# 	"id": clientID,
				# 	"lastTime": datetime.datetime.now(),
				# 	"messages": [
				# 		{
				# 			"type": "create_object",
				# 			"id": o["id"],
				# 			"data": o["data"]
				# 		} for o in board.objects
				# 	]
				# })
				board.temp_messages.extend([
					{
						"type": "create_object",
						"id": o["id"],
						"data": o["data"]
					} for o in board.objects
				])
				return {
					"status": 200,
					"headers": {},
					"content": b""
				}
			# if op == "create_object":
			# 	bodydata = json.loads(body)
			# 	create = True
			# 	for o in board.objects:
			# 		if o["id"] == bodydata["id"]:
			# 			o["data"] = bodydata["data"]
			# 			create = False
			# 	if create:
			# 		board.objects.append({
			# 			"id": bodydata["id"],
			# 			"data": bodydata["data"]
			# 		})
			# 	for c in range(len(board.clients)):
			# 		board.clients[c]["messages"].append({
			# 			"type": "create_object",
			# 			"id": bodydata["id"],
			# 			"data": bodydata["data"]
			# 		})
			# 	board.saveObjectList()
			# 	return {
			# 		"status": 200,
			# 		"headers": {},
			# 		"content": b""
			# 	}
			# if op == "erase":
			# 	id = int(body)
			# 	for i in [*board.objects]:
			# 		if i["id"] == id:
			# 			board.objects.remove(i)
			# 			for c in range(len(board.clients)):
			# 				board.clients[c]["messages"].append({
			# 					"type": "erase",
			# 					"id": id
			# 				})
			# 	board.saveObjectList()
			# 	return {
			# 		"status": 200,
			# 		"headers": {},
			# 		"content": b""
			# 	}
			if op == "get":
				id = int(body)
				for i in [*board.objects]:
					if i["id"] == id:
						for c in range(len(board.clients)):
							board.clients[c]["messages"].append({
								"type": "create_object",
								"id": id,
								"data": i["data"]
							})
				board.saveObjectList()
				return {
					"status": 200,
					"headers": {},
					"content": b""
				}
		return {
			"status": 404,
			"headers": {},
			"content": b""
		}

if __name__ == "__main__":
	server = Draw2Server("0.0.0.0", 8061)
	server.run()
