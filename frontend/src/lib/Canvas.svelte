<script lang="ts">
	/* eslint-disable svelte/prefer-svelte-reactivity */
	import { onMount } from 'svelte';
	import {
		centerView,
		colorStringToNumber,
		createBlankImageData,
		forEachLinePoint,
		getCanvasPointFromPointerEvent,
		getClampedScale,
		getTouchGesture,
		getTouchPointer,
		INITIAL_SCALE,
		isCanvasPointInBounds,
		packCanvasPointUpdate,
		putPixelUpdate,
		resetView,
		updateCanvasPosition,
		type CanvasPoint,
		type TouchGesture,
		type TouchPointer
	} from '$lib/canvas';
	import {
		EMPTY_PIXEL_COLOR,
		getPixelPosition,
		MAX_PIXEL_UPDATES_PER_BATCH,
		PIXEL_BATCH_INTERVAL_MS,
		type PixelBatch,
		type PixelUpdate
	} from '../../../shared/socket-types';

	interface Props {
		canvasSize: number;
		pixels: PixelUpdate[];
		onPaintPixels: (updates: PixelBatch) => void;
		selectedColor?: string;
		scale?: number;
	}

	const defaultColor = '#111827';

	let {
		canvasSize,
		pixels,
		onPaintPixels,
		selectedColor = $bindable(defaultColor),
		scale = $bindable(INITIAL_SCALE)
	}: Props = $props();
	const zoomFactor = 1.1;

	let canvas: HTMLCanvasElement | null = null;
	let canvasStage: HTMLDivElement | null = null;
	let context: CanvasRenderingContext2D | null = null;
	let imageData: ImageData | null = null;
	let offsetX = $state(0);
	let offsetY = $state(0);
	let isPainting = false;
	let isPanning = false;
	let lastPointerX = 0;
	let lastPointerY = 0;
	let lastPaintPosition: CanvasPoint | null = null;
	let activeTouchPointers = new Map<number, TouchPointer>();
	let lastTouchGesture: TouchGesture | null = null;
	let animationFrameId: number | null = null;
	let pendingPixels = new Map<number, PixelUpdate>();
	let lastRenderedPixels = new Map<number, PixelUpdate>();

	$effect(() => {
		renderPixels(pixels);
	});

	onMount(() => {
		context = canvas?.getContext('2d', { alpha: false }) ?? null;

		if (!context || !canvas || !canvasStage) {
			return undefined;
		}

		context.imageSmoothingEnabled = false;
		resetImageData();
		renderPixels(pixels, true);
		centerCanvas();

		const flushInterval = setInterval(flushPendingPixels, PIXEL_BATCH_INTERVAL_MS);

		return () => {
			flushPendingPixels();
			clearInterval(flushInterval);

			if (animationFrameId !== null) {
				cancelAnimationFrame(animationFrameId);
			}

			activeTouchPointers.clear();
		};
	});

	function applyCanvasPosition() {
		if (animationFrameId !== null) {
			return;
		}

		animationFrameId = requestAnimationFrame(() => {
			updateCanvasPosition(canvas, scale, offsetX, offsetY);
			animationFrameId = null;
		});
	}

	function centerCanvas() {
		if (!canvas || !canvasStage) {
			return;
		}

		const centerResult = centerView(canvas, canvasStage, scale);

		if (!centerResult) {
			return;
		}

		({ offsetX, offsetY, scale } = centerResult);
		updateCanvasPosition(canvas, scale, offsetX, offsetY);
	}

	function resetCanvasView() {
		if (!canvas || !canvasStage) {
			return;
		}

		const resetResult = resetView(canvas, canvasStage);

		if (!resetResult) {
			return;
		}

		({ offsetX, offsetY, scale } = resetResult);
	}

	export function resetViewFromParent() {
		resetCanvasView();
	}

	function resetImageData() {
		if (!context) {
			return;
		}

		imageData = createBlankImageData(context, canvasSize);
		context.putImageData(imageData, 0, 0);
	}

	function putPixel(update: PixelUpdate) {
		if (!context || !imageData) {
			return;
		}

		putPixelUpdate(context, imageData, update, canvasSize);
	}

	function renderPixels(nextPixels: PixelUpdate[], force = false) {
		if (!context || !imageData) {
			return;
		}

		const nextPixelsByPosition = new Map(
			nextPixels.map((pixel) => [getPixelPosition(pixel), pixel])
		);

		for (const [position, pixel] of pendingPixels) {
			nextPixelsByPosition.set(position, pixel);
		}

		if (force || nextPixelsByPosition.size < lastRenderedPixels.size) {
			lastRenderedPixels = new Map();
			resetImageData();
		}

		for (const [position, pixel] of nextPixelsByPosition) {
			const renderedPixel = lastRenderedPixels.get(position);

			if (renderedPixel === pixel) {
				continue;
			}

			putPixel(pixel);
		}

		lastRenderedPixels = nextPixelsByPosition;
	}

	function canvasPositionFromEvent(event: PointerEvent) {
		if (!canvas) {
			return null;
		}

		return getCanvasPointFromPointerEvent(canvas, event, canvasSize);
	}

	function queuePixel(update: PixelUpdate) {
		const position = getPixelPosition(update);

		pendingPixels.set(position, update);
		putPixel(update);
		lastRenderedPixels.set(position, update);
	}

	function getPointerCaptureElement() {
		return canvasStage ?? canvas;
	}

	function paintBrush(position: CanvasPoint, color: number) {
		if (!isCanvasPointInBounds(position, canvasSize)) {
			return;
		}

		queuePixel(packCanvasPointUpdate(position, color, canvasSize));
	}

	function paintLine(from: CanvasPoint, to: CanvasPoint, color: number) {
		forEachLinePoint(from, to, (point) => paintBrush(point, color));
	}

	function paintAt(event: PointerEvent) {
		const position = canvasPositionFromEvent(event);

		if (!position) {
			lastPaintPosition = null;
			return;
		}

		const color =
			event.pointerType === 'mouse' && event.buttons === 2
				? EMPTY_PIXEL_COLOR
				: colorStringToNumber(selectedColor);

		if (lastPaintPosition) {
			paintLine(lastPaintPosition, position, color);
		} else {
			paintBrush(position, color);
		}

		lastPaintPosition = position;
	}

	function startPainting(event: PointerEvent) {
		if (event.pointerType === 'touch') {
			handleTouchStart(event);
			return;
		}

		if (event.button !== 0) {
			startPanning(event);
			return;
		}

		isPainting = true;
		lastPaintPosition = null;
		getPointerCaptureElement()?.setPointerCapture(event.pointerId);
		paintAt(event);
	}

	function continuePainting(event: PointerEvent) {
		if (event.pointerType === 'touch') {
			handleTouchMove(event);
			return;
		}

		if (isPanning) {
			panCanvas(event);
			return;
		}

		if (!isPainting) {
			return;
		}

		paintAt(event);
	}

	function stopPainting(event: PointerEvent) {
		if (event.pointerType === 'touch') {
			handleTouchEnd(event);
			return;
		}

		isPainting = false;
		isPanning = false;
		lastPaintPosition = null;

		const captureElement = getPointerCaptureElement();

		if (captureElement?.hasPointerCapture(event.pointerId)) {
			captureElement.releasePointerCapture(event.pointerId);
		}
	}

	function startPanning(event: PointerEvent) {
		event.preventDefault();
		isPanning = true;
		lastPointerX = event.clientX;
		lastPointerY = event.clientY;
		getPointerCaptureElement()?.setPointerCapture(event.pointerId);
	}

	function panCanvas(event: PointerEvent) {
		const deltaX = event.clientX - lastPointerX;
		const deltaY = event.clientY - lastPointerY;

		offsetX += deltaX;
		offsetY += deltaY;
		lastPointerX = event.clientX;
		lastPointerY = event.clientY;
		applyCanvasPosition();
	}

	function handleTouchStart(event: PointerEvent) {
		event.preventDefault();
		getPointerCaptureElement()?.setPointerCapture(event.pointerId);
		activeTouchPointers.set(event.pointerId, getTouchPointer(event));

		if (activeTouchPointers.size === 1) {
			isPainting = true;
			isPanning = false;
			lastPaintPosition = null;
			lastTouchGesture = null;
			paintAt(event);
			return;
		}

		isPainting = false;
		isPanning = false;
		lastPaintPosition = null;
		lastTouchGesture = getActiveTouchGesture();
	}

	function handleTouchMove(event: PointerEvent) {
		event.preventDefault();

		if (!activeTouchPointers.has(event.pointerId)) {
			return;
		}

		activeTouchPointers.set(event.pointerId, getTouchPointer(event));

		if (activeTouchPointers.size >= 2) {
			updateTouchGesture();
			return;
		}

		if (isPainting) {
			paintAt(event);
		}
	}

	function handleTouchEnd(event: PointerEvent) {
		event.preventDefault();
		activeTouchPointers.delete(event.pointerId);
		lastPaintPosition = null;

		const captureElement = getPointerCaptureElement();

		if (captureElement?.hasPointerCapture(event.pointerId)) {
			captureElement.releasePointerCapture(event.pointerId);
		}

		if (activeTouchPointers.size === 0) {
			isPainting = false;
			lastTouchGesture = null;
			return;
		}

		if (activeTouchPointers.size === 1) {
			isPainting = false;
			lastTouchGesture = null;
			return;
		}

		lastTouchGesture = getActiveTouchGesture();
	}

	function getActiveTouchGesture() {
		return getTouchGesture(activeTouchPointers.values());
	}

	function updateTouchGesture() {
		if (!canvasStage) {
			return;
		}

		const nextGesture = getActiveTouchGesture();

		if (!nextGesture) {
			lastTouchGesture = null;
			return;
		}

		if (!lastTouchGesture || lastTouchGesture.distance === 0 || nextGesture.distance === 0) {
			lastTouchGesture = nextGesture;
			return;
		}

		const stageRect = canvasStage.getBoundingClientRect();
		const lastStageX = lastTouchGesture.centerX - stageRect.left;
		const lastStageY = lastTouchGesture.centerY - stageRect.top;
		const nextStageX = nextGesture.centerX - stageRect.left;
		const nextStageY = nextGesture.centerY - stageRect.top;
		const canvasX = (lastStageX - offsetX) / scale;
		const canvasY = (lastStageY - offsetY) / scale;
		const nextScale = getClampedScale(scale * (nextGesture.distance / lastTouchGesture.distance));

		scale = nextScale;
		offsetX = nextStageX - canvasX * scale;
		offsetY = nextStageY - canvasY * scale;
		lastTouchGesture = nextGesture;
		applyCanvasPosition();
	}

	function zoomCanvas(event: WheelEvent) {
		if (!canvas || !canvasStage) {
			return;
		}

		event.preventDefault();

		const stageRect = canvasStage.getBoundingClientRect();
		const stageX = event.clientX - stageRect.left;
		const stageY = event.clientY - stageRect.top;
		const canvasX = (stageX - offsetX) / scale;
		const canvasY = (stageY - offsetY) / scale;
		const nextScale = getClampedScale(scale * (event.deltaY > 0 ? 1 / zoomFactor : zoomFactor));

		if (nextScale === scale) {
			return;
		}

		scale = nextScale;
		offsetX = stageX - canvasX * scale;
		offsetY = stageY - canvasY * scale;
		applyCanvasPosition();
	}

	function flushPendingPixels() {
		if (pendingPixels.size === 0) {
			return;
		}

		const updates = [...pendingPixels.values()].slice(0, MAX_PIXEL_UPDATES_PER_BATCH);

		for (const update of updates) {
			pendingPixels.delete(getPixelPosition(update));
		}

		onPaintPixels(updates);
	}
</script>

<div class="canvas-shell" role="application" oncontextmenu={(event) => event.preventDefault()}>
	<div
		bind:this={canvasStage}
		class="canvas-stage"
		role="application"
		aria-label="Drawing canvas interaction area"
		onwheel={zoomCanvas}
		onpointerdown={startPainting}
		onpointermove={continuePainting}
		onpointerup={stopPainting}
		onpointercancel={stopPainting}
	>
		<canvas
			bind:this={canvas}
			width={canvasSize}
			height={canvasSize}
			aria-label={`${canvasSize} by ${canvasSize} pixel canvas`}
			style={`width: ${canvasSize}px; height: ${canvasSize}px; transform-origin: 0 0; will-change: transform;`}
		></canvas>
	</div>
</div>

<style>
	.canvas-shell {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
		min-width: 0;
		width: 100%;
	}

	.canvas-stage {
		flex: 1 1 auto;
		min-height: 0;
		height: 100%;
		position: relative;
		overflow: hidden;
		background:
			linear-gradient(45deg, var(--muted) 25%, transparent 25%),
			linear-gradient(-45deg, var(--muted) 25%, transparent 25%),
			linear-gradient(45deg, transparent 75%, var(--muted) 75%),
			linear-gradient(-45deg, transparent 75%, var(--muted) 75%);
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
		position: absolute;
		top: 0;
		left: 0;
		border: 0;
		outline: 1px solid var(--border);
		background: white;
		box-shadow: 0 16px 40px rgb(15 23 42 / 16%);
		image-rendering: pixelated;
		touch-action: none;
		user-select: none;
	}
</style>
