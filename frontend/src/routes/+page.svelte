<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
	import * as InputOTP from '$lib/components/ui/input-otp';

	const ROOM_CODE_LENGTH = 6;
	const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

	let roomCode = $state('');
	let isNavigating = $state(false);

	function isValidRoomCode(value: string) {
		return /^[A-Za-z0-9]{6}$/.test(value);
	}

	function generateRoomCode() {
		const bytes = crypto.getRandomValues(new Uint8Array(ROOM_CODE_LENGTH));

		return Array.from(bytes, (byte) => ROOM_CODE_ALPHABET[byte % ROOM_CODE_ALPHABET.length]).join(
			''
		);
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

<main class="min-h-screen bg-white text-slate-900">
	<div class="mx-auto flex min-h-screen w-full max-w-3xl items-center px-6 py-12 sm:px-8">
		<section class="w-full space-y-8">
			<header class="space-y-3">
				<h1 class="text-center text-3xl font-semibold tracking-tight sm:text-4xl">Drawr</h1>
				<p class="text-center text-base text-slate-600">
					Create a room to start drawing, or join with a 6-character code.
				</p>
			</header>

			<div class="sm:p-8">
				<div class="space-y-4">
					<Button
						type="button"
						onclick={createRoom}
						disabled={isNavigating}
						class="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-base font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
					>
						Create room
					</Button>

					<p class="text-center text-3xl tracking-tight text-slate-600">OR</p>

					<form
						class="space-y-3"
						onsubmit={(e) => {
							e.preventDefault();
							navigateToRoom(roomCode);
						}}
					>
						<InputOTP.Root
							maxlength={ROOM_CODE_LENGTH}
							minlength={ROOM_CODE_LENGTH}
							pattern="[A-Za-z0-9]+"
							class="flex justify-center uppercase"
							bind:value={roomCode}
						>
							{#snippet children({ cells })}
								<InputOTP.Group>
									{#each cells.slice(0, ROOM_CODE_LENGTH) as cell (cell)}
										<InputOTP.Slot {cell} />
									{/each}
								</InputOTP.Group>
							{/snippet}
						</InputOTP.Root>

						<Button
							type="submit"
							disabled={!isValidRoomCode(roomCode) || isNavigating}
							class="inline-flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-base font-semibold text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
						>
							Join room
						</Button>
					</form>
				</div>
			</div>
		</section>
	</div>
</main>
