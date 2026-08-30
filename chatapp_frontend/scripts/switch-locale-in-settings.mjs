/**
 * Change the app locale through the authenticated settings UI.
 * The workspace intentionally keeps language controls in Settings rather than
 * duplicating a global header toggle.
 */
export async function switchLocaleInSettings(page, locale = 'en') {
  const settingsButton = page.locator('button[aria-label="Cài đặt"]:visible').first();
  await settingsButton.click();

  const dialog = page.getByRole('dialog');
  await dialog.waitFor({ state: 'visible' });
  await dialog.locator('button:visible').filter({ hasText: 'Ngôn ngữ' }).first().click();
  await dialog.locator('button:visible').filter({ hasText: locale === 'en' ? 'Tiếng Anh' : 'Tiếng Việt' }).first().click();
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' });
}
