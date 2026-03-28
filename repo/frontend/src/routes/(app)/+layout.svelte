<script lang="ts">
  import { page } from '$app/stores';
  import { fade, fly } from 'svelte/transition';

  import { Button } from '$lib/components/ui/button';
  import { prefersReducedMotion } from '$lib/motion';
  import { setTheme, themePreference, type ThemePreference } from '$lib/theme';

  const themeOptions: ThemePreference[] = ['light', 'dark', 'system'];

  const navigation = [
    { name: 'Overview', href: '/', badge: 'home' },
    { name: 'Member Workspace', href: '/member', badge: 'member' },
    { name: 'Front Desk', href: '/front-desk', badge: 'desk' },
    { name: 'Instructor Workspace', href: '/instructor', badge: 'coach' },
    { name: 'Admin Workspace', href: '/admin', badge: 'admin' },
    { name: 'Dashboard', href: '/dashboard', badge: 'ops' }
  ];

  let mobileNavOpen = false;
</script>

<div class="min-h-screen bg-background text-foreground">
  <div class="flex min-h-screen">
    <aside
      class="hidden w-[18rem] shrink-0 border-r bg-card px-s4 py-s6 transition-colors lg:block"
      aria-label="Primary navigation"
    >
      <div class="flex items-center gap-s3 px-s2">
        <div class="grid h-10 w-10 place-items-center rounded-lg bg-primary/15 text-sm font-semibold text-primary shadow-glow">
          CS
        </div>
        <div>
          <p class="text-sm font-medium text-foreground">Culinary Studio</p>
          <p class="text-xs text-muted-foreground">Frontend Foundation</p>
        </div>
      </div>

      <nav class="mt-s8 space-y-s2">
        {#each navigation as item}
          <a
            href={item.href}
            class="group flex items-center justify-between rounded-md px-s3 py-s2 text-sm transition-colors hover:bg-muted {($page.url.pathname === item.href)
              ? 'bg-muted text-foreground'
              : 'text-muted-foreground'}"
          >
            <span>{item.name}</span>
            <span class="rounded-full border px-s2 py-[2px] text-[10px] uppercase tracking-wide">{item.badge}</span>
          </a>
        {/each}
      </nav>
    </aside>

    <div class="flex min-h-screen min-w-0 flex-1 flex-col">
      <header class="sticky top-0 z-30 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/65">
        <div class="mx-auto flex h-16 w-full max-w-[90rem] items-center justify-between gap-s4 px-s4 md:px-s6">
          <div class="flex items-center gap-s3">
            <button
              type="button"
              class="inline-flex h-10 w-10 items-center justify-center rounded-md border bg-card text-muted-foreground transition-colors hover:text-foreground lg:hidden"
              on:click={() => (mobileNavOpen = true)}
              aria-label="Open navigation"
            >
              ☰
            </button>
            <div>
              <p class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Workspace</p>
              <h1 class="text-sm font-semibold md:text-base">Shell + Stub Surfaces</h1>
            </div>
          </div>

          <div class="flex items-center gap-s2">
            {#each themeOptions as option}
              <Button
                size="sm"
                variant={$themePreference === option ? 'default' : 'ghost'}
                className="capitalize"
                on:click={() => setTheme(option)}
              >
                {option}
              </Button>
            {/each}
            <div class="ml-s2 grid h-9 w-9 place-items-center rounded-full border bg-card text-xs font-semibold">QA</div>
          </div>
        </div>
      </header>

      <main class="mx-auto w-full max-w-[90rem] flex-1 px-s4 py-s6 md:px-s6 md:py-s8">
        <slot />
      </main>
    </div>
  </div>

  {#if mobileNavOpen}
    <div
      class="fixed inset-0 z-40 bg-black/45 lg:hidden"
      role="presentation"
      on:click={() => (mobileNavOpen = false)}
      transition:fade={{ duration: $prefersReducedMotion ? 0 : 120 }}
    ></div>
    <aside
      class="fixed inset-y-0 left-0 z-50 w-[18rem] border-r bg-card px-s4 py-s6 shadow-lg lg:hidden"
      in:fly={{ x: -24, duration: $prefersReducedMotion ? 0 : 160 }}
      out:fly={{ x: -18, duration: $prefersReducedMotion ? 0 : 120 }}
    >
      <div class="flex items-center justify-between">
        <p class="text-sm font-semibold">Navigation</p>
        <button
          type="button"
          class="inline-flex h-9 w-9 items-center justify-center rounded-md border"
          on:click={() => (mobileNavOpen = false)}
          aria-label="Close navigation"
        >
          ×
        </button>
      </div>

      <nav class="mt-s6 space-y-s2">
        {#each navigation as item}
          <a
            href={item.href}
            class="flex items-center justify-between rounded-md px-s3 py-s2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            on:click={() => (mobileNavOpen = false)}
          >
            <span>{item.name}</span>
            <span class="rounded-full border px-s2 py-[2px] text-[10px] uppercase tracking-wide">{item.badge}</span>
          </a>
        {/each}
      </nav>
    </aside>
  {/if}
</div>
