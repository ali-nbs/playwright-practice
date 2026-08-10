import { BasePage } from "./BasePage";

export { ConfigureOptions } from "./BasePage";

/**
 * ShellPage - a plain BasePage you can construct when you only need the
 * shared app shell and not a specific app's filters.
 *
 * This exists so the legacy helpers in utils/helpers.ts (fillAndEnter,
 * getTabText, configureDisplayColumns, closeAllOpenTabs) can delegate to the
 * single BasePage implementation instead of keeping a second copy of the
 * same code. Flows that already have an app page object (SfPage, SrcPage, ...)
 * should call the methods on that object directly.
 */
export class ShellPage extends BasePage {}
