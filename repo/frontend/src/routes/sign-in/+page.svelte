<script lang="ts">
  import { enhance } from '$app/forms';
  import { toast } from 'svelte-sonner';

  import { Button } from '$lib/components/ui/button';
  import { Card } from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';

  import type { ActionData } from './$types';

  export let form: ActionData;

  let state: 'idle' | 'loading' = 'idle';
  let fieldErrors: { username?: string; password?: string } = {};

  $: if (form?.error) {
    toast.error('Sign in failed', { description: form.error });
  }
</script>

<div class="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
  <div class="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_18%_20%,rgba(14,165,233,0.22),transparent_42%),radial-gradient(circle_at_78%_74%,rgba(251,191,36,0.14),transparent_40%),linear-gradient(180deg,#020617_0%,#0b1120_55%,#111827_100%)]"></div>

  <div class="mx-auto grid min-h-screen w-full max-w-[1200px] grid-cols-1 px-s4 py-s8 md:px-s8 lg:grid-cols-2 lg:gap-s8 lg:px-s10 lg:py-s10">
    <section class="flex items-center py-s8 lg:py-s0">
      <div class="max-w-xl space-y-s6">
        <p class="text-xs font-medium uppercase tracking-[0.26em] text-cyan-300/90">Culinary Studio Platform</p>
        <h1 class="text-4xl font-semibold leading-tight tracking-tight text-white md:text-5xl">
          Elevate every class into a premium member experience.
        </h1>
        <p class="max-w-lg text-base leading-7 text-slate-300">
          Secure access to member, instructor, front-desk, and operations workspaces in one unified studio platform.
        </p>
      </div>
    </section>

    <section class="flex items-center justify-center py-s4 lg:justify-end lg:py-s0">
      <Card className="w-full max-w-md rounded-xl border border-white/15 bg-slate-900/80 p-s8 shadow-[0_24px_70px_-24px_rgba(14,165,233,0.45)] backdrop-blur md:p-s10">
        <div class="relative">
          <div class="absolute right-0 top-0 inline-flex h-9 w-9 items-center justify-center rounded-full border border-cyan-300/35 bg-cyan-300/10 text-cyan-200">
            🔒
          </div>
          <p class="text-xs uppercase tracking-[0.18em] text-slate-400">Workspace Access</p>
          <h2 class="mt-s2 text-3xl font-semibold tracking-tight text-white">Sign in</h2>
          <p class="mt-s2 pr-s10 text-sm leading-6 text-slate-300">
            Continue with your work credentials to access your assigned studio workspace.
          </p>
        </div>

        <form
          class="mt-s8 space-y-s5"
          method="POST"
          use:enhance={() => {
            state = 'loading';
            fieldErrors = {};
            return async ({ update }) => {
              state = 'idle';
              await update();
            };
          }}
          novalidate
        >
          <div class="space-y-s2">
            <Label for="username" className="text-slate-200">Email</Label>
            <Input
              id="username"
              name="username"
              autocomplete="username"
              placeholder="name@company.local"
              value={form?.username ?? ''}
              aria-invalid={fieldErrors.username ? 'true' : 'false'}
              aria-describedby={fieldErrors.username ? 'username-error' : 'username-help'}
              className="h-11 border-white/15 bg-slate-950/60 text-slate-100 placeholder:text-slate-500 focus-visible:ring-cyan-300/60"
            />
            <p id="username-help" class="text-xs text-slate-400">
              Login API uses the `username` field; QA credentials are email-shaped usernames.
            </p>
            {#if fieldErrors.username}
              <p id="username-error" class="text-xs text-red-300">{fieldErrors.username}</p>
            {/if}
          </div>

          <div class="space-y-s2">
            <Label for="password" className="text-slate-200">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autocomplete="current-password"
              placeholder="Enter your password"
              aria-invalid={fieldErrors.password ? 'true' : 'false'}
              aria-describedby={fieldErrors.password ? 'password-error' : undefined}
              className="h-11 border-white/15 bg-slate-950/60 text-slate-100 placeholder:text-slate-500 focus-visible:ring-cyan-300/60"
            />
            {#if fieldErrors.password}
              <p id="password-error" class="text-xs text-red-300">{fieldErrors.password}</p>
            {/if}
          </div>

          {#if form?.error}
            <div class="rounded-md border border-red-300/40 bg-red-500/10 px-s3 py-s2 text-sm text-red-200">
              {form.error}
            </div>
          {/if}

          <Button
            className="h-12 w-full bg-cyan-300 text-slate-950 shadow-sm transition-all hover:bg-cyan-200"
            type="submit"
            disabled={state === 'loading'}
          >
            {#if state === 'loading'}
              Signing in...
            {:else}
              Continue to workspace →
            {/if}
          </Button>
        </form>
      </Card>
    </section>
  </div>
</div>
