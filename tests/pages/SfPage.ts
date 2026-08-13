import { Locator } from "@playwright/test";
import { BasePage } from "./BasePage";

export class SfPage extends BasePage {
  async goto() {
    await this.openApp("SEC Filings");
  }

  // ---------------------------------------------------------------
  // Filters
  // ---------------------------------------------------------------

  get formsInput(): Locator {
    return this.page.locator("#Forms").getByRole("textbox");
  }

  get dateInputByTestId(): Locator {
    return this.page.getByTestId("date-input");
  }

  get exhibitsToFilingsLabel(): Locator {
    return this.page.locator('label[for="-ExhibitsToFilings"]');
  }

  get amendmentFilingsExcludeRadio(): Locator {
    return this.page.getByTestId("amendmentFilings-radio-EXC");
  }

  get ownershipFormsIncludeRadio(): Locator {
    return this.page.getByTestId("ownershipForms-radio-INC");
  }

  get filingAgentInput(): Locator {
    return this.page.getByTestId("filingAgentAndSoftware-input");
  }

  get formsModalSearchInput(): Locator {
    return this.popupBody.getByTestId("forms-searchInput");
  }

  formsModalOption(formType: string): Locator {
    return this.popupBody
      .locator("label")
      .filter({ hasText: new RegExp(`^${formType}`, "i") })
      .first();
  }

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

  get ixbrlTabById(): Locator {
    return this.page.locator("#ixbrl");
  }

  get ixbrlTabByText(): Locator {
    return this.page.locator("text=/^iXBRL$/i").first();
  }

  get ex101Tab(): Locator {
    return this.page.locator("text=/^EX-101$/i").first();
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

  // ---------------------------------------------------------------
  // Company Type / Status
  // ---------------------------------------------------------------

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

  // ---------------------------------------------------------------
  // Fiscal year (company summary popup)
  // ---------------------------------------------------------------

  /** Rows of the periodic-filings table in the company summary. */
  get periodicFilingRows(): Locator {
    return this.page.locator("tr.periodicFilingsContent__tableRow___trkDv");
  }


  /** The tabbed variant of the popup body, used by the Section picker. */
  get tabbedPopupBody(): Locator {
    return this.page.locator(
      "div.PopupBody__popup__body___1J_d3.styles__tabs-container___1kNEn",
    );
  }

  get xbrlFrame() {
    return this.page.frameLocator("div.HtmlViewer__viewer___ZSwJe iframe");
  }

  get xbrlReportTable(): Locator {
    return this.xbrlFrame
      .locator(".HtmlViewer-styles__xbrl-report-table-attribs___2OtRf")
      .first();
  }

  xbrlRowByLabel(label: string): Locator {
    return this.xbrlFrame
      .locator("tr")
      .filter({ has: this.xbrlFrame.locator(`td.pl >> text=/^${label}$/i`) })
      .first();
  }

  periodicFilingCells(row: Locator): Locator {
    return row.locator("td.text");
  }

  // ---------------------------------------------------------------
  // Filters used by the count-driven flows
  // ---------------------------------------------------------------

  get accountingStandardInput(): Locator {
    return this.page.getByTestId("accountingStandard-input");
  }

  get acceleratedStatusInput(): Locator {
    return this.page.getByTestId("acceleratedStatus-input");
  }

  get accountantFeesInput(): Locator {
    return this.page.getByTestId("accountantFees-input");
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

}
