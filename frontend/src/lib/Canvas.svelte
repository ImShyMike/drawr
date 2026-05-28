<script lang="ts">
	import { onMount } from 'svelte';
	import EraserIcon from '@lucide/svelte/icons/eraser';
	import PaintbrushIcon from '@lucide/svelte/icons/paintbrush';
	import {
		CANVAS_SIZE,
		MAX_PIXEL_UPDATES_PER_BATCH,
		PIXEL_BATCH_INTERVAL_MS,
		type PixelBatch,
		type PixelUpdate
	} from '../../../shared/socket-types';

	interface Props {
		pixels: PixelUpdate[];
		onPaintPixels: (updates: PixelBatch) => void;
	}

	let { pixels, onPaintPixels }: Props = $props();

	const emptyColor = '#ffffff';
	const defaultColor = '#111827';
	const bytesPerPixel = 4;

	let canvas: HTMLCanvasElement | null = null;
	let context: CanvasRenderingContext2D | null = null;
	let imageData: ImageData | null = null;
	let selectedColor = $state(defaultColor);
	let brushSize = $state(1);
	let isPainting = false;
	let paintedPixelCount = $derived(pixels.length);
	let pendingPixels = new Map<string, PixelUpdate>();
	let lastRenderedPixels = new Map<string, PixelUpdate>();

	$effect(() => {
		renderPixels(pixels);
	});

	onMount(() => {
		context = canvas?.getContext('2d', { alpha: false }) ?? null;

		if (!context) {
			return undefined;
		}

		context.imageSmoothingEnabled = false;
		resetImageData();
		renderPixels(pixels, true);

		const flushInterval = setInterval(flushPendingPixels, PIXEL_BATCH_INTERVAL_MS);

		return () => {
			flushPendingPixels();
			clearInterval(flushInterval);
		};
	});

	function resetImageData() {
		if (!context) {
			return;
		}

		imageData = context.createImageData(CANVAS_SIZE, CANVAS_SIZE);

		for (let index = 0; index < imageData.data.length; index += bytesPerPixel) {
			imageData.data[index] = 255;
			imageData.data[index + 1] = 255;
			imageData.data[index + 2] = 255;
			imageData.data[index + 3] = 255;
		}

		context.putImageData(imageData, 0, 0);
	}

	function getPixelKey(pixel: Pick<PixelUpdate, 'x' | 'y'>) {
		return `${pixel.x},${pixel.y}`;
	}

	function colorToRgb(color: string) {
		return {
			r: Number.parseInt(color.slice(1, 3), 16),
			g: Number.parseInt(color.slice(3, 5), 16),
			b: Number.parseInt(color.slice(5, 7), 16)
		};
	}

	function putPixel(update: PixelUpdate) {
		if (!context || !imageData) {
			return;
		}

		const { r, g, b } = colorToRgb(update.color);
		const index = (update.y * CANVAS_SIZE + update.x) * bytesPerPixel;
		imageData.data[index] = r;
		imageData.data[index + 1] = g;
		imageData.data[index + 2] = b;
		imageData.data[index + 3] = 255;

		context.fillStyle = update.color;
		context.fillRect(update.x, update.y, 1, 1);
	}

	function renderPixels(nextPixels: PixelUpdate[], force = false) {
		if (!context || !imageData) {
			return;
		}

		const nextPixelsByKey = new Map(nextPixels.map((pixel) => [getPixelKey(pixel), pixel]));

		if (force || nextPixelsByKey.size < lastRenderedPixels.size) {
			lastRenderedPixels = new Map();
			resetImageData();
		}

		for (const [key, pixel] of nextPixelsByKey) {
			const renderedPixel = lastRenderedPixels.get(key);

			if (renderedPixel?.color === pixel.color) {
				continue;
			}

			putPixel(pixel);
		}

		lastRenderedPixels = nextPixelsByKey;
	}

	function canvasPositionFromEvent(event: PointerEvent) {
		if (!canvas) {
			return null;
		}

		const rect = canvas.getBoundingClientRect();
		const x = Math.floor(((event.clientX - rect.left) / rect.width) * CANVAS_SIZE);
		const y = Math.floor(((event.clientY - rect.top) / rect.height) * CANVAS_SIZE);

		if (x < 0 || x >= CANVAS_SIZE || y < 0 || y >= CANVAS_SIZE) {
			return null;
		}

		return { x, y };
	}

	function queuePixel(update: PixelUpdate) {
		pendingPixels.set(getPixelKey(update), update);
		putPixel(update);
		lastRenderedPixels.set(getPixelKey(update), update);
	}

	function paintAt(event: PointerEvent) {
		const position = canvasPositionFromEvent(event);

		if (!position) {
			return;
		}

		const radius = Math.floor(brushSize / 2);
		const color = event.buttons === 2 ? emptyColor : selectedColor;

		for (let y = position.y - radius; y <= position.y + radius; y += 1) {
			for (let x = position.x - radius; x <= position.x + radius; x += 1) {
				if (x < 0 || x >= CANVAS_SIZE || y < 0 || y >= CANVAS_SIZE) {
					continue;
				}

				queuePixel({ x, y, color });
			}
		}
	}

	function startPainting(event: PointerEvent) {
		isPainting = true;
		canvas?.setPointerCapture(event.pointerId);
		paintAt(event);
	}

	function continuePainting(event: PointerEvent) {
		if (!isPainting) {
			return;
		}

		paintAt(event);
	}

	function stopPainting(event: PointerEvent) {
		isPainting = false;

		if (canvas?.hasPointerCapture(event.pointerId)) {
			canvas.releasePointerCapture(event.pointerId);
		}
	}

	function flushPendingPixels() {
		if (pendingPixels.size === 0) {
			return;
		}

		const updates = [...pendingPixels.values()].slice(0, MAX_PIXEL_UPDATES_PER_BATCH);

		for (const update of updates) {
			pendingPixels.delete(getPixelKey(update));
		}

		onPaintPixels(updates);
	}
</script>

<div class="canvas-shell" role="application" oncontextmenu={(event) => event.preventDefault()}>
	<div class="canvas-toolbar overlay-panel">
		<div>
			<p class="text-2xl font-semibold tracking-tight">Drawr</p>
			<span
				>{paintedPixelCount.toLocaleString()} colored pixel{paintedPixelCount === 1
					? ''
					: 's'}</span
			>
		</div>

		<div class="paint-tools" aria-label="Pixel paint controls">
			<label>
				<PaintbrushIcon size={18} strokeWidth={2.25} />
				<span>Color</span>
				<input aria-label="Paint color" type="color" bind:value={selectedColor} />
			</label>

			<label>
				<span>Brush</span>
				<input aria-label="Brush size" type="range" min="1" max="12" bind:value={brushSize} />
				<span>{brushSize}px</span>
			</label>

			<div class="eraser-hint" title="Right-click or two-finger click while painting to erase">
				<EraserIcon size={18} strokeWidth={2.25} />
				<span>Right-click erases</span>
			</div>
		</div>
	</div>

	<div class="canvas-stage">
		<canvas
			bind:this={canvas}
			width={CANVAS_SIZE}
			height={CANVAS_SIZE}
			aria-label="1000 by 1000 pixel canvas"
			onpointerdown={startPainting}
			onpointermove={continuePainting}
			onpointerup={stopPainting}
			onpointercancel={stopPainting}
			onpointerleave={stopPainting}
		></canvas>
	</div>
</div>

<style>
	.canvas-shell {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		height: 100%;
		min-height: 0;
		min-width: 0;
		width: 100%;
		position: relative;
	}

	.canvas-toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.overlay-panel {
		position: absolute;
		top: 1rem;
		left: 1rem;
		right: 1rem;
		z-index: 2;
		background: rgba(255, 255, 255, 0.9);
		backdrop-filter: blur(8px);
		border: 1px solid #e5e7eb;
		border-radius: 0.75rem;
		padding: 0.75rem 1rem;
		box-shadow: 0 10px 24px rgba(15, 23, 42, 0.12);
	}

	.canvas-toolbar > div {
		display: flex;
		align-items: baseline;
		gap: 0.75rem;
	}

	.canvas-toolbar p {
		margin: 0;
	}

	.canvas-toolbar span {
		color: #6b7280;
		font-size: 0.9rem;
	}

	.paint-tools {
		flex-wrap: wrap;
		justify-content: flex-end;
	}

	.paint-tools label,
	.eraser-hint {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		border: 1px solid #e5e7eb;
		border-radius: 999px;
		background: #f8fafc;
		padding: 0.45rem 0.7rem;
	}

	.paint-tools input[type='color'] {
		width: 2rem;
		height: 2rem;
		border: 0;
		border-radius: 999px;
		background: transparent;
		padding: 0;
	}

	.paint-tools input[type='range'] {
		width: 7rem;
		accent-color: #2563eb;
	}

	.canvas-stage {
		flex: 1 1 auto;
		min-height: 0;
		display: grid;
		place-items: center;
		overflow: hidden;
		background:
			linear-gradient(45deg, #e5e7eb 25%, transparent 25%),
			linear-gradient(-45deg, #e5e7eb 25%, transparent 25%),
			linear-gradient(45deg, transparent 75%, #e5e7eb 75%),
			linear-gradient(-45deg, transparent 75%, #e5e7eb 75%);
		background-position:
			0 0,
			0 8px,
			8px -8px,
			-8px 0;
		background-size: 16px 16px;
		box-shadow: 0 12px 32px rgb(15 23 42 / 8%);
		touch-action: none;
	}

	canvas {
		width: min(100vw, 100vh);
		height: min(100vw, 100vh);
		max-width: calc(100vw - 2rem);
		max-height: calc(100vh - 2rem);
		border: 1px solid #cbd5e1;
		background: white;
		box-shadow: 0 16px 40px rgb(15 23 42 / 16%);
		cursor: crosshair;
		image-rendering: pixelated;
		touch-action: none;
		user-select: none;
	}

	@media (max-width: 720px) {
		.canvas-toolbar {
			align-items: flex-start;
			flex-direction: column;
		}

		.paint-tools {
			justify-content: flex-start;
		}
	}
</style>
