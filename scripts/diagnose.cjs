// Diagnostic only: records what BrightHR shows at each step. Saves nothing, never prints the password.
const { chromium } = require('@playwright/test');
require('dotenv').config();
(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ locale: 'en-GB', timezoneId: 'Europe/London' });
  const dump = async (label) => {
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(3000);
    console.log(`\n===== ${label}\nURL: ${page.url()}`);
    for (const frame of page.frames()) {
      const lines = await frame.evaluate(() => {
        const vis = (e) => !!(e.offsetWidth || e.offsetHeight || e.getClientRects().length);
        const t = (s) => (s || '').replace(/\s+/g, ' ').trim().slice(0, 60);
        const lab = (e) => (e.labels && e.labels[0] ? e.labels[0].innerText : '');
        const out = [];
        document.querySelectorAll('input,select,textarea').forEach((e) => { if (vis(e)) out.push(`INPUT tag=${e.tagName} type=${e.type} id=${e.id} name=${e.name} placeholder="${t(e.placeholder)}" aria="${t(e.getAttribute('aria-label'))}" label="${t(lab(e))}" testid=${e.getAttribute('data-testid')} readonly=${e.readOnly}`); });
        document.querySelectorAll('button,[role=button],input[type=submit]').forEach((e) => { if (vis(e)) out.push(`BUTTON "${t(e.innerText || e.value || e.getAttribute('aria-label'))}" type=${e.type} id=${e.id} testid=${e.getAttribute('data-testid')}`); });
        [...document.querySelectorAll('a,[role=link]')].filter(vis).slice(0, 40).forEach((e) => out.push(`LINK "${t(e.innerText || e.getAttribute('aria-label'))}" href=${e.getAttribute('href')}`));
        document.querySelectorAll('[role=dialog],[aria-modal=true]').forEach((e) => { if (vis(e)) out.push(`DIALOG "${t(e.innerText)}"`); });
        return out;
      }).catch((e) => [`(frame not readable: ${e.message})`]);
      console.log(`-- frame: ${frame.url()}`);
      lines.forEach((l) => console.log(l));
    }
  };
  const visible = (l) => l.isVisible().catch(() => false);
  try {
    await page.goto('https://sandbox-app.brighthr.com/lite');
    await page.getByRole('link', { name: 'Log in', exact: true }).click();
    await dump('1. Login page (after clicking "Log in" on /lite)');
    await page.screenshot({ path: 'diagnose-1.png', fullPage: true });

    const email = page.locator('input[type=email], input[name*=mail i], input[id*=mail i], input[name*=user i], input[id*=user i]').and(page.locator(':not([id$="-sign-up"])')).first();
    const pwd = page.locator('input[type=password]').first();
    if (await visible(email)) {
      await email.fill(process.env.BRIGHTHR_EMAIL || '');
      if (!(await visible(pwd))) {
        await email.press('Enter');
        await dump('2. After typing email and pressing Enter');
      }
    }
    if (await visible(pwd)) {
      await pwd.fill(process.env.BRIGHTHR_PASSWORD || '');
      await pwd.press('Enter');
      await dump('3. After typing password and pressing Enter');
    }
    await page.screenshot({ path: 'diagnose-3.png', fullPage: true });

    const emp = page.getByRole('link', { name: /employees/i }).or(page.getByRole('button', { name: /employees/i })).first();
    if (await visible(emp)) {
      await emp.click();
      await dump('4. Employees page');
      const add = page.getByRole('button', { name: /add employee/i }).or(page.getByRole('link', { name: /add employee/i })).first();
      if (await visible(add)) {
        await add.click();
        await dump('5. Add employee form (NOT saved)');
        await page.screenshot({ path: 'diagnose-5.png', fullPage: true });
      }
    }
  } catch (e) {
    console.log('DIAGNOSE ERROR:', e.message);
  } finally {
    await browser.close();
  }
})();
