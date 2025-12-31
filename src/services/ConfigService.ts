// ConfigService - Handles saving and loading DJ application configurations

import { DJState } from '@/contexts/DJContext';

export interface AppConfig {
  version: string;
  audioConfig: DJState['audioConfig'];
  keyMappings: DJState['keyMappings'];
  analogMappings: DJState['analogMappings'];
  timestamp: string;
}

const CONFIG_FILENAME = 'dj-config.json';
const APP_NAME = 'Martins-DJ-Software';

// Get the documents folder path
async function getDocumentsPath(): Promise<string | null> {
  if (typeof window !== 'undefined' && window.electronAPI?.path) {
    try {
      const result = await window.electronAPI.path.getDocumentsPath();
      if (result.success && result.path) {
        return result.path;
      }
    } catch (error) {
      console.error('Failed to get documents path:', error);
    }
  }
  // Fallback for browser environment
  return null;
}

// Get the full config file path
async function getConfigFilePath(): Promise<string | null> {
  const documentsPath = await getDocumentsPath();
  if (!documentsPath) return null;
  
  // Create app folder in documents
  const appFolder = `${documentsPath}/${APP_NAME}`;
  return `${appFolder}/${CONFIG_FILENAME}`;
}

export class ConfigService {
  private static instance: ConfigService;

  private constructor() {}

  static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  // Export configuration to JSON file
  async exportConfig(state: Partial<DJState>): Promise<{ success: boolean; path?: string; error?: string }> {
    try {
      const configFilePath = await getConfigFilePath();
      if (!configFilePath) {
        return { success: false, error: 'Could not determine documents folder path' };
      }

      // Prepare config object
      const config: AppConfig = {
        version: '1.0.0',
        audioConfig: state.audioConfig || {
          masterOutput: 'default',
          headphoneOutput: 'default',
          latency: 128,
          sampleRate: 44100,
          inputChannels: 'default',
        },
        keyMappings: state.keyMappings || {},
        analogMappings: state.analogMappings || {},
        timestamp: new Date().toISOString(),
      };

      // Convert to JSON string
      const jsonString = JSON.stringify(config, null, 2);
      const encoder = new TextEncoder();
      const data = encoder.encode(jsonString);

      // Save to file using Electron API
      if (window.electronAPI?.fs) {
        const result = await window.electronAPI.fs.writeFile(configFilePath, data.buffer);
        if (result.success) {
          console.log(`✅ Config saved to: ${configFilePath}`);
          return { success: true, path: configFilePath };
        } else {
          return { success: false, error: result.error || 'Failed to write config file' };
        }
      } else {
        // Fallback: download as file in browser
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = CONFIG_FILENAME;
        a.click();
        URL.revokeObjectURL(url);
        return { success: true, path: 'Downloaded to browser downloads' };
      }
    } catch (error) {
      console.error('Failed to export config:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // Import configuration from JSON file
  async importConfig(): Promise<{ success: boolean; config?: AppConfig; error?: string }> {
    try {
      const configFilePath = await getConfigFilePath();
      if (!configFilePath) {
        return { success: false, error: 'Could not determine documents folder path' };
      }

      // Check if file exists
      if (window.electronAPI?.fs) {
        const existsResult = await window.electronAPI.fs.exists(configFilePath);
        if (!existsResult.exists) {
          return { success: false, error: 'Config file does not exist' };
        }

        // Read file
        const readResult = await window.electronAPI.fs.readFile(configFilePath);
        if (!readResult.success || !readResult.data) {
          return { success: false, error: readResult.error || 'Failed to read config file' };
        }

        // Convert array to string
        const decoder = new TextDecoder();
        const jsonString = decoder.decode(new Uint8Array(readResult.data));
        const config: AppConfig = JSON.parse(jsonString);

        console.log(`✅ Config loaded from: ${configFilePath}`);
        return { success: true, config };
      } else {
        return { success: false, error: 'Electron API not available' };
      }
    } catch (error) {
      console.error('Failed to import config:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  // Load config on app startup
  async loadConfigOnStartup(): Promise<Partial<DJState> | null> {
    try {
      const result = await this.importConfig();
      if (result.success && result.config) {
        return {
          audioConfig: result.config.audioConfig,
          keyMappings: result.config.keyMappings,
          analogMappings: result.config.analogMappings || {},
        };
      }
    } catch (error) {
      console.warn('Failed to load config on startup:', error);
    }
    return null;
  }
}

