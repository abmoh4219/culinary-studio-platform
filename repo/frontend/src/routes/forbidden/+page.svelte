<script lang="ts">
  import { Card } from '$lib/components/ui/card';
</script>

<div class="flex min-h-screen items-center justify-center px-s4 py-s12">
  <Card className="w-full max-w-lg p-s8 text-center">
    <p class="text-xs uppercase tracking-[0.2em] text-muted-foreground">Access Restricted</p>
    <h1 class="mt-s3 text-3xl font-semibold tracking-tight">Forbidden</h1>
    <p class="mt-s3 text-sm text-muted-foreground">
      This route is protected by role-based guards in route-group server layouts.
    </p>

    <div class="mt-s6">
      <a
        href="/"
        class="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
      >
        Back to shell
      </a>
    </div>
  </Card>
</div>
