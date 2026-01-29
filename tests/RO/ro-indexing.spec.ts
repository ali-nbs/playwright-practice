// import { test, expect } from "@playwright/test";
// import * as fs from 'fs';
// import { off } from "node:cluster";

// test("Ro-Indexing", async ({ page, context }) => {

//     // const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
//     // const fileName = `ro-indexing-${timestamp}.txt`;
//     // const //logToFile = (message: any) => {
//     //     fs.appendFileSync(fileName, message + "\n");
//     //     console.log(message);
//     // };

//     // //logToFile("title RO-Indexing");
//     // //logToFile(`filename ${fileName}\n`);

//     await page.goto("/");
//     // if (page.url().includes('lexisnexis.com/en-us/gateway.page')) {
//     // await page.getByRole('link', { name: /sign[-\s]?in/i }).click();

//     // const pagePromise = context.waitForEvent('page');

//     // await page.getByRole('link', { name: /intelligize/i }).click();

//     // const page = await pagePromise;
//     // await page.waitForLoadState();
//     // await page.pause();

//     const userIdInput = page.locator('#userid');
//     await expect(userIdInput).toBeVisible({ timeout: 240000 });
//     await userIdInput.fill(process.env.APP_USERNAME!);

//     await page.getByRole('button', { name: 'Next' }).click();
//     await page.waitForLoadState();

//     const userPasswordInput = page.locator('#password');
//     await expect(userPasswordInput).toBeVisible({ timeout: 240000 });
//     await userPasswordInput.fill(process.env.APP_PASSWORD!);

//     await page.getByRole('button', { name: 'Sign in' }).click();
//     await page.waitForURL(/^https:\/\/apps\.intelligize\.com/, { timeout: 240000 });

//     const currentUrl = page.url();
//     console.log(`Current URL after login: ${currentUrl}`);
//     if (currentUrl.includes('/Account/LogOn')) {
//         const cleanUrl = currentUrl.replace('/Account/LogOn', '');
//         console.log(`Cleaning URL to: ${cleanUrl}`);
//         await page.goto(cleanUrl, { waitUntil: 'commit' }).catch(() => { });
//     }

//     await expect(page).toHaveURL(/^https:\/\/apps\.intelligize\.com/);
//     await page.locator('text=Transactions').waitFor({
//         state: 'visible',
//         timeout: 240000
//     });
//     //240000
//     const reportingSection = page.locator('text=Transactions').first();
//     await expect(reportingSection).toBeVisible({ timeout: 3600 });

//     const secLink = page.locator('text=/Registered Offerings/i').first();
//     await secLink.waitFor({ state: 'visible', timeout: 3600 });
//     await secLink.click();

//     let dateInput = page.locator('//label[text()="Date"]/ancestor::div[5]//input');
//     await dateInput.waitFor({ state: 'visible', timeout: 240000 });
//     await dateInput.click({ force: true });
//     await dateInput.pressSequentially('Yesterday', { delay: 100 });
//     // await page.pause();

//     let searchBtn = page.getByRole('button', { name: /^Search$/i });
//     await searchBtn.click();
//     let viewBtn = page.getByRole('button', { name: /^View$/i });

//     let offeringCountLocator = page.locator('//span[contains(text(), "Offerings:")]');
//     let noResultsLocator = page.locator('text=/No Results Found/i');

//     //await offeringCountLocator.first().waitFor({ state: 'visible' });
//     await Promise.race([
//         offeringCountLocator.first().waitFor({ state: 'visible', timeout: 30000 }).catch(() => { }),
//         noResultsLocator.waitFor({ state: 'visible', timeout: 30000 }).catch(() => { })
//     ]);
//     let initialCount = 0;
//     let offeringText;
//     if (await offeringCountLocator.isVisible()) {
//         offeringText = await offeringCountLocator.innerText();
//         initialCount = await offeringCountLocator.count();
//         console.log("offering count 1st tab value:", offeringText);
//         //logToFile(`1st tab (Date Yesterday): ${offeringText}`);
//     }


//     let keywordsInput = page.locator('//label[text()="Keywords"]/following::textarea[1]');
//     await keywordsInput.waitFor({ state: 'visible', timeout: 240000 });
//     await keywordsInput.click({ force: true });
//     await keywordsInput.pressSequentially('is OR the', { delay: 100 });
//     await page.pause();

//     searchBtn = page.getByRole('button', { name: /^Search$/i });
//     await searchBtn.click();

//     await expect(page.locator('//span[contains(text(), "Offerings:") or contains(text(), "No Results Found")]')).toHaveCount(initialCount + 1, { timeout: 30000 });
//     offeringCountLocator = page.locator('//span[contains(text(), "Offerings:")]');
//     await offeringCountLocator.last().waitFor({ state: 'visible' });
//     let offeringText2 = await offeringCountLocator.last().innerText();
//     console.log("offering count 2nd tab value:", offeringText2);
//     //logToFile(`2nd tab (Date + Keyword): ${offeringText2}`);

//     // Compare 1 and 2
//     //logToFile(offeringText === offeringText2 ? "Result: Valid" : "Result: Invalid");
//     //logToFile("-----------------------------------");
//     await page.pause();

//     let clearBtn = page.getByRole('button', { name: /^Clear Filters$/i });
//     await clearBtn.click();

//     await page.pause();

//     dateInput = page.locator('//label[text()="Date"]/ancestor::div[5]//input');
//     await dateInput.waitFor({ state: 'visible', timeout: 240000 });
//     await dateInput.click({ force: true });
//     await dateInput.pressSequentially('Last 7 Days', { delay: 100 });
//     // await page.pause();

//     searchBtn = page.getByRole('button', { name: /^Search$/i });
//     await searchBtn.click();
//     viewBtn = page.getByRole('button', { name: /^View$/i });

//     await expect(page.locator('//span[contains(text(), "Offerings:")]')).toHaveCount(initialCount + 2, { timeout: 30000 });
//     offeringCountLocator = page.locator('//span[contains(text(), "Offerings:")]');
//     await offeringCountLocator.last().waitFor({ state: 'visible' });
//     offeringText = await offeringCountLocator.last().innerText();
//     initialCount = await offeringCountLocator.count();
//     console.log("offering count 3rd tab value:", offeringText);
//     //logToFile(`3rd tab (Date Last 7 Days): ${offeringText}`);

//     keywordsInput = page.locator('//label[text()="Keywords"]/following::textarea[1]');
//     await keywordsInput.waitFor({ state: 'visible', timeout: 240000 });
//     await keywordsInput.click({ force: true });
//     await keywordsInput.pressSequentially('is OR the', { delay: 100 });
//     await page.pause();

//     searchBtn = page.getByRole('button', { name: /^Search$/i });
//     await searchBtn.click();

//     await expect(page.locator('//span[contains(text(), "Offerings:")]')).toHaveCount(initialCount + 1, { timeout: 30000 });
//     offeringCountLocator = page.locator('//span[contains(text(), "Offerings:")]');
//     await offeringCountLocator.last().waitFor({ state: 'visible' });
//     offeringText2 = await offeringCountLocator.last().innerText();
//     console.log("offering count 4th tab value:", offeringText2);
//     //logToFile(`4th tab (Date + Keyword): ${offeringText2}`);

//     // Compare 3 and 4
//     //logToFile(offeringText === offeringText2 ? "Result: Valid" : "Result: Invalid");

//     //logToFile("\n--- End of Report ---");
//     await page.pause();

//     //}
// })

import { test, expect } from "@playwright/test";
import * as fs from 'fs';
import path from "path/win32";

// Only use storageState if the file actually exists
// if (fs.existsSync('auth.json')) {
//     console.log("file found");
//     test.use({ storageState: 'auth.json' });
// }

test("Ro-Indexing", async ({ page }) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
    const logDirectory = path.resolve(__dirname, './Results/ro-indexing');
    if (!fs.existsSync(logDirectory)) {
        fs.mkdirSync(logDirectory, { recursive: true });
    }

    const fileName = path.join(logDirectory, `ro-indexing-${timestamp}.txt`);
    const logToFile = (message: any) => {
        fs.appendFileSync(fileName, message + "\n");
        console.log(message);
    };

    logToFile("title RO-Indexing");
    await page.goto("/");

    if (await page.locator('#userid').isVisible({ timeout: 5000 }).catch(() => false)) {
        console.log("Not logged in. Performing login...");
        await page.locator('#userid').fill(process.env.APP_USERNAME!);
        await page.getByRole('button', { name: 'Next' }).click();
        await page.locator('#password').fill(process.env.APP_PASSWORD!);
        await page.getByRole('button', { name: 'Sign in' }).click();

        await page.waitForURL(/.*apps.intelligize.com/);
      //  await page.context().storageState({ path: 'auth.json' });
    }

    const secLink = page.locator('text=/Registered Offerings/i').first();
    await secLink.click();

    const getTabText = async (expectedIndex: number) => {
        const tabLocator = page.locator('//span[contains(text(), "Offerings:") or contains(text(), "No Results Found")]');
        await expect(tabLocator).toHaveCount(expectedIndex + 1, { timeout: 240000 });
        return await tabLocator.nth(expectedIndex).innerText();
    };

    let dateInput = page.locator('//label[text()="Date"]/ancestor::div[5]//input');
    await dateInput.click({ force: true });
    await dateInput.pressSequentially('Today', { delay: 100 });
    await page.getByRole('button', { name: /^Search$/i }).click();
    const offeringText1 = await getTabText(0);
    //console.log(`1st tab: ${offeringText1}`);
    logToFile(`1st tab (Date Today): ${offeringText1}`);

    let keywordsInput = page.locator('//label[text()="Keywords"]/following::textarea[1]');
    await keywordsInput.click({ force: true });
    await keywordsInput.pressSequentially('is OR the', { delay: 100 });
    await page.getByRole('button', { name: /^Search$/i }).click();
    const offeringText2 = await getTabText(1);
    // console.log(`2nd tab: ${offeringText2}`);
    logToFile(`2nd tab (Date + Keyword): ${offeringText2}`);
    logToFile(offeringText1 === offeringText2 ? "Result: Valid" : "Result: Invalid");
    logToFile("-----------------------------------");

    //  console.log(offeringText1 === offeringText2 ? "Result: Valid" : "Result: Invalid");
    let clearBtn = page.getByRole('button', { name: /^Clear Filters$/i });
    await clearBtn.click();

    dateInput = page.locator('//label[text()="Date"]/ancestor::div[5]//input');
    await dateInput.waitFor({ state: 'visible' });
    await dateInput.click({ force: true });
    await dateInput.pressSequentially('Yesterday', { delay: 100 });
    await page.getByRole('button', { name: /^Search$/i }).click();
    let offeringText3 = await getTabText(2);
    // console.log(`3rd tab: ${offeringText3}`);
    logToFile(`3rd tab (Date Yesterday): ${offeringText3}`);

    keywordsInput = page.locator('//label[text()="Keywords"]/following::textarea[1]');
    await keywordsInput.click({ force: true });
    await keywordsInput.pressSequentially('is OR the', { delay: 100 });
    await page.getByRole('button', { name: /^Search$/i }).click();
    let offeringText4 = await getTabText(3);
    // console.log(`4th tab: ${offeringText4}`);
    // console.log(offeringText3 === offeringText4 ? "7 Days Result: Valid" : "7 Days Result: Invalid");
    logToFile(`4th tab (Date + Keyword): ${offeringText4}`);
    logToFile(offeringText3 === offeringText4 ? "Result: Valid" : "Result: Invalid");
    logToFile("-----------------------------------");

    clearBtn = page.getByRole('button', { name: /^Clear Filters$/i });
    await clearBtn.click();

    dateInput = page.locator('//label[text()="Date"]/ancestor::div[5]//input');
    await dateInput.waitFor({ state: 'visible' });
    await dateInput.click({ force: true });
    await dateInput.pressSequentially('Last 7 Days', { delay: 100 });
    await page.getByRole('button', { name: /^Search$/i }).click();
    offeringText3 = await getTabText(4);
    // console.log(`3rd tab: ${offeringText3}`);
    logToFile(`5th tab (Date Last 7 Days): ${offeringText3}`);

    keywordsInput = page.locator('//label[text()="Keywords"]/following::textarea[1]');
    await keywordsInput.click({ force: true });
    await keywordsInput.pressSequentially('is OR the', { delay: 100 });
    await page.getByRole('button', { name: /^Search$/i }).click();
    offeringText4 = await getTabText(5);
    // console.log(`4th tab: ${offeringText4}`);
    // console.log(offeringText3 === offeringText4 ? "7 Days Result: Valid" : "7 Days Result: Invalid");
    logToFile(`6th tab (Date + Keyword): ${offeringText4}`);
    logToFile(offeringText3 === offeringText4 ? "Result: Valid" : "Result: Invalid");
    logToFile("-----------------------------------");
    console.log("\n--- End of Report ---");

  //  await page.pause();
});