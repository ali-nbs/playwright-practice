import { test, expect } from "@playwright/test";
import * as fs from 'fs';
import path from "path/win32";

// Only use storageState if the file actually exists
// if (fs.existsSync('auth.json')) {
//     console.log("file found");
//     test.use({ storageState: 'auth.json' });
// }

test("SE-Indexing", async ({ page }) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
    const logDirectory = path.resolve(__dirname, './Results/se-indexing');
    if (!fs.existsSync(logDirectory)) {
        fs.mkdirSync(logDirectory, { recursive: true });
    }

    const fileName = path.join(logDirectory, `se-indexing-${timestamp}.txt`);
    const logToFile = (message: any) => {
        fs.appendFileSync(fileName, message + "\n");
        console.log(message);
    };

    logToFile("title SE-Indexing");
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

    const secLink = page.locator('text=/SEC Enforcement/i').first();
    await secLink.click();

    const getTabText = async (expectedIndex: number) => {
        const tabLocator = page.locator('//span[contains(text(), "Docs:") or contains(text(), "No Results Found")]');
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