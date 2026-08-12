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
    await this.openApp("SEC Filings");
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

  /** A form-type option label inside the Forms picker popup. */
  formsModalOption(formType: string): Locator {
    return this.popupBody
      .locator("label")
      .filter({ hasText: new RegExp(`^${formType}`, "i") })
      .first();
  }

  /**
   * The form-type cell inside a result row, e.g. "6-K (description)".
   * Used to assert the parenthesised sub-form description is present.
   */
  rowFormTypeCell(row: Locator, formType: string): Locator {
    return row
      .locator("span")
      .filter({ hasText: new RegExp(`^${formType}`, "i") })
      .last();
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

  // ---------------------------------------------------------------
  // Keyword suggestion popup (boolean / conceptual)
  // ---------------------------------------------------------------

  get keywordOkBtn(): Locator {
    return this.page.getByRole("button", { name: /^OK$/i });
  }

  get applyChangesBtn(): Locator {
    return this.page.getByRole("button", { name: /Accept Changes/i });
  }

  get noSuggestionsMsg(): Locator {
    return this.page.getByText(
      /It looks like we don't have any suggestions/i,
    );
  }

  get booleanWarning(): Locator {
    return this.page.getByText(
      /Boolean operators are not supported for conceptual search/i,
    );
  }

  get relevanceColumnHeader(): Locator {
    return this.page.locator('span[title*="semantically similar and relevant"]');
  }

  /** Keyword highlights (<em>) inside the opened document. */
  get documentHighlights(): Locator {
    return this.documentFrame.locator("em");
  }

  // ---------------------------------------------------------------
  // Company Type / Status
  // ---------------------------------------------------------------

  /** A company-type option inside the Company Type/Status picker. */
  companyTypeOption(categoryId: string): Locator {
    return this.popupBody.locator(`label[for="${categoryId}"]`);
  }

  // ---------------------------------------------------------------
  // Section picker (boilerplate flow)
  // ---------------------------------------------------------------

  /** An item in the Section picker list. */
  get sectionItems(): Locator {
    return this.popupBody.locator("li.styles__item-list___17b6k");
  }

  /** A section checkbox by its input name. */
  sectionCheckbox(sectionName: string): Locator {
    return this.page.locator(`input[name="${sectionName}"]`);
  }

  // NOTE: `pickerRowCheckboxIcon` moved to BasePage as `pickerCheckboxIcon`.
  // Nothing about it was SF-specific.

  // ---------------------------------------------------------------
  // Fiscal year (company summary popup)
  // ---------------------------------------------------------------

  /** Rows of the periodic-filings table in the company summary. */
  get periodicFilingRows(): Locator {
    return this.page.locator("tr.periodicFilingsContent__tableRow___trkDv");
  }

  // NOTE: `statusTab` used to be declared here with the exact same XPath as
  // BasePage.statusTabLabels, character for character. It was a merge
  // duplicate, so it is gone and its two callers now use statusTabLabels.

  /**
   * A result row looked up directly by id, WITHOUT scoping through the
   * rowgroup the way BasePage.rowById does.
   *
   * The two are not interchangeable: the unscoped query also matches rows in
   * a stale, offscreen grid the app has left mounted. Only sf-6kFormType uses
   * this, and whether it actually needs the unscoped behaviour is unverified
   * - see the review's open questions. Renamed from `rowByIdFlat`, where
   * "Flat" was never defined anywhere.
   */
  rowByIdUnscoped(id: number | string): Locator {
    return this.page.locator(`div[data-test="resultRow"][id="${id}"]`);
  }

  /** The tabbed variant of the popup body, used by the Section picker. */
  get tabbedPopupBody(): Locator {
    return this.page.locator(
      "div.PopupBody__popup__body___1J_d3.styles__tabs-container___1kNEn",
    );
  }

  // NOTE: `checkListItem` moved to BasePage as `pickerListItem`. It targets
  // generic picker-popup chrome, not anything SF owns.

  /** The XBRL viewer iframe (a different iframe from documentFrame). */
  get xbrlFrame() {
    return this.page.frameLocator("div.HtmlViewer__viewer___ZSwJe iframe");
  }

  /** The XBRL report table, used to wait for the viewer to render. */
  get xbrlReportTable(): Locator {
    return this.xbrlFrame
      .locator(".HtmlViewer-styles__xbrl-report-table-attribs___2OtRf")
      .first();
  }

  /** An XBRL table row whose label cell matches `label`. */
  xbrlRowByLabel(label: string): Locator {
    return this.xbrlFrame
      .locator("tr")
      .filter({ has: this.xbrlFrame.locator(`td.pl >> text=/^${label}$/i`) })
      .first();
  }

  /** Text cells of a periodic-filings row. */
  periodicFilingCells(row: Locator): Locator {
    return row.locator("td.text");
  }

  // ---------------------------------------------------------------
  // Filters used by the count-driven flows
  // ---------------------------------------------------------------

  /** Accounting Standard filter, e.g. "U.S. GAAP". */
  get accountingStandardInput(): Locator {
    return this.page.getByTestId("accountingStandard-input");
  }

  /** Accelerated Status filter, e.g. "Large Accelerated Filer". */
  get acceleratedStatusInput(): Locator {
    return this.page.getByTestId("acceleratedStatus-input");
  }

  /** Accountant Fees filter. Opens a picker rather than taking free text. */
  get accountantFeesInput(): Locator {
    return this.page.getByTestId("accountantFees-input");
  }

  /**
   * Types a ";"-separated list of form types into the Forms filter and
   * commits it.
   *
   * Uses pressSequentially rather than BasePage.fillAndEnter because the
   * Forms box parses the list as it is typed and drops entries when the
   * characters arrive faster than its own parsing. A SINGLE form type does
   * not hit that problem, which is why sf-accountant happily uses
   * fillAndEnter for one value. Renamed from `applyFormTypes` so the "list"
   * part - the entire reason this exists - is in the name.
   */
  async typeFormTypeList(value: string, delay: number = 700) {
    await this.formsInput.pressSequentially(value, { delay });
    await this.page.keyboard.press("Enter");
  }

  // NOTE: `applyAccountantFee` used to live here. It had one caller, and its
  // body was a generic "open this filter, tick the option with this label,
  // press OK" sequence with nothing SF-specific in it except which input.
  // Which fee option to pick is a decision belonging to the test, so those
  // three lines now live in sf-accountantFees-logic.ts next to FEE_OPTION.
  // The `accountantFeesInput` locator above stays here, because a locator IS
  // a thing on SF's screen.

  // ---------------------------------------------------------------
  // Result-row values (need the matching display column switched on)
  // ---------------------------------------------------------------

  /** A row's "Accounting Std." value. */
  async rowAccountingStandard(row: Locator): Promise<string> {
    const value = await row
      .locator('span:has-text("Accounting Std.")')
      .locator("xpath=following-sibling::span/p")
      .innerText();

    return value.trim();
  }

  /** A row's "Accelerated Status" value. */
  async rowAcceleratedStatus(row: Locator): Promise<string> {
    const value = await row
      .locator('span:has-text("Accelerated Status")')
      .locator("xpath=following-sibling::span/p")
      .innerText();

    return value.trim();
  }

  /**
   * True when a row shows any Accountant Fees value.
   *
   * Returns a boolean rather than the text because the fee cell holds
   * several sub-values and the check is only ever "is anything there".
   */
  async rowHasAccountantFee(row: Locator): Promise<boolean> {
    const value = await row
      .locator('span:has-text("Accountant Fees")')
      .locator("xpath=following-sibling::span")
      .textContent()
      .catch(() => null);

    return !!value && value.trim() !== "";
  }

  /** A row's filing/release date cell. */
  async rowDate(row: Locator): Promise<string> {
    const date = await row
      .locator(".styles__filing-date-value-column___2pu1v")
      .textContent();

    return date?.trim() ?? "";
  }

  // ---------------------------------------------------------------
  // Document viewer - Outline tab
  // ---------------------------------------------------------------

  /**
   * True when the open document's Outline tab rendered.
   *
   * Detected by its "Search Outline" box rather than the tab itself: the
   * tab is present even for documents that have no outline, so only the
   * search box distinguishes a real outline from an empty one.
   */
  async isOutlineTabActive(): Promise<boolean> {
    const searchBox = this.page.getByRole("textbox", {
      name: "Search Outline",
    });

    try {
      await searchBox.first().waitFor({ timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  // ---------------------------------------------------------------
  // Snippets
  // ---------------------------------------------------------------

  /** The snippet block inside a result row. */
  rowSnippets(row: Locator): Locator {
    return row.locator(
      ".Snippets-styles__result-row__snippet__content___2-_PD",
    );
  }

  /** Keyword highlights inside a result row. */
  rowKeywordHighlights(row: Locator): Locator {
    return row.locator("em.highlight");
  }

}
