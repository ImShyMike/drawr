<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
	import * as InputOTP from '$lib/components/ui/input-otp';

	const ROOM_CODE_LENGTH = 6;

	let roomCode = $state('');
	let isNavigating = $state(false);

	function isValidRoomCode(value: string) {
		return /^[0-9]{6}$/.test(value);
	}

	function generateRoomCode() {
		const number = Math.floor(Math.random() * 10 ** ROOM_CODE_LENGTH);
		return number.toString().padStart(ROOM_CODE_LENGTH, '0');
	}

	async function navigateToRoom(code: string) {
		const nextCode = code.toUpperCase();
		isNavigating = true;
		await goto(resolve('/[...slug]', { slug: nextCode }));
	}

	function createRoom() {
		return navigateToRoom(generateRoomCode());
	}
</script>

<svelte:head>
	<title>Drawr</title>
	<meta
		name="description"
		content="Create a room or join an existing one to start drawing together in Drawr."
	/>
</svelte:head>

<main class="relative min-h-screen overflow-hidden bg-slate-50 text-slate-900">
	<div class="mx-auto flex min-h-screen w-full max-w-2xl items-center px-6 py-12 sm:px-10">
		<section class="w-full space-y-8 text-center">
			<div class="space-y-4">
				<h1 class="font-heading text-4xl tracking-tight text-slate-900 uppercase sm:text-5xl">
					Drawr
				</h1>
				<p class="text-base text-slate-600 sm:text-lg">
					Create a room or join an existing one to sketch together in real time.
				</p>
			</div>

			<div class="mx-auto w-full max-w-md space-y-5">
				<Button
					type="button"
					onclick={createRoom}
					disabled={isNavigating}
					class="inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-5 py-3 text-base font-semibold text-white shadow-md transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
				>
					Create room
				</Button>

				<form
					class="space-y-4"
					onsubmit={(e) => {
						e.preventDefault();
						navigateToRoom(roomCode);
					}}
				>
					<InputOTP.Root
						maxlength={ROOM_CODE_LENGTH}
						minlength={ROOM_CODE_LENGTH}
						pattern="[0-9]+"
						class="flex justify-center uppercase"
						bind:value={roomCode}
					>
						{#snippet children({ cells })}
							<InputOTP.Group
								class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
							>
								{#each cells.slice(0, ROOM_CODE_LENGTH) as cell (cell)}
									<InputOTP.Slot {cell} class="h-12 w-12 text-base font-semibold text-slate-900" />
								{/each}
							</InputOTP.Group>
						{/snippet}
					</InputOTP.Root>

					<Button
						type="submit"
						disabled={!isValidRoomCode(roomCode) || isNavigating}
						class="inline-flex w-full items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-base font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
					>
						Join room
					</Button>
				</form>
			</div>
		</section>
	</div>
</main>
