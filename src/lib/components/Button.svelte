<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  export let variant: 'primary' | 'secondary' | 'ghost' = 'primary';
  export let size: 'sm' | 'md' = 'md';
  export let type: 'button' | 'submit' | 'reset' = 'button';
  export let ariaCurrent: boolean | undefined = undefined;
  const dispatch = createEventDispatcher();

  function handleClick(e: MouseEvent) {
    dispatch('click', e);
  }

  $: variantClass = variant === 'primary' ? 'btn-accent' : variant === 'ghost' ? 'btn-ghost' : 'btn-ghost';
  $: sizeClass = size === 'sm' ? 'btn-sm' : '';
</script>

<button
  type={type}
  on:click={handleClick}
  aria-current={ariaCurrent ? 'true' : undefined}
  {...$$restProps}
  class={"btn " + variantClass + " " + sizeClass + " " + ($$restProps.class ?? '')}
>
  <slot />
</button>
