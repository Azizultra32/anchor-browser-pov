import CDP from 'chrome-remote-interface';

export interface ChromeBridgeOptions {
  port?: number;
  host?: string;
  extensionCheckInterval?: number;
}

export class ChromeBridge {
  private client: any = null;
  private port: number;
  private host: string;
  private extensionCheckInterval: number;
  private connected: boolean = false;

  constructor(options: ChromeBridgeOptions = {}) {
    this.port = options.port || 9222;
    this.host = options.host || 'localhost';
    this.extensionCheckInterval = options.extensionCheckInterval || 1000;
  }

  async connect() {
    try {
      this.client = await CDP({ port: this.port, host: this.host });
      this.connected = true;

      // Enable required domains
      await this.client.Runtime.enable();
      await this.client.Page.enable();

      console.error(`[Chrome Bridge] Connected to Chrome DevTools on ${this.host}:${this.port}`);
    } catch (error) {
      throw new Error(`Failed to connect to Chrome: ${error instanceof Error ? error.message : error}`);
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.close();
      this.connected = false;
      console.error('[Chrome Bridge] Disconnected from Chrome');
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  async waitForExtension(timeout: number = 10000): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const hasExtension = await this.checkExtensionPresence();
      if (hasExtension) {
        return true;
      }
      await this.sleep(this.extensionCheckInterval);
    }

    return false;
  }

  private async checkExtensionPresence(): Promise<boolean> {
    try {
      // Check if window.__ANCHOR_GHOST__ exists
      const { result } = await this.client.Runtime.evaluate({
        expression: 'typeof window.__ANCHOR_GHOST__ !== "undefined"',
        returnByValue: true,
      });

      return result.value === true;
    } catch {
      return false;
    }
  }

  async dispatchExtensionEvent(action: string, payload: any = {}): Promise<any> {
    if (!this.connected) {
      throw new Error('Not connected to Chrome');
    }

    // Dispatch custom event to content script
    const script = `
      (function() {
        const event = new CustomEvent('ANCHOR_BRIDGE_EVENT', {
          detail: {
            action: ${JSON.stringify(action)},
            payload: ${JSON.stringify(payload)}
          }
        });
        window.dispatchEvent(event);

        // Return a promise that resolves when response event fires
        return new Promise((resolve) => {
          const responseHandler = (e) => {
            if (e.detail.action === ${JSON.stringify(action + '_RESPONSE')}) {
              window.removeEventListener('ANCHOR_BRIDGE_RESPONSE', responseHandler);
              resolve(e.detail.data);
            }
          };
          window.addEventListener('ANCHOR_BRIDGE_RESPONSE', responseHandler);

          // Timeout after 30s
          setTimeout(() => {
            window.removeEventListener('ANCHOR_BRIDGE_RESPONSE', responseHandler);
            resolve({ error: 'Timeout waiting for extension response' });
          }, 30000);
        });
      })();
    `;

    try {
      const { result } = await this.client.Runtime.evaluate({
        expression: script,
        awaitPromise: true,
        returnByValue: true,
      });

      if (result.value?.error) {
        throw new Error(result.value.error);
      }

      return result.value;
    } catch (error) {
      throw new Error(`Extension event dispatch failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  async navigateTo(url: string): Promise<void> {
    if (!this.connected) {
      throw new Error('Not connected to Chrome');
    }

    await this.client.Page.navigate({ url });

    // Wait for page load
    await this.client.Page.loadEventFired();
  }

  async getCurrentURL(): Promise<string> {
    const { result } = await this.client.Runtime.evaluate({
      expression: 'window.location.href',
      returnByValue: true,
    });

    return result.value;
  }

  async getPageTitle(): Promise<string> {
    const { result } = await this.client.Runtime.evaluate({
      expression: 'document.title',
      returnByValue: true,
    });

    return result.value;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
