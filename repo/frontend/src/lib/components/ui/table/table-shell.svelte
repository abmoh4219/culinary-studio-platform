<script lang="ts">
  import { cn } from '$lib/utils';

  export let headers: string[] = [];
  export let rows: string[][] = [];
  export let className = '';
</script>

<div class={cn('overflow-hidden rounded-lg border bg-card', className)}>
  <div class="overflow-x-auto">
    <table class="w-full border-collapse text-sm">
      <thead class="bg-muted/65 text-left text-xs uppercase tracking-wide text-muted-foreground">
        <tr>
          {#each headers as header}
            <th class="px-s4 py-s3 font-medium">{header}</th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each rows as row, idx}
          <tr class={idx % 2 === 0 ? 'bg-card' : 'bg-background/50'}>
            {#each row as cell}
              <td class="border-t px-s4 py-s3 text-foreground">{cell}</td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>
