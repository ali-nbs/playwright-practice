// run-tests.js
const { execSync } = require("child_process");

const tests = [
  "./SF/sf-6kFormType.spec.ts",
  "./SF/sf-accountant.spec.ts",
  "./SF/sf-auditor.spec.ts",
  "./SF/sf-boilerPlate.spec.ts",
  "./SF/sf-companyType-SPAC-REIT-BDC-FPI-INV.spec.ts",
  "./SF/sf-companyType-SRC-Shell-WKSI-EGC.spec.ts",
  "./SF/sf-crawling.spec.ts",
  "./SF/sf-filingAgent.spec.ts",
  "./SF/sf-fiscalYear.spec.ts",
  "./SF/sf-indexing.spec.ts",
  "./SF/sf-ixbrl.spec.ts",
  "./SF/sf-pdee.spec.ts",
  "./SF/sf-xbrlParsing.spec.ts",
  "./RO/ro-indexing.spec.ts",
  "./SE/se-indexing.spec.ts",
  "./NAL/nal-indexing.spec.ts",
];

for (const test of tests) {
  console.log(`\n➡️ Running ${test}...`);
  try {
    execSync(`npx playwright test ${test} --headed`, { stdio: "inherit" });
    console.log(`✅ Completed ${test}`);
  } catch (err) {
    console.error(`❌ Failed ${test}`);
  }
}
