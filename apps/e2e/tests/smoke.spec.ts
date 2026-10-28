import { expect, test } from '@playwright/test';
import { PASSWORD } from '../e2e-env.ts';

/**
 * The main path through the real app, API and database: log in, add an event with
 * QuickAdd, see it in every view, edit it, find it with Search, delete it and undo.
 */
test('plan, find, edit and undo a delete', async ({ page }) => {
  await test.step('log in', async () => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page.getByRole('textbox', { name: 'Quick add' })).toBeVisible();
  });

  const card = (title: string) =>
    page.getByRole('main').getByRole('button', { name: new RegExp(`^${title}`) });

  await test.step('add with QuickAdd and open that day', async () => {
    const quickAdd = page.getByRole('textbox', { name: 'Quick add' });
    await quickAdd.fill('Dentist tomorrow 4pm #red');
    await expect(page.getByText('Dentist').first()).toBeVisible();
    await quickAdd.press('Enter');
    await expect(page.getByText(/^Event added for /)).toBeVisible();
    await page.getByRole('button', { name: 'Show' }).click();
    await expect(page).toHaveURL(/\/day\/\d{4}-\d{2}-\d{2}$/);
    await expect(card('Dentist')).toBeVisible();
  });

  await test.step('switch between Day, Week and Month', async () => {
    // Leave QuickAdd so single-key shortcuts reach the page.
    await page.getByRole('heading', { level: 1 }).click();
    await page.keyboard.press('w');
    await expect(page).toHaveURL(/\/week\/\d{4}-\d{2}-\d{2}$/);
    await expect(card('Dentist')).toBeVisible();
    await page.keyboard.press('m');
    await expect(page).toHaveURL(/\/month/);
    await expect(card('Dentist')).toBeVisible();
    // From this month, D opens today; the dentist is tomorrow.
    await page.keyboard.press('d');
    await expect(page).toHaveURL(/\/$/);
    await page.getByRole('button', { name: 'Next day' }).click();
    await expect(card('Dentist')).toBeVisible();
  });

  await test.step('edit it in the editor', async () => {
    await card('Dentist').click();
    await page
      .getByRole('dialog', { name: 'Dentist' })
      .getByRole('button', { name: 'Edit' })
      .click();
    const editor = page.getByRole('dialog', { name: 'Edit event' });
    await editor.getByLabel('Title').fill('Dentist check-up');
    await editor.getByLabel('Location').fill('Smile Clinic');
    await editor.getByRole('radio', { name: 'Teal' }).check();
    await editor.getByRole('button', { name: 'Save' }).click();
    await expect(editor).toBeHidden();
    await expect(card('Dentist check-up')).toBeVisible();
  });

  await test.step('find it with Search', async () => {
    await page.getByRole('heading', { level: 1 }).click();
    await page.keyboard.press('/');
    await expect(page).toHaveURL(/\/search/);
    await page.getByRole('searchbox', { name: 'Search events' }).fill('smile');
    await expect(page).toHaveURL(/\/search\?q=smile$/);
    await expect(card('Dentist check-up')).toBeVisible();
    await expect(card('Dentist check-up').locator('mark')).toHaveText('Smile');
  });

  await test.step('delete it and undo', async () => {
    await card('Dentist check-up').click();
    await page
      .getByRole('dialog', { name: 'Dentist check-up' })
      .getByRole('button', { name: 'Delete' })
      .click();
    await expect(page.getByText('Event deleted.', { exact: true })).toBeVisible();
    await expect(card('Dentist check-up')).toBeHidden();
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(card('Dentist check-up')).toBeVisible();
  });

  await test.step('the server kept it', async () => {
    await page.reload();
    await expect(card('Dentist check-up')).toBeVisible();
  });
});
