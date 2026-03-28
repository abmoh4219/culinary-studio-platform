<script lang="ts">
  import { cva, type VariantProps } from 'class-variance-authority';

  import { cn } from '$lib/utils';

  const buttonVariants = cva(
    'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none',
    {
      variants: {
        variant: {
          default: 'bg-primary text-primary-foreground shadow-sm hover:opacity-90',
          secondary: 'bg-muted text-foreground hover:bg-muted/80',
          ghost: 'text-foreground hover:bg-muted'
        },
        size: {
          sm: 'h-9 px-3',
          md: 'h-10 px-4',
          lg: 'h-11 px-6'
        }
      },
      defaultVariants: {
        variant: 'default',
        size: 'md'
      }
    }
  );

  type Variant = VariantProps<typeof buttonVariants>['variant'];
  type Size = VariantProps<typeof buttonVariants>['size'];

  export let type: 'button' | 'submit' | 'reset' = 'button';
  export let variant: Variant = 'default';
  export let size: Size = 'md';
  export let className = '';
</script>

<button type={type} class={cn(buttonVariants({ variant, size }), className)} {...$$restProps}>
  <slot />
</button>
