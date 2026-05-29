import {
	getPixelColor,
	getPixelX,
	getPixelY,
	packPixelUpdate,
	type PixelUpdate
} from '../../../shared/socket-types';

export const INITIAL_SCALE = 2;
export const MIN_SCALE = 0.25;
export const MAX_SCALE = 32;
export const BYTES_PER_PIXEL = 4;

export interface CanvasView {
	offsetX: number;
	offsetY: number;
	scale: number;
}

export interface CanvasPoint {
	x: number;
	y: number;
}

export interface TouchPointer {
	clientX: number;
	clientY: number;
}

export interface TouchGesture {
	centerX: number;
	centerY: number;
	distance: number;
}

export function colorStringToNumber(color: string) {
	return Number.parseInt(color.slice(1), 16);
}

export function colorNumberToRgb(color: number) {
	return {
		r: (color >> 16) & 0xff,
		g: (color >> 8) & 0xff,
		b: color & 0xff
	};
}

export function createBlankImageData(ctx: CanvasRenderingContext2D, canvasSize: number) {
	const imageData = ctx.createImageData(canvasSize, canvasSize);

	for (let index = 0; index < imageData.data.length; index += BYTES_PER_PIXEL) {
		imageData.data[index] = 255;
		imageData.data[index + 1] = 255;
		imageData.data[index + 2] = 255;
		imageData.data[index + 3] = 255;
	}

	return imageData;
}

export function putPixelUpdate(
	ctx: CanvasRenderingContext2D,
	imageData: ImageData,
	update: PixelUpdate,
	canvasSize: number
) {
	const x = getPixelX(update, canvasSize);
	const y = getPixelY(update, canvasSize);
	const { r, g, b } = colorNumberToRgb(getPixelColor(update));
	const index = (y * canvasSize + x) * BYTES_PER_PIXEL;

	imageData.data[index] = r;
	imageData.data[index + 1] = g;
	imageData.data[index + 2] = b;
	imageData.data[index + 3] = 255;

	ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
	ctx.fillRect(x, y, 1, 1);
}

export function getCanvasPointFromPointerEvent(
	canvas: HTMLCanvasElement,
	event: PointerEvent,
	canvasSize: number
): CanvasPoint | null {
	const rect = canvas.getBoundingClientRect();
	const scaleX = rect.width / canvas.offsetWidth;
	const scaleY = rect.height / canvas.offsetHeight;
	const style = getComputedStyle(canvas);
	const contentLeft = rect.left + Number.parseFloat(style.borderLeftWidth) * scaleX;
	const contentTop = rect.top + Number.parseFloat(style.borderTopWidth) * scaleY;
	const contentWidth = canvas.clientWidth * scaleX;
	const contentHeight = canvas.clientHeight * scaleY;
	const x = Math.floor(((event.clientX - contentLeft) / contentWidth) * canvasSize);
	const y = Math.floor(((event.clientY - contentTop) / contentHeight) * canvasSize);

	if (!isCanvasPointInBounds({ x, y }, canvasSize)) {
		return null;
	}

	return { x, y };
}

export function isCanvasPointInBounds(point: CanvasPoint, canvasSize: number) {
	return point.x >= 0 && point.x < canvasSize && point.y >= 0 && point.y < canvasSize;
}

export function packCanvasPointUpdate(point: CanvasPoint, color: number, canvasSize: number) {
	return packPixelUpdate(point.x, point.y, color, canvasSize);
}

export function forEachLinePoint(
	from: CanvasPoint,
	to: CanvasPoint,
	onPoint: (point: CanvasPoint) => void
) {
	let x = from.x;
	let y = from.y;
	const dx = Math.abs(to.x - from.x);
	const dy = Math.abs(to.y - from.y);
	const stepX = from.x < to.x ? 1 : -1;
	const stepY = from.y < to.y ? 1 : -1;
	let error = dx - dy;

	while (true) {
		onPoint({ x, y });

		if (x === to.x && y === to.y) {
			break;
		}

		const doubledError = error * 2;

		if (doubledError > -dy) {
			error -= dy;
			x += stepX;
		}

		if (doubledError < dx) {
			error += dx;
			y += stepY;
		}
	}
}

export function getTouchPointer(event: PointerEvent): TouchPointer {
	return {
		clientX: event.clientX,
		clientY: event.clientY
	};
}

export function getTouchGesture(touchPointers: Iterable<TouchPointer>): TouchGesture | null {
	const pointers = [...touchPointers].slice(0, 2);

	if (pointers.length < 2) {
		return null;
	}

	const [first, second] = pointers;
	const deltaX = second.clientX - first.clientX;
	const deltaY = second.clientY - first.clientY;

	return {
		centerX: (first.clientX + second.clientX) / 2,
		centerY: (first.clientY + second.clientY) / 2,
		distance: Math.hypot(deltaX, deltaY)
	};
}

export function getClampedScale(nextScale: number) {
	return Math.max(MIN_SCALE, Math.min(MAX_SCALE, nextScale));
}

export function updateCanvasPosition(
	canvas: HTMLCanvasElement | null,
	scale: number,
	offsetX: number,
	offsetY: number
) {
	if (!canvas) return;

	canvas.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
}

export function resetView(
	canvas: HTMLCanvasElement | null,
	canvasContainer: HTMLDivElement
): CanvasView | void {
	const centerResult = centerView(canvas, canvasContainer, INITIAL_SCALE);
	if (centerResult) {
		updateCanvasPosition(canvas, INITIAL_SCALE, centerResult.offsetX, centerResult.offsetY);
		return {
			offsetX: centerResult.offsetX,
			offsetY: centerResult.offsetY,
			scale: INITIAL_SCALE
		};
	}
	return undefined;
}

export function centerView(
	canvas: HTMLCanvasElement | null,
	canvasContainer: HTMLDivElement,
	scale: number
): CanvasView | void {
	if (!canvasContainer || !canvas) return;

	const containerRect = canvasContainer.getBoundingClientRect();
	const canvasWidth = canvas.width * scale;
	const canvasHeight = canvas.height * scale;

	const offsetX = (containerRect.width - canvasWidth) / 2;
	const offsetY = (containerRect.height - canvasHeight) / 2;

	return {
		offsetX,
		offsetY,
		scale
	};
}
