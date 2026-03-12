/**
 * App — Main bootstrap and coordinator for Timberborn Dashboard.
 *
 * Loads component data from the two-layer Store (localStorage),
 * places them on the grid via an async placement queue,
 * and connects WebSocket for live device state updates.
 */

// --- Module imports ---
import "../css/styles.scss"
import type { ComponentData } from "../types"
import { initContextMenu } from "./context-menu"
import {
	COMP_MIN_HEIGHT,
	COMP_MIN_WIDTH,
	Grid,
	type GridComponentConfig,
} from "./grid"
import { Store } from "./store"

// Side-effect imports: register web components and surface component types
import "../components"
import "./surface-registry"

type DeviceRecord = Record<
	string,
	{ type: string; on: boolean; [key: string]: unknown }
>

interface PixelScreen {
	pixels: Set<string>
	width: number
	height: number
}

let ws: WebSocket | null = null
let grid: Grid
let deviceState: DeviceRecord = {}

/**
 * Pixel screen map — screenId (string|"") -> { pixels: Set<"x-y">, width, height }
 * Built from lever names matching pixel:[ID:]X-Y pattern.
 * Empty string key "" represents the default (null) screen.
 */
const pixelScreens: Map<string, PixelScreen> = new Map()
const PIXEL_RE: RegExp = /^pixel:(?:([^:]*):)?(\d+)-(\d+)$/

/** In-memory component data keyed by id, loaded from Store. */
const componentData: Map<string, ComponentData> = new Map()

const gridContainer = document.getElementById("grid-container")!
const gridViewport = document.getElementById("grid-viewport")!
const connLed = document.getElementById("conn-led")!
const connText = document.getElementById("conn-text")!
const editBtn = document.getElementById("edit-btn")!
const editIcon = document.getElementById("edit-icon")!

let editing: boolean = false

// --- Grid Init (no built-in layout persistence — Store handles it) ---

grid = new Grid(gridContainer, gridViewport, {
	storageKey: null,
	onLayoutChange: (
		id: string,
		pos: { x: number; y: number; w: number; h: number },
	) => Store.saveLayout(id, pos),
})

// --- Edit Toggle ---

editBtn.addEventListener("click", () => {
	editing = !editing
	grid.setEditing(editing)

	if (editing) {
		editBtn.classList.add("active")
		editIcon.innerHTML = "&#128295;" // wrench
	} else {
		editBtn.classList.remove("active")
		editIcon.innerHTML = "&#128208;" // square
	}
})

// Click on grid background exits edit mode
gridViewport.addEventListener("click", (e: MouseEvent) => {
	if (!editing) return
	if (e.target !== gridViewport) return
	editing = false
	grid.setEditing(false)
	editBtn.classList.remove("active")
	editIcon.innerHTML = "&#128208;" // square
})

// Hide edit FAB when an editor is open (surface/circuitry mode)
window.addEventListener("editor-mode-change", ((e: CustomEvent) => {
	if (e.detail.mode === "dashboard") {
		editBtn.classList.remove("hidden")
	} else {
		editBtn.classList.add("hidden")
	}
}) as EventListener)

// --- Placement Queue ---
// Components are loaded asynchronously one at a time so each can validate
// its position against components already on the board.

const _placementQueue: ComponentData[] = []
let _placementRunning: boolean = false

function enqueueComponent(comp: ComponentData): void {
	_placementQueue.push(comp)
	_drainQueue()
}

async function _drainQueue(): Promise<void> {
	if (_placementRunning) return
	_placementRunning = true
	while (_placementQueue.length > 0) {
		const comp = _placementQueue.shift()!
		_placeComponent(comp)
		// Yield to the browser so rendering can interleave
		await new Promise<void>((r) => setTimeout(r, 0))
	}
	_placementRunning = false
}

/**
 * Validate and place a single component on the grid.
 * Nudges position if it overlaps an already-placed component.
 */
function _placeComponent(comp: ComponentData): void {
	let x: number = comp.x ?? 0
	let y: number = comp.y ?? 0
	const w: number = comp.w ?? (comp as any).minWidth ?? COMP_MIN_WIDTH
	const h: number = comp.h ?? (comp as any).minHeight ?? COMP_MIN_HEIGHT

	// Simple overlap resolution: shift down until clear
	for (const [, existing] of grid.components) {
		if (
			_rectsOverlap(x, y, w, h, existing.x, existing.y, existing.w, existing.h)
		) {
			y = existing.y + existing.h
		}
	}

	// Write adjusted position back if it changed
	if (x !== (comp.x ?? 0) || y !== (comp.y ?? 0)) {
		comp.x = x
		comp.y = y
		Store.saveLayout(comp.id, { x, y, w, h })
	}

	componentData.set(comp.id, comp)
	createComponentElement(comp, x, y, w, h)
}

function _rectsOverlap(
	x1: number,
	y1: number,
	w1: number,
	h1: number,
	x2: number,
	y2: number,
	w2: number,
	h2: number,
): boolean {
	return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2
}

// --- Config Loading (from Store) ---

function loadConfig(): void {
	Store.migrateIfNeeded()
	;(document.querySelector(".header-title") as HTMLElement).textContent =
		Store.getTitle()

	// Load component IDs from root key, then enqueue each for async placement
	const ids: string[] = Store.getComponentIds()
	for (const id of ids) {
		const comp = Store.readComponent(id)
		if (comp) {
			enqueueComponent(comp)
		}
	}
}

// --- Build / Rebuild Components ---
// Called when the in-memory component set changes (add/delete).

function buildComponents(): void {
	const currentIds = new Set(Store.getComponentIds())

	// Remove components no longer in store
	for (const [id] of grid.components) {
		if (!currentIds.has(id)) {
			grid.removeComponent(id)
			componentData.delete(id)
		}
	}

	// Add new components not yet on grid
	for (const id of currentIds) {
		if (!grid.getComponent(id)) {
			const comp = Store.readComponent(id)
			if (comp) enqueueComponent(comp)
		} else {
			// Update existing
			const comp = Store.readComponent(id)
			if (comp) {
				componentData.set(comp.id, comp)
				updateComponentElement(comp)
			}
		}
	}
}

function createComponentElement(
	comp: ComponentData,
	x: number,
	y: number,
	w: number,
	h: number,
): void {
	const el = document.createElement("tb-component") as any
	el.setAttribute("component-id", comp.id)
	el.setAttribute("name", comp.name || comp.id)
	el.setAttribute("color", comp.color || "#d4cdb8")

	// Set circuitry data BEFORE building surface elements, so that
	// auto-registered surface nodes can check for existing entries
	el.circuitryData = comp.circuitry || { nodes: [], edges: [] }

	// Build surface elements from config
	buildSurfaceElements(el, comp.surface || [])

	// Listen for config changes from the component (color, circuitry)
	el.addEventListener("component-config-change", (e: Event) => {
		handleComponentConfigChange((e as CustomEvent).detail)
	})

	const gridOpts: GridComponentConfig = {
		x,
		y,
		width: w,
		minWidth: (comp as any).minWidth || COMP_MIN_WIDTH,
		minHeight: (comp as any).minHeight || COMP_MIN_HEIGHT,
		height: h,
	}

	// Surface component constraints
	if ((comp as any).resizable === false) gridOpts.resizable = false
	if ((comp as any).aspectRatio)
		gridOpts.aspectRatio = (comp as any).aspectRatio

	grid.addComponent(comp.id, el, gridOpts)
}

function updateComponentElement(comp: ComponentData): void {
	const gridComp = grid.getComponent(comp.id)
	if (!gridComp) return
	const el: HTMLElement =
		(gridComp.el.querySelector("tb-component") as HTMLElement) || gridComp.el

	if (el.tagName === "TB-COMPONENT") {
		el.setAttribute("name", comp.name || comp.id)
		el.setAttribute("color", comp.color || "#d4cdb8")
	}
}

// --- Surface Element Builder ---

function buildSurfaceElements(parentEl: any, elements: any[]): void {
	for (let i = 0; i < elements.length; i++) {
		const elem = elements[i]
		const child = createSurfaceElement(elem, i)
		if (child) {
			// Set surface-id from config if available, otherwise auto-generated
			if (elem.surfaceId) {
				child.setAttribute("surface-id", elem.surfaceId)
			}

			// Use the component's inner surface grid
			parentEl.addSurfaceElement(child, {
				x: elem.x || 0,
				y: elem.y || 0,
				width: elem.width || 2,
				height: elem.height || 2,
				resizable: elem.resizable !== false,
			})
		}
	}
}

// Props that need special handling and should not be applied as plain attributes.
// "binding" is stored in dataset; "style" mapped to "style-type" for legacy configs;
// camelCase legacy names mapped to their kebab-case attribute equivalents.
const PROP_ALIAS: Record<string, string> = {
	labelPos: "label-pos",
	fontSize: "font-size",
	switchStyle: "switch-style",
	styleType: "style-type",
	overwriteText: "overwrite-text",
	style: "style-type", // legacy: avoid collision with HTML style attribute
}
const PROP_SKIP: Set<string> = new Set(["binding"])

/** Apply all saved props as attributes on a surface element. */
function applySurfaceProps(el: HTMLElement, props: Record<string, any>): void {
	for (const [key, value] of Object.entries(props)) {
		if (PROP_SKIP.has(key)) continue
		const attr: string = PROP_ALIAS[key] || key
		if (value === "" || value === true) {
			el.setAttribute(attr, "")
		} else if (value != null && value !== false) {
			el.setAttribute(attr, value)
		}
	}
	if (props.binding) (el as HTMLElement).dataset.binding = props.binding
}

function createSurfaceElement(elem: any, index: number): HTMLElement | null {
	const props: Record<string, any> = elem.props || {}
	let el: any

	switch (elem.type) {
		case "led":
			el = document.createElement("tb-led")
			break
		case "label":
			el = document.createElement("tb-label")
			break
		case "dial":
			el = document.createElement("tb-dial")
			break
		case "toggle":
			el = document.createElement("tb-toggle")
			el.addEventListener("toggle-change", (e: Event) => {
				const detail = (e as CustomEvent).detail
				// Legacy direct binding
				handleToggle(detail.name, detail.on)
				// Circuitry-based: walk edges from this toggle's surface node
				if (el.surfaceId && el.parentComponent) {
					handleToggleViaCircuitry(el.parentComponent, el.surfaceId, detail.on)
				}
			})
			break
		case "alert":
			el = document.createElement("tb-alert")
			break
		case "color-picker":
			el = document.createElement("tb-color-picker")
			el.addEventListener("color-pick", (e: Event) => {
				const detail = (e as CustomEvent).detail
				if (el.surfaceId && el.parentComponent) {
					const compId: string = el.parentComponent.getAttribute("component-id")
					persistSurfaceColor(compId, el.surfaceId, detail.color)
					handleColorPickViaCircuitry(
						el.parentComponent,
						el.surfaceId,
						detail.color,
					)
				}
			})
			break
		case "rainbow":
			el = document.createElement("tb-rainbow")
			delete props.on
			el.addEventListener("color-pick", (e: Event) => {
				const detail = (e as CustomEvent).detail
				if (el.surfaceId && el.parentComponent) {
					handleColorPickViaCircuitry(
						el.parentComponent,
						el.surfaceId,
						detail.color,
					)
				}
			})
			break
		case "camera":
			el = document.createElement("tb-camera")
			el.addEventListener("color-batch", (e: Event) => {
				const detail = (e as CustomEvent).detail
				if (el.surfaceId && el.parentComponent) {
					handleCameraBatchViaCircuitry(
						el.parentComponent,
						el.surfaceId,
						detail.pixels,
					)
				}
			})
			break
		default:
			console.warn(`Unknown surface element type: ${elem.type}`)
			return null
	}

	applySurfaceProps(el, props)
	return el as HTMLElement
}

// --- Device State Binding ---

/**
 * Scan devices for pixel:X-Y levers and build screen maps.
 * Each screen ID gets a Set of "x-y" coordinate strings, plus width/height.
 */
function mapPixels(devices: DeviceRecord): void {
	// Rebuild from scratch — device list from polling is the source of truth
	pixelScreens.clear()

	for (const name of Object.keys(devices)) {
		const m = PIXEL_RE.exec(name)
		if (!m) continue

		// Group 1: screen ID (undefined -> default, empty string -> default)
		const screenId: string = m[1] || ""
		const x: number = parseInt(m[2]!)
		const y: number = parseInt(m[3]!)

		let screen = pixelScreens.get(screenId)
		if (!screen) {
			screen = { pixels: new Set(), width: 0, height: 0 }
			pixelScreens.set(screenId, screen)
		}
		screen.pixels.add(`${x}-${y}`)
		if (x + 1 > screen.width) screen.width = x + 1
		if (y + 1 > screen.height) screen.height = y + 1
	}
}

/**
 * Walk circuitry to find screen nodes and propagate their resolution
 * to connected camera surface elements.
 */
function propagateScreenResolutions(tbComp: any, circuitry: any): void {
	const { nodes, edges } = circuitry
	if (!nodes.length) return

	for (const node of nodes) {
		if (node.type !== "screen") continue

		const screenId: string = node.config?.screenId || ""
		const screen = pixelScreens.get(screenId)
		const w: number = screen?.width || 0
		const h: number = screen?.height || 0
		const count: number = screen?.pixels.size || 0

		// Store on node config for display in node editor
		if (!node.config) node.config = {}
		node.config._screenWidth = w
		node.config._screenHeight = h
		node.config._pixelCount = count
		node.config._pixels = screen?.pixels || null

		// Find camera connected to this screen's input port
		for (const edge of edges) {
			if (edge.to !== node.id) continue
			const sourceNode = nodes.find((n: any) => n.id === edge.from)
			if (!sourceNode?.config?.surfaceManaged) continue
			if (sourceNode.type !== "surface-camera") continue

			const surfaceEl: any = findSurfaceElement(
				tbComp,
				sourceNode.config.surfaceId,
			)
			if (surfaceEl && typeof surfaceEl.setResolution === "function") {
				surfaceEl.setResolution(w, h, screen?.pixels || new Set())
			}
		}
	}
}

function applyDeviceState(devices: DeviceRecord): void {
	deviceState = devices
	mapPixels(devices)

	for (const [id, comp] of componentData) {
		const gridComp = grid.getComponent(id)
		if (!gridComp) continue

		const tbComp: any =
			(gridComp.el.querySelector("tb-component") as any) || gridComp.el
		if (!tbComp || tbComp.tagName !== "TB-COMPONENT") continue

		// --- Circuitry-based propagation ---
		// Walk edges: device nodes -> surface nodes
		const circuitry = tbComp.circuitryData
		if (circuitry && circuitry.nodes && circuitry.edges) {
			propagateDeviceStateViaCircuitry(tbComp, circuitry, devices)
			propagateScreenResolutions(tbComp, circuitry)
		}

		// --- Legacy data-binding fallback ---
		let boundElements: Element[] = []
		if (tbComp.shadowRoot) {
			boundElements = [...tbComp.shadowRoot.querySelectorAll("[data-binding]")]
		}
		const lightBound = tbComp.querySelectorAll("[data-binding]")
		boundElements = [...boundElements, ...lightBound]

		for (const boundEl of boundElements) {
			const binding = (boundEl as HTMLElement).dataset.binding
			if (!binding) continue

			const parts: string[] = binding.split(".")
			const deviceName: string = parts[0]!
			const prop: string = parts[1] || "on"

			const device = devices[deviceName]
			if (!device) continue

			const value = (device as any)[prop]
			if (value !== undefined && typeof value === "boolean") {
				;(boundEl as any).on = value
			}
		}
	}
}

/**
 * Walk circuitry edges to propagate device state to surface components.
 * Device nodes (lever/adapter) with a matching device name get their state,
 * then edges carry that state to connected surface node inputs.
 */
function propagateDeviceStateViaCircuitry(
	tbComp: any,
	circuitry: any,
	devices: DeviceRecord,
): void {
	const { nodes, edges } = circuitry
	if (!nodes.length) return

	// Build a map of node outputs: nodeId -> { portName: value }
	const nodeOutputs: Record<string, Record<string, boolean>> = {}

	for (const node of nodes) {
		if (node.type === "lever" || node.type === "adapter") {
			const deviceName: string | undefined = node.config?.device
			if (deviceName && devices[deviceName]) {
				const device = devices[deviceName]
				nodeOutputs[node.id] = { "out-0": !!device.on }
			}
		}
		// Surface nodes that are outputs (e.g. toggle) get their state from the element
		if (node.config?.surfaceManaged && node.config?.ports?.outputs?.length) {
			const surfaceEl: any = findSurfaceElement(tbComp, node.config.surfaceId)
			if (surfaceEl && typeof surfaceEl.on !== "undefined") {
				nodeOutputs[node.id] = { "out-0": !!surfaceEl.on }
			}
		}
	}

	// Apply label text for surface-label nodes (works with or without edges).
	// Device-supplied text goes to the deviceText property (ephemeral).
	// The label component decides what to display based on overwrite state.
	const connectedLabels: Set<string> = new Set()

	// First, sync overwriteText / text config from circuitry nodes to surface elements
	for (const node of nodes) {
		if (node.type !== "surface-label" || !node.config?.surfaceManaged) continue
		const surfaceEl = findSurfaceElement(tbComp, node.config.surfaceId)
		if (!surfaceEl) continue

		// Sync the override toggle
		if (node.config.overwriteText) {
			surfaceEl.setAttribute("overwrite-text", "")
		} else {
			surfaceEl.removeAttribute("overwrite-text")
		}
		// Sync custom text
		if (node.config.text) {
			surfaceEl.setAttribute("text", node.config.text)
		} else {
			surfaceEl.removeAttribute("text")
		}
	}

	for (const edge of edges) {
		const targetNode = nodes.find((n: any) => n.id === edge.to)
		if (
			targetNode?.type === "surface-label" &&
			targetNode.config?.surfaceManaged
		) {
			connectedLabels.add(targetNode.id)
			const surfaceEl: any = findSurfaceElement(
				tbComp,
				targetNode.config.surfaceId,
			)
			if (!surfaceEl) continue

			// Derive device text from the source node
			const sourceNode = nodes.find((n: any) => n.id === edge.from)
			const deviceName: string =
				sourceNode?.config?.device ||
				sourceNode?.config?.label ||
				sourceNode?.config?.surfaceId ||
				""
			surfaceEl.deviceText = deviceName
		}
	}

	// Standalone label nodes (no edge connection) — no device text to supply
	// Their display is controlled entirely by their own text attribute + overwrite flag

	// Walk edges to propagate boolean state to non-label surface node inputs
	for (const edge of edges) {
		const outputVal = nodeOutputs[edge.from]?.[edge.fromPort]
		if (outputVal === undefined) continue

		const targetNode = nodes.find((n: any) => n.id === edge.to)
		if (!targetNode?.config?.surfaceManaged) continue
		if (targetNode.type === "surface-label") continue // already handled above

		const surfaceEl: any = findSurfaceElement(
			tbComp,
			targetNode.config.surfaceId,
		)
		if (surfaceEl) surfaceEl.on = outputVal
	}

	// Reverse-sync: update toggle visuals from connected device state
	for (const edge of edges) {
		const sourceNode = nodes.find((n: any) => n.id === edge.from)
		if (
			!sourceNode?.config?.surfaceManaged ||
			sourceNode.type !== "surface-toggle"
		)
			continue

		const targetNode = nodes.find((n: any) => n.id === edge.to)
		if (
			!targetNode ||
			(targetNode.type !== "lever" && targetNode.type !== "adapter")
		)
			continue

		const devState = nodeOutputs[targetNode.id]?.["out-0"]
		if (devState === undefined) continue

		const surfaceEl: any = findSurfaceElement(
			tbComp,
			sourceNode.config.surfaceId,
		)
		if (surfaceEl && surfaceEl.on !== devState) {
			surfaceEl.on = devState
		}
	}
}

/**
 * Find a surface element by its surface-id within a tb-component.
 * Elements always live in the shadow DOM (never reparented).
 */
function findSurfaceElement(tbComp: any, surfaceId: string): Element | null {
	if (!surfaceId) return null
	if (tbComp.shadowRoot) {
		return tbComp.shadowRoot.querySelector(`[surface-id="${surfaceId}"]`)
	}
	return null
}

// --- Toggle Handler ---

async function handleToggle(name: string, on: boolean): Promise<void> {
	if (!name) return
	const endpoint: string = on
		? `/api/switch-on/${encodeURIComponent(name)}`
		: `/api/switch-off/${encodeURIComponent(name)}`
	try {
		await fetch(endpoint, { method: "POST" })
	} catch (err) {
		console.error("Toggle failed:", err)
	}
}

/**
 * Handle toggle changes via circuitry: walk edges from the toggle's surface node
 * to find connected device (lever) nodes and send API calls.
 */
function handleToggleViaCircuitry(
	tbComp: any,
	surfaceId: string,
	on: boolean,
): void {
	const circuitry = tbComp.circuitryData
	if (!circuitry?.nodes?.length || !circuitry?.edges?.length) return

	const nodeId: string = "surface-" + surfaceId

	// Find edges from this surface node's output
	for (const edge of circuitry.edges) {
		if (edge.from !== nodeId) continue

		// Find the target node
		const targetNode = circuitry.nodes.find((n: any) => n.id === edge.to)
		if (targetNode?.type === "lever" && targetNode.config?.device) {
			handleToggle(targetNode.config.device, on)
		}
	}
}

/**
 * Persist a color picker's chosen color into the component's surface config
 * in the Store, so it survives page reloads.
 */
function persistSurfaceColor(
	compId: string,
	surfaceId: string,
	color: string,
): void {
	const comp: ComponentData | null =
		componentData.get(compId) || Store.readComponent(compId)
	if (!comp?.surface) return
	for (const s of comp.surface) {
		if ((s as any).surfaceId === surfaceId) {
			if (!(s as any).props) (s as any).props = {}
			;(s as any).props.color = color
			break
		}
	}
	Store.saveComponent(comp)
	componentData.set(compId, comp)
}

/**
 * Handle color picks via circuitry: walk edges from the color picker's surface
 * node to find connected lever nodes and send color API calls.
 */
async function handleColorPickViaCircuitry(
	tbComp: any,
	surfaceId: string,
	color: string,
): Promise<void> {
	const circuitry = tbComp.circuitryData
	if (!circuitry?.nodes?.length || !circuitry?.edges?.length) return

	const nodeId: string = "surface-" + surfaceId
	const hex: string = color.replace("#", "")

	for (const edge of circuitry.edges) {
		if (edge.from !== nodeId) continue

		const targetNode = circuitry.nodes.find((n: any) => n.id === edge.to)
		if (targetNode?.type === "lever" && targetNode.config?.device) {
			const name: string = targetNode.config.device
			const url: string = `/api/color/${encodeURIComponent(name)}/${hex}`
			try {
				await fetch(url, { method: "POST" })
			} catch (err) {
				console.error("Color pick failed:", err)
			}
		}

		// Sync sibling color surfaces (e.g. color picker) connected to the same target
		if (targetNode) {
			syncSiblingColorSurfaces(tbComp, circuitry, targetNode.id, nodeId, color)
		}
	}
}

/**
 * Find other color-output surface nodes connected to the same target node
 * and update their displayed color. Keeps color pickers in sync with
 * rainbow buttons (and vice versa) when wired to the same lever.
 */
function syncSiblingColorSurfaces(
	tbComp: any,
	circuitry: any,
	targetNodeId: string,
	sourceNodeId: string,
	color: string,
): void {
	const compId: string = tbComp.getAttribute("component-id")
	for (const edge of circuitry.edges) {
		if (edge.to !== targetNodeId || edge.from === sourceNodeId) continue

		const siblingNode = circuitry.nodes.find((n: any) => n.id === edge.from)
		if (!siblingNode?.config?.surfaceManaged) continue

		const sid: string = siblingNode.config.surfaceId
		const el = findSurfaceElement(tbComp, sid)
		if (el && el.getAttribute("color") !== color) {
			el.setAttribute("color", color)
			persistSurfaceColor(compId, sid, color)
		}
	}
}

/**
 * Handle camera batch via circuitry: walk edges from camera's output to find
 * a connected screen node, then fire-and-forget color calls for each pixel.
 */
function handleCameraBatchViaCircuitry(
	tbComp: any,
	surfaceId: string,
	pixels: Array<{ x: number; y: number; color: string }>,
): void {
	const circuitry = tbComp.circuitryData
	if (!circuitry?.nodes?.length || !circuitry?.edges?.length) return

	const nodeId: string = "surface-" + surfaceId

	// Find the screen node connected to this camera's output
	let screenNode: any = null
	for (const edge of circuitry.edges) {
		if (edge.from !== nodeId) continue
		const target = circuitry.nodes.find((n: any) => n.id === edge.to)
		if (target?.type === "screen") {
			screenNode = target
			break
		}
	}
	if (!screenNode) return

	const screenId: string = screenNode.config?.screenId || ""
	const screen = pixelScreens.get(screenId)
	if (!screen) return

	// Build lever name prefix
	const prefix: string = screenId ? `pixel:${screenId}:` : "pixel:"

	for (const { x, y, color } of pixels) {
		const key: string = `${x}-${y}`
		if (!screen.pixels.has(key)) continue // dead pixel — skip
		const name: string = `${prefix}${key}`
		fetch(`/api/color/${encodeURIComponent(name)}/${color}`, { method: "POST" })
	}
}

// --- Config Save (per-component via Store) ---

function saveConfig(cfg?: any): void {
	if (cfg) {
		// Full config object passed (from context menu add/delete).
		// Sync title and all components to Store.
		if (cfg.title) Store.setTitle(cfg.title)
		for (const comp of cfg.components || []) {
			// Merge current grid position into the component before saving
			const gridComp = grid.getComponent(comp.id)
			if (gridComp) {
				comp.x = gridComp.x
				comp.y = gridComp.y
				comp.w = gridComp.w
				comp.h = gridComp.h
			}
			Store.saveComponent(comp)
			componentData.set(comp.id, comp)
		}
		// Remove components no longer in the config
		const newIds = new Set((cfg.components || []).map((c: any) => c.id))
		for (const existingId of Store.getComponentIds()) {
			if (!newIds.has(existingId)) {
				Store.removeComponent(existingId)
				componentData.delete(existingId)
			}
		}
	}
}

/** Return a config-shaped object for backwards compat with context menu. */
function getConfig(): { title: string; components: ComponentData[] } {
	return {
		title: Store.getTitle(),
		components: Store.loadAll(),
	}
}

// --- Config Change Handler ---

async function handleComponentConfigChange(detail: any): Promise<void> {
	const comp: ComponentData | null | undefined =
		componentData.get(detail.id) || Store.readComponent(detail.id)
	if (!comp) return

	if (detail.property === "color") {
		comp.color = detail.value
	} else if (detail.property === "circuitry") {
		comp.circuitry = detail.value
	} else if (detail.property === "surface") {
		comp.surface = detail.value
		// Recalculate minimum size to fit all surface elements
		if (detail.minWidth !== undefined || detail.minHeight !== undefined) {
			;(comp as any).minWidth = detail.minWidth
			;(comp as any).minHeight = detail.minHeight
			grid.updateConstraints(detail.id, {
				minW: detail.minWidth,
				minH: detail.minHeight,
			})
		}
	}

	// Merge grid position
	const gridComp = grid.getComponent(detail.id)
	if (gridComp) {
		comp.x = gridComp.x
		comp.y = gridComp.y
		comp.w = gridComp.w
		comp.h = gridComp.h
	}

	Store.saveComponent(comp)
	componentData.set(comp.id, comp)
}

// --- WebSocket ---

function connect(): void {
	ws = new WebSocket(`ws://${location.host}/ws`)

	ws.onopen = () => {
		// WS connected to dashboard server; game status comes via messages
	}

	ws.onclose = () => {
		connLed.setAttribute("color", "red")
		connLed.removeAttribute("on")
		connText.textContent = "Link Down"
		setTimeout(connect, 2000)
	}

	ws.onmessage = (e: MessageEvent) => {
		try {
			const data = JSON.parse(e.data)

			// Update game connection LED
			if (data.gameConnected !== undefined) {
				if (data.gameConnected) {
					connLed.setAttribute("color", "green")
					connLed.setAttribute("on", "")
					connText.textContent = "Link Active"
				} else {
					connLed.setAttribute("color", "red")
					connLed.removeAttribute("on")
					connText.textContent = "No Game"
				}
			}

			if (data.devices) {
				applyDeviceState(data.devices)
			}
		} catch (err) {
			console.error("WS parse error:", err)
		}
	}
}

// --- Context Menu ---
initContextMenu({
	getConfig,
	saveConfig,
	buildComponents,
	gridViewport,
})

// --- Boot ---
loadConfig()
connect()
