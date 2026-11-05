/** Every character the canvas draws with the comic font (web fonts load per character range). */
export const CANVAS_TEXT = '0123456789.m たかさつぎボフッ';

/**
 * Resolves once the comic font is ready for the canvas, or after `timeoutMs` (then the
 * fallback font is used). Canvas text drawn before the font loads would not be redrawn.
 */
export async function waitForFont(family: string, timeoutMs = 3000): Promise<void> {
  if (!('fonts' in document)) return;
  const load = document.fonts.load(`32px "${family}"`, CANVAS_TEXT).then(() => document.fonts.ready);
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, timeoutMs));
  await Promise.race([load.then(() => undefined, () => undefined), timeout]);
}
