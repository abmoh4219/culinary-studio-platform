<script lang="ts">
  import { cn } from '$lib/utils';

  export let headers: string[] = [];
  export let rows: string[][] = [];
  export let className = '';
</script>

<div class={cn('overflow-hidden rounded-lg border border-border/80 bg-card/85 shadow-sm backdrop-blur', className)}>
  <div class="overflow-x-auto">
    <table class="w-full border-collapse text-sm">
      <thead class="sticky top-0 z-10 bg-muted/80 text-left text-xs uppercase tracking-wide text-muted-foreground backdrop-blur">
        <tr>
          {#each headers as header}
            <th class="px-s4 py-s3 font-medium">{header}</th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each rows as row, idx}
          <tr class={cn(idx % 2 === 0 ? 'bg-card/85' : 'bg-background/55', 'surface-transition hover:bg-muted/45')}>
            {#each row as cell}
              <td class="border-t px-s4 py-s3 text-foreground">{cell}</td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>
