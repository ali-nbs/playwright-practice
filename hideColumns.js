import { hideColumns } from "./tests/utils/dumpDataOnGoogleSheet.ts";

async function run() {
  try {
    await hideColumns();
    console.log("Columns hidden successfully.");
  } catch (error) {
    console.error("Failed to hide columns:", error);
  }
}

run();
