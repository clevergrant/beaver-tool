const DEFAULT_FPS: number = 24;
const DEFAULT_THRESHOLD: number = 30;

/**
 * <tb-camera> — Camera feed surface component.
 *
 * A skeumorphic CRT/TV screen that captures webcam video, downscales it
 * to a pixel grid whose resolution is determined by connected pixel-levers,
 * and emits color-batch events with {x, y, color} for each frame's changed
 * pixels. Wire the single "stream" output to a Screen node in the circuitry
 * editor — the screen auto-discovers pixel:X-Y levers.
 *
 * Resolution is set externally via setResolution(width, height), driven by
 * the pixel map built from lever names.
 *
 * Attributes:
 *   fps       - Max frames per second        (default: 24)
 *   threshold - Color change tolerance 0-255 (default: 30)
 */
class TbCamera extends TbSurfaceComponent {
  static get observedAttributes(): string[] {
    return ["fps", "threshold"];
  }

  static get circuitryPorts(): CircuitryPorts {
    return { inputs: [], outputs: ["stream"] };
  }

  static get sizeConstraints(): SizeConstraints {
    return { minW: 2, minH: 2, maxW: null, maxH: null };
  }

  private _active: boolean;
  private _stream: MediaStream | null;
  private _sending: boolean;
  private _lastSendTime: number;
  private _lastFrame: Record<string, [number, number, number]>;
  private _rafId: number | null;
  private _staticRafId: number | null;
  private _staticLastTime: number;
  private _width: number;
  private _height: number;
  private _deadPixels: (Set<string> & { _srcPixels?: Set<string> }) | null;
  private _canvas: HTMLCanvasElement;
  private _ctx: CanvasRenderingContext2D;
  private _video: HTMLVideoElement;
  private _overlay: HTMLElement;
  private _overlayIcon: HTMLElement;
  private _powerLed: HTMLElement;
  private _beforeUnloadHandler: () => void;
  private _onTrackEnded: (() => void) | null;
  private _starting: boolean;

  constructor() {
    super();
    this._active = false;
    this._stream = null;
    this._sending = false;
    this._lastSendTime = 0;
    this._lastFrame = {};
    this._rafId = null;
    this._staticRafId = null;
    this._staticLastTime = 0;
    this._width = 0;
    this._height = 0;
    this._deadPixels = null;
    this._onTrackEnded = null;
    this._starting = false;
    this._beforeUnloadHandler = () => {};

    this.attachShadow({ mode: "open" });
    this.shadowRoot!.innerHTML = `
      <style>
        :host {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          position: relative;
        }

        .housing {
          position: relative;
          width: 92%;
          height: calc(92% + 9px);
          border-radius: 6px;
          background: radial-gradient(circle at 40% 35%, #3a3a38, #1a1a18);
          border: 2px solid #4a4a44;
          box-shadow:
            inset 0 2px 8px rgba(0,0,0,0.8),
            inset 0 0 2px rgba(0,0,0,0.6),
            0 1px 3px rgba(0,0,0,0.4);
          overflow: visible;
          display: flex;
          align-items: flex-start;
          justify-content: center;
        }

        /* Mounting bolts */
        .bolt {
          position: absolute;
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: radial-gradient(circle at 35% 35%, #888, #555);
          box-shadow: inset 0 0.5px 1px rgba(255,255,255,0.15);
          z-index: 4;
        }
        .bolt-tl { top: 2px; left: 2px; }
        .bolt-tr { top: 2px; right: 2px; }
        .bolt-bl { bottom: 2px; left: 2px; }
        .bolt-br { bottom: 2px; right: 2px; }

        /* The screen area */
        .screen {
          position: relative;
          background: #0a0a0a;
          border-radius: 3px;
          box-shadow: inset 0 1px 6px rgba(0,0,0,0.9);
          overflow: hidden;
          display: flex;
					margin-top: 5px;
          align-items: center;
          justify-content: center;
          width: calc(100% - 10px);
          height: calc(100% - 19px);
          z-index: 2;
        }

        /* Pixel canvas — scaled up with nearest-neighbor */
        canvas {
          image-rendering: pixelated;
          image-rendering: crisp-edges;
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        /* CRT scanline overlay */
        .screen::before {
          content: '';
          position: absolute;
          inset: 0;
          background: repeating-linear-gradient(
            0deg,
            transparent 0px,
            transparent 2px,
            rgba(0,0,0,0.08) 2px,
            rgba(0,0,0,0.08) 4px
          );
          pointer-events: none;
          z-index: 2;
        }

        /* CRT glass shine */
        .screen::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(
            135deg,
            rgba(255,255,255,0.08) 0%,
            rgba(255,255,255,0.03) 30%,
            transparent 60%
          );
          pointer-events: none;
          z-index: 3;
        }

        /* Hidden video element for camera stream — avoid display:none
           which prevents some browsers from loading/playing media. */
        video {
          position: absolute;
          width: 0;
          height: 0;
          opacity: 0;
          pointer-events: none;
        }

        /* Overlay controls */
        .overlay {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          z-index: 4;
          cursor: pointer;
          transition: opacity 0.3s;
        }

        .overlay.streaming {
          opacity: 0;
          pointer-events: auto;
          transition: opacity 0.2s;
        }

        .overlay.streaming:hover {
          opacity: 1;
        }

        .overlay:hover {
          background: rgba(0,0,0,0.2);
        }

        .overlay-icon {
          font-size: 1.4rem;
          color: rgba(255,255,255,0.5);
          transition: color 0.2s;
        }

        .overlay:hover .overlay-icon {
          color: rgba(255,255,255,0.8);
        }

        /* Power LED — sits in the bottom bezel */
        .power-led {
          position: absolute;
          bottom: 4.5px;
          left: 10px;
          width: 8px;
          height: 4px;
          border-radius: 4px;
          background: #333;
          border: 0.5px solid #555;
          z-index: 4;
          transition: background 0.3s, box-shadow 0.3s;
        }

        .power-led.on {
          background: #30ff60;
          box-shadow: 0 0 4px rgba(48,255,96,0.5);
        }

        .power-led.connecting {
          background: #ffcc00;
          box-shadow: 0 0 4px rgba(255,204,0,0.5);
          animation: led-pulse 1s ease-in-out infinite;
        }

        .power-led.error {
          background: #ff3030;
          box-shadow: 0 0 4px rgba(255,48,48,0.5);
        }

        @keyframes led-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      </style>

      <div class="housing">
        <span class="bolt bolt-tl"></span>
        <span class="bolt bolt-tr"></span>
        <span class="bolt bolt-bl"></span>
        <span class="bolt bolt-br"></span>
        <div class="screen">
          <canvas></canvas>
          <div class="overlay">
            <span class="overlay-icon">&#9654;</span>
          </div>
        </div>
        <video playsinline muted></video>
        <span class="power-led"></span>
      </div>
    `;

    this._canvas = this.shadowRoot!.querySelector("canvas") as HTMLCanvasElement;
    this._ctx = this._canvas.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D;
    this._video = this.shadowRoot!.querySelector("video") as HTMLVideoElement;
    this._overlay = this.shadowRoot!.querySelector(".overlay") as HTMLElement;
    this._overlayIcon = this.shadowRoot!.querySelector(".overlay-icon") as HTMLElement;
    this._powerLed = this.shadowRoot!.querySelector(".power-led") as HTMLElement;

    // Click overlay to toggle camera
    this._overlay.addEventListener("click", (e: MouseEvent) => {
      e.stopPropagation();
      if (this._active) {
        this._stopCamera();
      } else {
        this._startCamera();
      }
    });

    // Also allow clicking the screen to stop when streaming
    (this.shadowRoot!.querySelector(".screen") as HTMLElement).addEventListener("click", (e: MouseEvent) => {
      if (this._active) {
        e.stopPropagation();
        this._stopCamera();
      }
    });
  }

  connectedCallback(): void {
    super.connectedCallback();
    this._updateCanvasSize();
    this._beforeUnloadHandler = () => this._stopCamera();
    window.addEventListener("beforeunload", this._beforeUnloadHandler);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._stopCamera();
    this._stopStatic();
    window.removeEventListener("beforeunload", this._beforeUnloadHandler);
  }

  attributeChangedCallback(name: string, _oldValue: string | null, _newValue: string | null): void {
    if (name === "fps") {
      // fps change doesn't need canvas resize
    }
  }

  // --- Properties ---

  get fps(): number {
    const val: number = parseFloat(this.getAttribute("fps") as string);
    return val > 0 ? val : DEFAULT_FPS;
  }
  set fps(val: number) { this.setAttribute("fps", String(val)); }

  get threshold(): number {
    const val: number = parseInt(this.getAttribute("threshold") as string);
    return (val >= 0 && val <= 255) ? val : DEFAULT_THRESHOLD;
  }
  set threshold(val: number) { this.setAttribute("threshold", String(val)); }

  /**
   * Single stream output port.
   */
  buildPorts(): CircuitryPorts {
    return { inputs: [], outputs: ["stream"] };
  }

  /**
   * Set the output resolution from the connected screen's pixel map.
   * @param width  - Pixel grid width (maxX + 1)
   * @param height - Pixel grid height (maxY + 1)
   * @param pixels - Set of "x-y" coordinate strings that have levers
   */
  setResolution(width: number, height: number, pixels: Set<string>): void {
    if (width === this._width && height === this._height && pixels === (this._deadPixels as any)?._srcPixels) return;
    this._width = width;
    this._height = height;
    this._lastFrame = {};

    // Build dead pixel set: all coords NOT in the pixels set
    const deadPixels: Set<string> & { _srcPixels?: Set<string> } = new Set<string>();
    deadPixels._srcPixels = pixels; // cache reference for change detection
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!pixels.has(`${x}-${y}`)) {
          deadPixels.add(`${x}-${y}`);
        }
      }
    }
    this._deadPixels = deadPixels;

    this._updateCanvasSize();
  }

  // --- Canvas ---

  private _updateCanvasSize(): void {
    this._canvas.width = Math.max(1, this._width);
    this._canvas.height = Math.max(1, this._height);
  }

  /** Fall back to 16x16 when no screen node has set the resolution yet. */
  private _applyDefaultResolution(): void {
    this._width = 16;
    this._height = 16;
    this._lastFrame = {};
    this._deadPixels = null;
    this._updateCanvasSize();
  }

  // --- LED state ---

  private _setLed(state: string | null): void {
    this._powerLed.classList.remove("on", "connecting", "error");
    if (state) this._powerLed.classList.add(state);

    // Show static noise only when LED is yellow (connecting) or red (error)
    if (state === "connecting" || state === "error") {
      this._startStatic();
    } else {
      this._stopStatic();
    }
  }

  // --- Camera ---

  private async _startCamera(): Promise<void> {
    if (this._starting) return; // guard against re-entrant calls
    if (!this._width || !this._height) this._applyDefaultResolution();
    this._starting = true;
    this._setLed("connecting");

    try {
      await this._acquireAndPlay();

      // Listen for camera disconnection / track ending
      this._onTrackEnded = () => this._stopCamera();
      for (const track of this._stream!.getTracks()) {
        track.addEventListener("ended", this._onTrackEnded);
      }

      this._stopStatic();

      this._active = true;
      this._lastSendTime = 0;
      this._lastFrame = {};

      this._overlay.classList.add("streaming");
      this._overlayIcon.textContent = "\u25A0";
      this._setLed("on");

      this._captureLoop();
    } catch (err) {
      console.error("Camera access failed:", err);
      this._setLed("error");
      this._releaseStream();
    } finally {
      this._starting = false;
    }
  }

  /**
   * Try to acquire the webcam and start playback, retrying up to 3 times
   * with a short delay if the device is temporarily busy (AbortError).
   */
  private async _acquireAndPlay(retries: number = 3): Promise<void> {
    for (let attempt: number = 1; attempt <= retries; attempt++) {
      // Clean up any leftover stream from a previous failed attempt
      this._releaseStream();

      try {
        this._stream = await navigator.mediaDevices.getUserMedia({ video: true });
        this._video.srcObject = this._stream;
        await this._video.play();
        return; // success
      } catch (err) {
        this._releaseStream();
        const isDeviceBusy: boolean = (err as DOMException).name === "AbortError" ||
                             (err as DOMException).name === "NotReadableError";
        if (isDeviceBusy && attempt < retries) {
          // Device still locked from a previous session — wait and retry
          await new Promise<void>((r) => setTimeout(r, 500 * attempt));
          continue;
        }
        throw err;
      }
    }
  }

  /** Stop all tracks and detach the stream from the video element. */
  private _releaseStream(): void {
    this._video.srcObject = null;
    if (this._stream) {
      for (const track of this._stream.getTracks()) track.stop();
      this._stream = null;
    }
  }

  private _stopCamera(): void {
    this._active = false;

    // Remove track-ended listeners before releasing
    if (this._stream && this._onTrackEnded) {
      for (const track of this._stream.getTracks()) {
        track.removeEventListener("ended", this._onTrackEnded);
      }
      this._onTrackEnded = null;
    }
    this._releaseStream();

    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }

    this._overlay.classList.remove("streaming");
    this._overlayIcon.textContent = "\u25B6";
    this._setLed(null);

    // Clear the canvas to black
    this._ctx.fillStyle = "#000";
    this._ctx.fillRect(0, 0, this._canvas.width, this._canvas.height);
  }

  // --- Static Noise ---

  private _startStatic(): void {
    if (this._staticRafId) return;
    this._staticLastTime = 0;
    this._staticLoop();
  }

  private _stopStatic(): void {
    if (this._staticRafId) {
      cancelAnimationFrame(this._staticRafId);
      this._staticRafId = null;
    }
  }

  private _staticLoop(): void {
    this._staticRafId = requestAnimationFrame(() => this._staticLoop());

    const now: number = performance.now();
    if (now - this._staticLastTime < 1000 / this.fps) return;
    this._staticLastTime = now;

    this._renderStatic();
  }

  private _renderStatic(): void {
    const w: number = this._width;
    const h: number = this._height;
    if (!w || !h) return;

    const imageData: ImageData = this._ctx.createImageData(w, h);
    const data: Uint8ClampedArray = imageData.data;

    for (let y: number = 0; y < h; y++) {
      for (let x: number = 0; x < w; x++) {
        const i: number = (y * w + x) * 4;
        if (this._deadPixels?.has(`${x}-${y}`)) {
          // Dead pixel — magenta
          data[i]     = 255;
          data[i + 1] = 0;
          data[i + 2] = 255;
        } else {
          // Classic TV static: random grayscale with bias toward dark values
          const v: number = Math.random() < 0.15
            ? (180 + Math.random() * 75) | 0
            : (Math.random() * 100) | 0;
          data[i]     = v;
          data[i + 1] = v;
          data[i + 2] = v;
        }
        data[i + 3] = 255;
      }
    }

    this._ctx.putImageData(imageData, 0, 0);
  }

  // --- Capture Loop ---

  private _captureLoop(): void {
    if (!this._active) return;
    this._rafId = requestAnimationFrame(() => this._captureLoop());

    const now: number = performance.now();
    if (now - this._lastSendTime < 1000 / this.fps) return;
    if (this._sending) return; // drop frame if previous batch in-flight

    this._lastSendTime = now;
    this._processFrame();
  }

  private _processFrame(): void {
    const video: HTMLVideoElement = this._video;
    if (!video.videoWidth || !video.videoHeight) return;

    const w: number = this._width;
    const h: number = this._height;
    if (!w || !h) return;

    const srcW: number = video.videoWidth;
    const srcH: number = video.videoHeight;

    // Step 1: Crop to match output aspect ratio
    const targetRatio: number = w / h;
    let cropW: number = srcW;
    let cropH: number = srcW / targetRatio;

    if (cropH > srcH) {
      cropH = srcH;
      cropW = srcH * targetRatio;
    }

    const offsetX: number = (srcW - cropW) / 2;
    const offsetY: number = (srcH - cropH) / 2;

    // Step 2: Draw cropped region onto w×h canvas (browser downscales)
    this._ctx.drawImage(
      video,
      offsetX, offsetY, cropW, cropH,  // source rect
      0, 0, w, h                       // dest rect
    );

    // Step 3: Read pixels and diff
    const imageData: ImageData = this._ctx.getImageData(0, 0, w, h);
    const pixels: Uint8ClampedArray = imageData.data;
    const changes: { x: number; y: number; color: string }[] = [];
    const thresh: number = this.threshold;

    for (let y: number = 0; y < h; y++) {
      for (let x: number = 0; x < w; x++) {
        const i: number = (y * w + x) * 4;
        const key: string = `${x}-${y}`;

        // Dead pixels render magenta on canvas, never emitted
        if (this._deadPixels?.has(key)) {
          pixels[i]     = 255;
          pixels[i + 1] = 0;
          pixels[i + 2] = 255;
          continue;
        }

        const pr: number = pixels[i]!, pg: number = pixels[i + 1]!, pb: number = pixels[i + 2]!;
        const prev: [number, number, number] | undefined = this._lastFrame[key];

        if (!prev || this._colorDistance(pr, pg, pb, prev[0], prev[1], prev[2]) > thresh) {
          this._lastFrame[key] = [pr, pg, pb];
          changes.push({ x, y, color: this._rgbToHex(pr, pg, pb) });
        }
      }
    }

    // Write magenta dead pixels back to canvas
    if (this._deadPixels?.size) {
      this._ctx.putImageData(imageData, 0, 0);
    }

    // Step 4: Emit batch event if there are changes
    if (changes.length > 0) {
      this.dispatchEvent(new CustomEvent<{ pixels: { x: number; y: number; color: string }[] }>("color-batch", {
        bubbles: true,
        detail: { pixels: changes },
      }));
    }
  }

  private _rgbToHex(r: number, g: number, b: number): string {
    return ((r << 16) | (g << 8) | b).toString(16).padStart(6, "0");
  }

  private _colorDistance(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
    return Math.max(Math.abs(r1 - r2), Math.abs(g1 - g2), Math.abs(b1 - b2));
  }
}

customElements.define("tb-camera", TbCamera);
