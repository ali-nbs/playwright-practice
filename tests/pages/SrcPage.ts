import { Locator } from "@playwright/test";
import { BasePage } from "./BasePage";

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
}
