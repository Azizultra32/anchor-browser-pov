/**
 * UI Mode Management for Ghost Overlay
 * Phase 3: Clinician vs Debug UI checkpoint
 */

export type UIMode = 'clinician' | 'debug';

export interface UIModeConfig {
  mode: UIMode;
  showTechnicalDetails: boolean;
  showSelectors: boolean;
  showMetadata: boolean;
  simplifiedControls: boolean;
}

const DEFAULT_CLINICIAN_CONFIG: UIModeConfig = {
  mode: 'clinician',
  showTechnicalDetails: false,
  showSelectors: false,
  showMetadata: false,
  simplifiedControls: true
};

const DEFAULT_DEBUG_CONFIG: UIModeConfig = {
  mode: 'debug',
  showTechnicalDetails: true,
  showSelectors: true,
  showMetadata: true,
  simplifiedControls: false
};

export class UIModeManager {
  private currentConfig: UIModeConfig;

  constructor(initialMode: UIMode = 'clinician') {
    this.currentConfig = initialMode === 'clinician' 
      ? { ...DEFAULT_CLINICIAN_CONFIG }
      : { ...DEFAULT_DEBUG_CONFIG };
  }

  getMode(): UIMode {
    return this.currentConfig.mode;
  }

  setMode(mode: UIMode): void {
    this.currentConfig = mode === 'clinician'
      ? { ...DEFAULT_CLINICIAN_CONFIG }
      : { ...DEFAULT_DEBUG_CONFIG };
    this.notifyModeChange();
  }

  getConfig(): UIModeConfig {
    return { ...this.currentConfig };
  }

  toggleMode(): UIMode {
    const newMode = this.currentConfig.mode === 'clinician' ? 'debug' : 'clinician';
    this.setMode(newMode);
    return newMode;
  }

  private notifyModeChange(): void {
    // Dispatch custom event for UI components to listen to
    window.dispatchEvent(new CustomEvent('__GHOST_UI_MODE_CHANGE__', {
      detail: this.currentConfig
    }));
  }
}

// Singleton instance
export const uiModeManager = new UIModeManager();