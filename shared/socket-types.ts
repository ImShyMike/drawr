import { z } from 'zod';

export const pointSchema = z.object({
	x: z.number(),
	y: z.number()
});

const baseElementSchema = z.object({
	id: z.string(),
	x: z.number(),
	y: z.number()
});

export const lineElementSchema = baseElementSchema.extend({
	type: z.literal('line'),
	end: pointSchema
});

export const rectElementSchema = baseElementSchema.extend({
	type: z.literal('rect'),
	width: z.number(),
	height: z.number()
});

export const circleElementSchema = baseElementSchema.extend({
	type: z.literal('circle'),
	radius: z.number()
});

export const textElementSchema = baseElementSchema.extend({
	type: z.literal('text'),
	text: z.string(),
	size: z.number()
});

export const elementSchema = z.discriminatedUnion('type', [
	lineElementSchema,
	rectElementSchema,
	circleElementSchema,
	textElementSchema
]);

export type Point = z.infer<typeof pointSchema>;
export type LineElement = z.infer<typeof lineElementSchema>;
export type RectElement = z.infer<typeof rectElementSchema>;
export type CircleElement = z.infer<typeof circleElementSchema>;
export type TextElement = z.infer<typeof textElementSchema>;
export type AnyElement = z.infer<typeof elementSchema>;
export type Element = Pick<AnyElement, 'id' | 'type' | 'x' | 'y'>;

type UpdatePayload<T extends Element> = T extends unknown
	? Pick<T, 'id'> & Partial<Omit<T, 'id' | 'type'>>
	: never;

export type AnyElementUpdate = UpdatePayload<AnyElement>;

export const updateIdSchema = z.object({
	id: z.string()
});

export interface RoomLoadedPayload {
	roomCode: string;
	elements: AnyElement[];
}

const baseUpdateSchema = updateIdSchema.extend({
	x: z.number().optional(),
	y: z.number().optional()
});

export const updateSchemas = {
	line: baseUpdateSchema.extend({
		end: pointSchema.optional()
	}),
	rect: baseUpdateSchema.extend({
		width: z.number().optional(),
		height: z.number().optional()
	}),
	circle: baseUpdateSchema.extend({
		radius: z.number().optional()
	}),
	text: baseUpdateSchema.extend({
		text: z.string().optional(),
		size: z.number().optional()
	})
} satisfies {
	[ElementType in AnyElement['type']]: z.ZodType<
		UpdatePayload<Extract<AnyElement, { type: ElementType }>>
	>;
};

export interface ServerToClientEvents {
	'room-loaded': (data: RoomLoadedPayload) => void;
	'element-created': (element: AnyElement) => void;
	'element-updated': (element: AnyElementUpdate) => void;
}

export interface ClientToServerEvents {
	'join-room': (roomCode: string) => void;
	'create-element': (element: AnyElement) => void;
	'update-element': (element: AnyElementUpdate) => void;
}

export interface SocketData {
	roomCode?: string;
}
