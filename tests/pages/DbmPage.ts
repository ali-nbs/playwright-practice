import { Locator } from "@playwright/test";
import { BasePage } from "./BasePage";

/**
 * What identifies one DBM result row.
 *
 * DBM's grid is section-level rather than filing-level, so rows are named
 * by this triple instead of by an Intelligize ID.
 */
export type DbmRowDetails = {
  sectionType: string;
  company: string;
  dateFiled: string;
};

/**
 * DbmPage - Disclosure Benchmarking.
 */
export class DbmPage extends BasePage {
  async goto() {
    await this.openApp("Disclosure Benchmarking");
  }

  // ---------------------------------------------------------------
  // Filters
  // ---------------------------------------------------------------

  /**
   * DBM's Date box is a testid input rather than the label-anchored one
   * BasePage uses.
   */
  get dateInput(): Locator {
    return this.page.getByTestId("date-input");
  }

  get sectionTypeInput(): Locator {
    return this.page.getByTestId("sectionType-input");
  }

  /** Keywords filter. DBM names this control differently from other apps. */
  get bodyKeywordsInput(): Locator {
    return this.page.getByTestId("bodyKeywords-input");
  }

  // ---------------------------------------------------------------
  // Result rows / document info
  // ---------------------------------------------------------------

  /**
   * Identifies a row by company, section and date rather than an
   * Intelligize ID.
   *
   * DBM's grid is section-level, not filing-level, so a single filing
   * appears as several rows and an Intelligize ID would not tell them
   * apart. This triple is what actually names one row.
   */
  async rowDetails(row: Locator): Promise<DbmRowDetails> {
    const sectionType = await row
      .locator('[class*="section-type-text"]')
      .first()
      .innerText();

    const company = await row
      .locator('[class*="company-name"]')
      .first()
      .innerText();

    const dateFiled = await row
      .locator('[class*="text-date"]')
      .first()
      .innerText();

    return {
      sectionType: sectionType.trim(),
      company: company.trim(),
      dateFiled: dateFiled.trim(),
    };
  }

  /** The same triple, read from the open document instead of a row. */
  async openDocDetails(): Promise<DbmRowDetails> {
    const documentInfo = this.page.locator('[class*="documentInfo"]');

    const company = await documentInfo
      .locator('[class*="company-info"] span[title]')
      .last()
      .innerText();

    const dateFiled = await documentInfo
      .locator('[class*="infoTag__text"]')
      .innerText();

    const sectionType = await documentInfo
      .locator('[class*="sectionTag"] span')
      .last()
      .innerText();

    return {
      company: company.trim(),
      dateFiled: dateFiled.trim(),
      sectionType: sectionType.trim(),
    };
  }

  /**
   * True when the open document shows a keyword highlight.
   *
   * Adds <customhighlight> to the shared selector list: DBM marks snippet
   * highlights with that tag, which the other apps never emit. Any extra
   * selectors a caller passes are still honoured.
   *
   * This is a plain override rather than the old separately-named
   * `hasDbmDocumentHighlight`, which stuttered at the call site
   * (`dbm.hasDbmDocumentHighlight()`) and meant a caller holding a BasePage
   * reference silently got the version without the DBM tag.
   */
  async hasDocumentHighlight(extraSelectors: string[] = []): Promise<boolean> {
    return super.hasDocumentHighlight(["customhighlight", ...extraSelectors]);
  }

}
