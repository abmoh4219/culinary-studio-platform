<script lang="ts">
  import { goto } from '$app/navigation';
  import { env } from '$env/dynamic/public';
  import { toast } from 'svelte-sonner';

  import { Button } from '$lib/components/ui/button';
  import { Card } from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';

  type FormState = 'idle' | 'loading' | 'success' | 'error';

  let username = '';
  let password = '';
  let state: FormState = 'idle';
  let formError = '';
  let fieldErrors: { username?: string; password?: string } = {};

  function validate(): boolean {
    const nextErrors: { username?: string; password?: string } = {};

    if (username.trim().length < 3) {
      nextErrors.username = 'Username must be at least 3 characters.';
    }

    if (password.length < 12) {
      nextErrors.password = 'Password must be at least 12 characters.';
    }

    fieldErrors = nextErrors;
    return Object.keys(nextErrors).length === 0;
  }

  async function submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    formError = '';

    if (!validate()) {
      state = 'error';
      return;
    }

    state = 'loading';
    const apiBaseUrl = env.PUBLIC_API_BASE_URL || 'http://localhost:4000/api/v1';

    try {
      const response = await fetch(`${apiBaseUrl}/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        formError = payload.message ?? 'Unable to authenticate with provided credentials.';
        state = 'error';
        toast.error('Sign in failed', { description: formError });
        return;
      }

      state = 'success';
      toast.success('Welcome back', { description: 'Session established successfully.' });
      await goto('/');
    } catch (_error) {
      formError = 'Network error while attempting sign in.';
      state = 'error';
      toast.error('Sign in failed', { description: formError });
    }
  }
</script>

<div class="flex min-h-screen items-center justify-center px-s4 py-s12">
  <Card className="w-full max-w-md p-s8">
    <p class="text-xs uppercase tracking-[0.2em] text-muted-foreground">Authentication Stub</p>
    <h1 class="mt-s2 text-2xl font-semibold tracking-tight">Sign in to shell</h1>
    <p class="mt-s2 text-sm text-muted-foreground">Use seeded QA credentials from README to test guarded routes.</p>

    <form class="mt-s6 space-y-s4" on:submit={submit} novalidate>
      <div class="space-y-s2">
        <Label for="username">Username</Label>
        <Input
          id="username"
          name="username"
          autocomplete="username"
          bind:value={username}
          aria-invalid={fieldErrors.username ? 'true' : 'false'}
          aria-describedby={fieldErrors.username ? 'username-error' : undefined}
        />
        {#if fieldErrors.username}
          <p id="username-error" class="text-xs text-red-600 dark:text-red-400">{fieldErrors.username}</p>
        {/if}
      </div>

      <div class="space-y-s2">
        <Label for="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autocomplete="current-password"
          bind:value={password}
          aria-invalid={fieldErrors.password ? 'true' : 'false'}
          aria-describedby={fieldErrors.password ? 'password-error' : undefined}
        />
        {#if fieldErrors.password}
          <p id="password-error" class="text-xs text-red-600 dark:text-red-400">{fieldErrors.password}</p>
        {/if}
      </div>

      {#if formError}
        <div class="rounded-md border border-red-300/60 bg-red-50 px-s3 py-s2 text-sm text-red-700 dark:border-red-700/40 dark:bg-red-950/40 dark:text-red-300">
          {formError}
        </div>
      {/if}

      <Button className="w-full" type="submit" disabled={state === 'loading'}>
        {#if state === 'loading'}
          Signing in...
        {:else if state === 'success'}
          Success
        {:else}
          Sign in
        {/if}
      </Button>

      <p class="text-xs text-muted-foreground">
        State: <span class="font-medium text-foreground">{state}</span>
      </p>
    </form>
  </Card>
</div>
