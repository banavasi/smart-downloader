<template>
  <div class="options-container">
    <header class="options-header">
      <div class="header-content">
        <div class="logo">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M7 10L12 15L17 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M12 15V3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <h1>Smart Media Downloader Settings</h1>
        </div>
        <p class="subtitle">Configure custom DOM selectors for different websites</p>
      </div>
    </header>

    <main class="options-main">
      <!-- Preset Configurations -->
      <section class="config-section">
        <h2>Preset Configurations</h2>
        <p class="section-description">Quick setup for popular websites</p>
        <div class="presets-grid">
          <div
            v-for="preset in presets"
            :key="preset.id"
            class="preset-card"
            :class="{ active: isPresetActive(preset.id) }"
          >
            <div class="preset-header">
              <h3>{{ preset.name }}</h3>
              <button
                @click="applyPreset(preset)"
                class="btn btn-sm"
                :class="isPresetActive(preset.id) ? 'btn-success' : 'btn-primary'"
              >
                {{ isPresetActive(preset.id) ? 'Active' : 'Apply' }}
              </button>
            </div>
            <p class="preset-description">{{ preset.description }}</p>
            <div class="preset-selectors">
              <span class="badge" v-for="selector in preset.selectors" :key="selector">
                {{ selector }}
              </span>
            </div>
          </div>
        </div>
      </section>

      <!-- Custom Selectors -->
      <section class="config-section">
        <div class="section-header">
          <h2>Custom DOM Selectors</h2>
          <button @click="addCustomSelector" class="btn btn-primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Add Selector
          </button>
        </div>
        <p class="section-description">
          Add custom CSS selectors to detect media on specific websites.
          The extension will watch these selectors for new images/videos.
        </p>

        <div v-if="customSelectors.length === 0" class="empty-state">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" opacity="0.3">
            <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2"/>
            <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/>
            <path d="M21 15L16 10L5 21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <p>No custom selectors added yet</p>
          <p class="hint">Click "Add Selector" to create a custom configuration</p>
        </div>

        <div v-else class="selectors-list">
          <div
            v-for="(selector, index) in customSelectors"
            :key="index"
            class="selector-card"
          >
            <div class="selector-header">
              <div class="selector-info">
                <input
                  v-model="selector.name"
                  @blur="saveSelectors"
                  placeholder="Configuration name (e.g., 'OnlyFans Gallery')"
                  class="selector-name-input"
                />
                <span class="selector-count">{{ selector.selectors.length }} selector(s)</span>
              </div>
              <button
                @click="removeSelector(index)"
                class="btn btn-danger btn-sm"
                title="Remove"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
              </button>
            </div>

            <div class="selector-list">
              <div
                v-for="(sel, selIndex) in selector.selectors"
                :key="selIndex"
                class="selector-item"
              >
                <input
                  v-model="selector.selectors[selIndex]"
                  @blur="saveSelectors"
                  placeholder="CSS selector (e.g., '.gallery img')"
                  class="selector-input"
                />
                <button
                  @click="removeSelectorItem(index, selIndex)"
                  class="btn-icon"
                  title="Remove selector"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                </button>
              </div>
              <button
                @click="addSelectorToConfig(index)"
                class="btn btn-secondary btn-sm"
              >
                + Add Selector
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- Advanced Settings -->
      <section class="config-section">
        <h2>Advanced Settings</h2>
        <div class="settings-grid">
          <div class="setting-item">
            <label>
              <input
                type="checkbox"
                v-model="settings.autoSelectOnSwipe"
                @change="saveSettings"
              />
              <span>Auto-select on swipe (PhotoSwipe galleries)</span>
            </label>
            <p class="setting-hint">Automatically select images when swiping through galleries</p>
          </div>
          <div class="setting-item">
            <label>
              <input
                type="checkbox"
                v-model="settings.watchDOMChanges"
                @change="saveSettings"
              />
              <span>Watch for DOM changes</span>
            </label>
            <p class="setting-hint">Automatically detect new media added to the page</p>
          </div>
          <div class="setting-item">
            <label>
              Minimum Image Width (px)
              <input
                type="number"
                v-model.number="settings.minWidth"
                @change="saveSettings"
                min="100"
                max="5000"
                class="number-input"
              />
            </label>
            <p class="setting-hint">Only detect images larger than this width</p>
          </div>
          <div class="setting-item">
            <label>
              Minimum Image Height (px)
              <input
                type="number"
                v-model.number="settings.minHeight"
                @change="saveSettings"
                min="100"
                max="5000"
                class="number-input"
              />
            </label>
            <p class="setting-hint">Only detect images larger than this height</p>
          </div>
        </div>
      </section>

      <!-- Actions -->
      <section class="config-section">
        <div class="actions-bar">
          <button @click="resetToDefaults" class="btn btn-secondary">
            Reset to Defaults
          </button>
          <button @click="exportConfig" class="btn btn-secondary">
            Export Configuration
          </button>
          <button @click="importConfig" class="btn btn-secondary">
            Import Configuration
          </button>
          <input
            ref="importFileInput"
            type="file"
            accept=".json"
            @change="handleImportFile"
            style="display: none"
          />
        </div>
      </section>
    </main>

    <footer class="options-footer">
      <p>Smart Media Downloader v1.0.0</p>
    </footer>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

// State
const customSelectors = ref([]);
const settings = ref({
  autoSelectOnSwipe: true,
  watchDOMChanges: true,
  minWidth: 1000,
  minHeight: 1000
});
const importFileInput = ref(null);

// Preset configurations
const presets = ref([
  {
    id: 'photoswipe',
    name: 'PhotoSwipe',
    description: 'For websites using PhotoSwipe lightbox gallery',
    selectors: ['.pswp__item img', '.pswp__img img']
  },
  {
    id: 'default',
    name: 'Default',
    description: 'Standard image and video detection',
    selectors: ['img', 'video']
  }
]);

// Load configuration from storage
async function loadConfig() {
  try {
    const result = await chrome.storage.sync.get(['customSelectors', 'settings']);
    if (result.customSelectors) {
      customSelectors.value = result.customSelectors;
    }
    if (result.settings) {
      settings.value = { ...settings.value, ...result.settings };
    }
  } catch (error) {
    console.error('Failed to load config:', error);
  }
}

// Save configuration to storage
async function saveSelectors() {
  try {
    await chrome.storage.sync.set({ customSelectors: customSelectors.value });
    console.log('Selectors saved');
  } catch (error) {
    console.error('Failed to save selectors:', error);
  }
}

async function saveSettings() {
  try {
    await chrome.storage.sync.set({ settings: settings.value });
    // Also update content script config
    chrome.runtime.sendMessage({
      action: 'updateConfig',
      settings: settings.value
    }).catch(() => {});
    console.log('Settings saved');
  } catch (error) {
    console.error('Failed to save settings:', error);
  }
}

// Add new custom selector configuration
function addCustomSelector() {
  customSelectors.value.push({
    name: '',
    selectors: ['']
  });
}

// Add selector to existing configuration
function addSelectorToConfig(index) {
  customSelectors.value[index].selectors.push('');
}

// Remove selector configuration
function removeSelector(index) {
  customSelectors.value.splice(index, 1);
  saveSelectors();
}

// Remove individual selector from configuration
function removeSelectorItem(configIndex, selectorIndex) {
  customSelectors.value[configIndex].selectors.splice(selectorIndex, 1);
  if (customSelectors.value[configIndex].selectors.length === 0) {
    removeSelector(configIndex);
  } else {
    saveSelectors();
  }
}

// Apply preset
function applyPreset(preset) {
  // Check if preset already exists
  const existingIndex = customSelectors.value.findIndex(s => s.id === preset.id);

  if (existingIndex >= 0) {
    // Update existing
    customSelectors.value[existingIndex].name = preset.name;
    customSelectors.value[existingIndex].selectors = [...preset.selectors];
  } else {
    // Add new
    customSelectors.value.push({
      id: preset.id,
      name: preset.name,
      selectors: [...preset.selectors]
    });
  }

  saveSelectors();
}

// Check if preset is active
function isPresetActive(presetId) {
  return customSelectors.value.some(s => s.id === presetId);
}

// Reset to defaults
function resetToDefaults() {
  if (confirm('Are you sure you want to reset all settings to defaults? This cannot be undone.')) {
    customSelectors.value = [];
    settings.value = {
      autoSelectOnSwipe: true,
      watchDOMChanges: true,
      minWidth: 1000,
      minHeight: 1000
    };
    saveSelectors();
    saveSettings();
  }
}

// Export configuration
function exportConfig() {
  const config = {
    customSelectors: customSelectors.value,
    settings: settings.value,
    version: '1.0.0',
    exportDate: new Date().toISOString()
  };

  const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `smart-downloader-config-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// Import configuration
function importConfig() {
  importFileInput.value?.click();
}

// Handle imported file
function handleImportFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const config = JSON.parse(e.target.result);
      if (config.customSelectors) {
        customSelectors.value = config.customSelectors;
      }
      if (config.settings) {
        settings.value = { ...settings.value, ...config.settings };
      }
      saveSelectors();
      saveSettings();
      alert('Configuration imported successfully!');
    } catch (error) {
      alert('Failed to import configuration. Invalid file format.');
      console.error('Import error:', error);
    }
  };
  reader.readAsText(file);

  // Reset input
  event.target.value = '';
}

onMounted(() => {
  loadConfig();
});
</script>

<style scoped>
/* Styles are imported from options.css */
</style>
