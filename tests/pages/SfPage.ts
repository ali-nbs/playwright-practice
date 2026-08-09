import { Locator } from "@playwright/test";
import { BasePage } from "./BasePage";

/**
 * SfPage - SEC Filings.
 *
 * This is the biggest app in the suite (16 test flows), so the shared filter
 * locators are collected here. Search / Clear Filters / result grid / doc
 * viewer come from BasePage.
 *
 * Only LOCATORS are shared here, not actions. The flows deliberately do
 * different things with the same control (some click the Exhibits checkbox,
 * some uncheck it, some pass force:true), so each flow keeps its own action.
 */
export class SfPage extends BasePage {
  async goto() {
    await this.page.locator("text=/SEC Filings/i").first().click();
  }

  // ---------------------------------------------------------------
  // Filters
  // ---------------------------------------------------------------

  /** Forms filter textbox. Used by 5 flows. */
  get formsInput(): Locator {
    return this.page.locator("#Forms").getByRole("textbox");
  }

  /**
   * Date filter, located via its label. Used by 7 flows.
   *
   * NOTE: sf-crossReferenceLinks uses `getByTestId("date-input")` instead.
   * Both are kept (see dateInputByTestId) rather than picking one, because
   * they are not verified to be interchangeable.
   */
  get dateInput(): Locator {
    return this.page.locator('//label[text()="Date"]/ancestor::div[5]//input');
  }

  /** The testid-based Date input, as used by sf-crossReferenceLinks. */
  get dateInputByTestId(): Locator {
    return this.page.getByTestId("date-input");
  }

  get keywordsInput(): Locator {
    return this.page.getByTestId("keywords-input");
  }

  /**
   * "Exhibits to Filings" checkbox label. Used by 14 of the 16 SF flows.
   *
   * Exposed as a locator only: callers do different things with it
   * (`click()`, `uncheck()`, with and without `force: true`) and those
   * differences are intentional, so there is no shared action method.
   */
  get exhibitsToFilingsLabel(): Locator {
    return this.page.locator('label[for="-ExhibitsToFilings"]');
  }
}
