import { Locator, expect } from "@playwright/test";
import { BasePage } from "./BasePage";

/**
 * What identifies one SRC result row.
 *
 * SRC results are regulatory documents rather than filings, so they carry
 * no Intelligize ID and are named by this triple instead.
 */
export type SrcRowDetails = {
  title: string;
  category: string;
  dateFiled: string;
};

/**
 * SrcPage - Securities Regulation & Compliance.
 *
 * Only what is specific to SRC. Search, Clear Filters, the result grid, tabs
 * and the document viewer all come from BasePage.
 */
export class SrcPage extends BasePage {
  async goto() {
    await this.openApp("Securities Regulation & Compliance");
  }

  // ---------------------------------------------------------------
  // Filters
  // ---------------------------------------------------------------

  get lawsAndRegsInput(): Locator {
    return this.page.locator("#LawsAndRegs").locator("input");
  }

  get dateInput(): Locator {
    return this.page
      .locator(".styles__focusContainer___13rFy")
      .filter({ has: this.page.locator("label", { hasText: /^Date$/ }) })
      .locator("input");
  }

  /** Open the Laws & Regs picker, tick "Select All", press OK. */
  async selectAllLawsAndRegs() {
    await this.page
      .locator("#LawsAndRegs")
      .locator("._icon_1jkal_249")
      .first()
      .click();

    await this.page
      .locator("div.styles__tabHeader___2qy2T")
      .filter({ hasText: "Select All" })
      .locator("label")
      .check();

    await this.page.getByRole("button", { name: "OK" }).click();
  }

  // ---------------------------------------------------------------
  // Document viewer - outline panel
  // ---------------------------------------------------------------

  get outlineTab(): Locator {
    return this.page.locator('div[id="outline"]').first();
  }

  /** True when the document has no outline, so the tab can't be opened. */
  async isOutlineDisabled(): Promise<boolean> {
    const tabClass = (await this.outlineTab.getAttribute("class")) || "";
    return tabClass.includes("disabled");
  }

  async clickLastOutlineItem() {
    await this.page
      .locator(".styles__item___6rcBX")
      .last()
      .locator("span")
      .last()
      .click({ force: true });
  }

  // ---------------------------------------------------------------
  // Keyword filter
  // ---------------------------------------------------------------

  /**
   * Keywords box.
   *
   * SRC's is a <textarea> inside a data-notice block rather than the
   * getByTestId input the other apps use, so it gets its own locator.
   */
  get keywordsInput(): Locator {
    return this.page
      .locator('div[data-notice="primaryKeywords"]')
      .locator("textarea");
  }

  // ---------------------------------------------------------------
  // Result rows / document info
  // ---------------------------------------------------------------

  /**
   * Identifies a row by title, category and date.
   *
   * SRC results are regulatory documents rather than filings, so they carry
   * no Intelligize ID to key off.
   */
  async rowDetails(row: Locator): Promise<SrcRowDetails> {
    const category = await row
      .locator('[class*="section-type-text"]')
      .first()
      .innerText();

    const title = await row
      .locator('[class*="company-name"]')
      .first()
      .innerText();

    const dateFiled = await row
      .locator('[class*="text-date"]')
      .first()
      .innerText();

    return {
      category: category.trim(),
      title: title.trim(),
      dateFiled: dateFiled.trim(),
    };
  }

  /** The same triple, read from the open document instead of a row. */
  async openDocDetails(): Promise<SrcRowDetails> {
    const documentInfo = this.page.locator('[class*="documentInfo"]');

    const title = await documentInfo
      .locator('[class*="company-info"] span[title]')
      .last()
      .innerText();

    const dateFiled = await documentInfo
      .locator('[class*="infoTag__text"]')
      .innerText();

    const category = await documentInfo
      .locator('[class*="sectionTag"] span')
      .last()
      .innerText();

    return {
      title: title.trim(),
      dateFiled: dateFiled.trim(),
      category: category.trim(),
    };
  }

  // ---------------------------------------------------------------
  // Document viewer
  // ---------------------------------------------------------------

  /**
   * Opens a row's document.
   *
   * Overrides the hover-then-click BasePage version: SRC renders the View
   * button without needing a hover, and the hover step made the click land
   * on the row instead of the button.
   */
  async clickViewForRow(row: Locator) {
    await expect(row).toBeVisible();

    const button = row.getByRole("button", { name: "View" });

    await expect(button).toBeVisible();
    await button.click();
  }

  /**
   * Steps to the next document.
   *
   * Overrides BasePage's version with a raw DOM click: SRC's Next button
   * reports itself as not actionable to Playwright even while it works, so
   * the visible/enabled checks time out on a perfectly usable control.
   */
  async clickNextDocument() {
    await this.page.evaluate(() => {
      const btn = document.querySelector('button[title="Next"]');

      if (!(btn instanceof HTMLElement)) {
        throw new Error("Next button not found");
      }

      btn.click();
    });
  }

}
