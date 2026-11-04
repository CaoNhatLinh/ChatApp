/** Keep the exact command for an uncertain retry, without changing the draft. */
export class StickerCommandAttempt {
  private current?: { fingerprint: string; commandId: string };

  prepare<T extends object>(target: string, draft: T): T & { commandId: string } {
    const fingerprint = JSON.stringify([target, draft]);
    if (this.current?.fingerprint !== fingerprint) {
      this.current = { fingerprint, commandId: crypto.randomUUID() };
    }
    return { ...draft, commandId: this.current.commandId };
  }

  complete(commandId: string): void {
    if (this.current?.commandId === commandId) this.current = undefined;
  }
}
