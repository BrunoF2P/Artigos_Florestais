<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { Upload, X, FileText, CheckCircle2, AlertCircle } from 'lucide-svelte';
  import Button from '$lib/components/Button.svelte';

  export let isOpen = false;
  export let files: File[] = [];
  export let isImporting = false;
  export let progress = 0;
  export let progressLabel = 'Importando...';
  export let statusMessage = '';
  export let statusTone: 'default' | 'success' | 'error' = 'default';

  const dispatch = createEventDispatcher<{ filesSelected: File[]; close: void }>();
  let fileInput: HTMLInputElement;
  let isDragging = false;

  function openFilePicker() {
    fileInput?.click();
  }

  function emitSelectedFiles(nextFiles: File[]) {
    dispatch('filesSelected', nextFiles);
  }

  function handleInputChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const nextFiles = Array.from(input.files ?? []);
    if (nextFiles.length) emitSelectedFiles(nextFiles);
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    isDragging = true;
  }

  function handleDragLeave() {
    isDragging = false;
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    isDragging = false;
    const nextFiles = Array.from(event.dataTransfer?.files ?? []).filter((f) => f.name.toLowerCase().endsWith('.csv'));
    if (nextFiles.length) emitSelectedFiles(nextFiles);
  }
</script>

{#if isOpen}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-backdrop" onclick={() => dispatch('close')} onkeydown={(e) => e.key === 'Escape' && dispatch('close')}>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="upload-dialog" onclick={(e) => e.stopPropagation()}>
      <div class="upload-header">
        <div>
          <p>Importação</p>
          <h3>Importar CSV do Scopus</h3>
        </div>
        <Button variant="ghost" size="md" class="panel-close" aria-label="Fechar" on:click={() => dispatch('close')}>
          <X size={18} />
        </Button>
      </div>

      <div class="upload-body">
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          role="button"
          tabindex="0"
          class="drop-zone {isDragging ? 'dragging' : ''}"
          ondragover={handleDragOver}
          ondragleave={handleDragLeave}
          ondrop={handleDrop}
          onclick={openFilePicker}
          onkeydown={(e) => e.key === 'Enter' && openFilePicker()}
        >
          <div><Upload size={22} /></div>
          <strong>Solte arquivos CSV aqui</strong>
          <span>ou clique para selecionar arquivos exportados do Scopus</span>
          <input bind:this={fileInput} class="hidden" type="file" accept=".csv" multiple onchange={handleInputChange} />
        </div>

        {#if files.length}
          <div class="file-stack">
            {#each files as file}
              <span>
                <FileText size={14} />
                {file.name}
              </span>
            {/each}
          </div>
        {/if}

        {#if isImporting}
          <div class="progress-block">
            <div>
              <span>{progressLabel}</span>
              <strong>{progress}%</strong>
            </div>
            <div class="progress-track"><span style="width: {progress}%"></span></div>
          </div>
        {/if}

        {#if statusMessage}
          <div class="import-status {statusTone}">
            {#if statusTone === 'success'}<CheckCircle2 size={17} />{:else if statusTone === 'error'}<AlertCircle size={17} />{:else}<FileText size={17} />{/if}
            <span>{statusMessage}</span>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}
