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

  /** Amendment Filings "exclude" radio. */
  get amendmentFilingsExcludeRadio(): Locator {
    return this.page.getByTestId("amendmentFilings-radio-EXC");
  }

  /** Ownership Forms "include" radio. */
  get ownershipFormsIncludeRadio(): Locator {
    return this.page.getByTestId("ownershipForms-radio-INC");
  }

  /** Filing Agent & Software filter. */
  get filingAgentInput(): Locator {
    return this.page.getByTestId("filingAgentAndSoftware-input");
  }

  /** The Forms search box INSIDE the Forms picker popup (not #Forms). */
  get formsModalSearchInput(): Locator {
    return this.popupBody.getByTestId("forms-searchInput");
  }

  // ---------------------------------------------------------------
  // Keyword search (boolean / conceptual)
  // ---------------------------------------------------------------

  get keywordPlusBtn(): Locator {
    return this.page.getByTestId("keywords-round-btn");
  }

  get keywordModalSearch(): Locator {
    return this.popupContainer.getByTestId("keywords-search");
  }

  get keywordModalClearBtn(): Locator {
    return this.popupContainer.getByRole("button", { name: "Clear" });
  }

  get keywordModalOkBtn(): Locator {
    return this.popupContainer.getByRole("button", { name: "OK" });
  }

  get booleanTabBtn(): Locator {
    return this.page.getByRole("button", { name: /Boolean/i });
  }

  get conceptualTabBtn(): Locator {
    return this.page.getByRole("button", { name: /^Conceptual$/i });
  }

  get expandKeywordsBtn(): Locator {
    return this.page.getByRole("button", { name: /Expand Keywords/i });
  }

  /** The applied-filters breadcrumb strip. */
  get filterBar(): Locator {
    return this.page.locator(".styles__bread-crumb__wrapper___1Io7c").first();
  }

  /** Section/result outline panel in the document viewer. */
  get sectionResultOutline(): Locator {
    return this.page.locator(".styles__root___17wXu").first();
  }

  // ---------------------------------------------------------------
  // Document viewer tabs
  // ---------------------------------------------------------------

  /** The iXBRL tab by id. Used to read its disabled state. */
  get ixbrlTabById(): Locator {
    return this.page.locator("#ixbrl");
  }

  /** The iXBRL tab by visible text. */
  get ixbrlTabByText(): Locator {
    return this.page.locator("text=/^iXBRL$/i").first();
  }

  /** The EX-101 tab. */
  get ex101Tab(): Locator {
    return this.page.locator("text=/^EX-101$/i").first();
  }

  /** The "Docs: N" tab, matched by the SF flows' own xpath. */
  get backToDocsTab(): Locator {
    return this.page.locator('//span[contains(text(), "Docs:")]');
  }

  /** Result tab wrapper used by the fiscal-year flow. */
  get contextMenuWrapper(): Locator {
    return this.page.locator("div.react-contextmenu-wrapper");
  }
}
