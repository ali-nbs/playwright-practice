import { google } from "googleapis";
import * as path from "path";

// =======================================================================
// ⚙️ CONFIGURATION
// =======================================================================
const SPREADSHEET_ID = "1DYUwwefGsiVtGsTU1UQBBwLcrDTdelaEOUCeLFZLrv0"; 
const CREDENTIALS_PATH = path.join(__dirname, "credentials.json"); // Path to your Google service account credentials
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

async function main() {
  console.log("⏳ Connecting to Google Sheets API...");

  // 1. Authenticate with Google
  const auth = new google.auth.GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: SCOPES,
  });
  const sheets = google.sheets({ version: "v4", auth });

  try {
    // 2. Fetch Spreadsheet Metadata to get all Tab Names
    const spreadsheetMetadata = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });
    const sheetTabs = spreadsheetMetadata.data.sheets || [];

    // Ensure our master '1071' tab exists
    const has1071 = sheetTabs.some(s => s.properties?.title === "1071");
    if (!has1071) {
      throw new Error("❌ Error: Missing the master '1071' tab in this spreadsheet.");
    }

    // 3. Extract and index the Prod ID -> Dev ID mapping from '1071'
    console.log("⚡ Indexing Prod ID and Dev ID pairs from sheet [1071]...");
    const response1071 = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "'1071'!A2:C", // Col A (Dev Id), Col B (Accession), Col C (Prod Id)
    });

    const rows1071 = response1071.data.values || [];
    const prodToDevMap = new Map<string, string>();

    for (const row of rows1071) {
      const devId = row[0]?.toString().trim();  // Column A
      const prodId = row[2]?.toString().trim(); // Column C
      
      if (prodId && devId) {
        prodToDevMap.set(prodId, devId);
      }
    }
    console.log(`✅ Successfully indexed ${prodToDevMap.size} unique ID mappings from [1071].\n`);

    // 4. Regex to find only Month tabs (e.g., "June 2026")
    const monthRegex = /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}$/i;
    let grandTotalUpdates = 0;

    // 5. Loop through each Month Tab
    for (const tab of sheetTabs) {
      const tabName = tab.properties?.title || "";
      if (!monthRegex.test(tabName)) continue; // Skip tabs like "1071" or "CCI-1064"

      console.log(`---------------------------------------------------`);
      console.log(`📂 Processing Monthly Tab: [${tabName}]`);
      console.log(`---------------------------------------------------`);

      // Fetch Column A through E to get Prod IDs, Dev IDs, Accession Numbers, and Company Names
      const responseMonth = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `'${tabName}'!A2:E`, 
      });

      const monthRows = responseMonth.data.values || [];
      const dataToUpdate: { range: string; values: any[][] }[] = [];
      
      // Tracking arrays for auditing mismatches
      const unmappedRows: string[] = [];
      const duplicateProdIds = new Set<string>();
      const seenProdIds = new Set<string>();

      for (let index = 0; index < monthRows.length; index++) {
        const row = monthRows[index];
        const prodId = row[0]?.toString().trim();      // Col A: Prod Id
        const currentDevId = row[1]?.toString().trim();  // Col B: Dev Id
        const companyName = row[4]?.toString().trim() || "Unknown Company"; // Col E: Company Name
        
        // Row index in Google Sheets is 1-based, and we skipped the header row (+2 offset)
        const currentSheetRow = index + 2;

        if (!prodId) continue;

        // Check for duplicate Prod IDs in this monthly sheet
        if (seenProdIds.has(prodId)) {
          duplicateProdIds.add(prodId);
        } else {
          seenProdIds.add(prodId);
        }

        // Check if this Prod ID exists in our 1071 index
        if (prodToDevMap.has(prodId)) {
          const targetDevId = prodToDevMap.get(prodId)!;

          // Only prepare update if the cell is blank or has the wrong ID
          if (currentDevId !== targetDevId) {
            dataToUpdate.push({
              range: `'${tabName}'!B${currentSheetRow}`, // Target the exact Dev Id cell in Column B
              values: [[targetDevId]],
            });
            grandTotalUpdates++;
          }
        } else {
          // Keep track of rows that could not be mapped to the 1071 sheet
          unmappedRows.push(`Row ${currentSheetRow} | Prod ID: ${prodId} | Company: ${companyName}`);
        }
      }

      // 6. Write Updates (Batch Update to avoid API rate limit throttling)
      if (dataToUpdate.length > 0) {
        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          requestBody: {
            data: dataToUpdate,
            valueInputOption: "RAW",
          },
        });
        console.log(`   🟢 Successfully filled ${dataToUpdate.length} missing Dev IDs.`);
      } else {
        console.log("   🟢 All existing Dev IDs are up-to-date.");
      }

      // 7. Print Audit Findings (Why you have a mismatch in row counts)
      if (duplicateProdIds.size > 0) {
        console.log(`   ⚠️ Duplicates Found: The following Prod IDs appear multiple times in [${tabName}]:`);
        duplicateProdIds.forEach(id => console.log(`      - Duplicate Prod ID: ${id}`));
      }

      if (unmappedRows.length > 0) {
        console.log(`   🚨 Unmapped Cases Found: The following rows do NOT exist in the [1071] master sheet:`);
        unmappedRows.forEach(log => console.log(`      - ${log}`));
      }
    }

    console.log(`\n===================================================`);
    console.log(`🎉 Sync completed! Populated a total of ${grandTotalUpdates} Dev ID cells.`);
    console.log(`===================================================`);

  } catch (error: any) {
    console.error("❌ Process crashed:", error.message);
  }
}

main();