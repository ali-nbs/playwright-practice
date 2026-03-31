import { google } from 'googleapis';
import path from 'path';

const SPREADSHEET_ID = '1WG7yXVN4RVwpKCGc41YHievOySO--3WPuHGr7nusnwc';
const SHEET_NAME = 'Automated Test Cases';
const KEY_FILE = path.resolve(process.cwd(), 'credentials.json');
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const SHEET_ID = 1395635342;

export const getColumnLetter = (column: number): string => {
    let letter = '';
    while (column >= 0) {
        letter = String.fromCharCode((column % 26) + 65) + letter;
        column = Math.floor(column / 26) - 1;
    }
    return letter;
};

export async function updateGoogleSheet(resultValue: string, identifier: string, failureLogs: string[] = [],) {
    const auth = new google.auth.GoogleAuth({ keyFile: KEY_FILE, scopes: SCOPES });
    const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() as any });

    const today = new Date();
    const dateStr = `${today.getMonth() + 1}/${today.getDate()}`;

    // 1. Fetch current data
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A1:Z100`,
    });

    const rows = response.data.values || [];
    const headers = rows[0] || [];
    const dateColIndex = 6; // Column G

    // 2. Insert new column logic
    if (headers[dateColIndex] !== dateStr) {
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            requestBody: {
                requests: [
                    {
                        insertDimension: {
                            range: {
                                sheetId: SHEET_ID,
                                dimension: "COLUMNS",
                                startIndex: dateColIndex,
                                endIndex: dateColIndex + 1
                            },
                            inheritFromBefore: false
                        }
                    },
                    {
                        updateCells: {
                            range: {
                                sheetId: SHEET_ID,
                                // FIXED: GridRange uses startColumnIndex and endColumnIndex
                                startColumnIndex: dateColIndex,
                                endColumnIndex: dateColIndex + 1
                            },
                            fields: 'userEnteredFormat(backgroundColor)'
                        }
                    }
                ]
            }
        });

        const newColLetter = getColumnLetter(dateColIndex);
        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_NAME}!${newColLetter}1`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [[dateStr]] },
        });
        await hideColumns();
    }

    // 3. Row finding logic
    let rowIndex = rows.findIndex(row => row[4] === identifier);

    if (rowIndex === -1) {
        rowIndex = rows.length;
        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_NAME}!E${rowIndex + 1}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [[identifier]] },
        });
    }

    // 4. Update Result and Status
    console.log("result value " , resultValue);
    console.log("faillure logs" , failureLogs , failureLogs.length);
    const hasInvalid =
        resultValue.toLowerCase().includes("invalid") || resultValue.toLowerCase().includes("failed") ||
        failureLogs.length > 0;
    const statusValue = hasInvalid ? "Fail" : "Pass";
    const statusBgColor = { red: 1, green: 1, blue: 1 };
    const bgColor = hasInvalid
        ? { red: 0.968, green: 0.8, blue: 0.8 }
        : { red: 0.8, green: 0.937, blue: 0.8 };

    await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
            requests: [
                {
                    updateCells: {
                        range: {
                            sheetId: SHEET_ID,
                            startRowIndex: rowIndex,
                            endRowIndex: rowIndex + 1,
                            startColumnIndex: dateColIndex,
                            endColumnIndex: dateColIndex + 1
                        },
                        rows: [{
                            values: [{
                                userEnteredValue: { stringValue: resultValue },
                                userEnteredFormat: {
                                    backgroundColor: bgColor,
                                    verticalAlignment: "TOP",
                                    wrapStrategy: "WRAP",
                                    textFormat: { fontSize: 9 }
                                }
                            }]
                        }],
                        fields: 'userEnteredValue,userEnteredFormat(backgroundColor,verticalAlignment,wrapStrategy,textFormat)'
                    }
                },
                {
                    updateCells: {
                        range: {
                            sheetId: SHEET_ID,
                            startRowIndex: rowIndex,
                            endRowIndex: rowIndex + 1,
                            startColumnIndex: 5,
                            endColumnIndex: 6
                        },
                        rows: [{
                            values: [{
                                userEnteredValue: { stringValue: statusValue },
                                userEnteredFormat: {
                                    backgroundColor: statusBgColor,
                                    horizontalAlignment: "CENTER",
                                    textFormat: {
                                        bold: true,
                                        foregroundColor: { red: 0, green: 0, blue: 0 }
                                    }
                                }
                            }]
                        }],
                        fields: 'userEnteredValue,userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)'
                    }
                }
            ]
        }
    });
}

export async function hideColumns() {
    const auth = new google.auth.GoogleAuth({ keyFile: KEY_FILE, scopes: SCOPES });
    const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() as any });

    // Fetch latest headers to get current positions
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!1:1`, // Only need the header row
    });

    const headers = response.data.values?.[0] || [];

    // 1. Start index is ALWAYS 7 (Column H) to leave G (Today) visible
    const startIndex = 7;

    // 2. Find the last date column index in the headers array
    // We iterate backwards to find the very last occurrence of a date
    let lastDateIndex = -1;
    for (let i = headers.length - 1; i >= 0; i--) {
        if (/^\d{1,2}\/\d{1,2}$/.test(headers[i])) {
            lastDateIndex = i;
            break;
        }
    }

    // If no historical dates exist to the right of G, exit
    if (lastDateIndex < startIndex) return;

    // 3. Set endIndex to lastDateIndex + 1 because it is EXCLUSIVE
    const endIndex = lastDateIndex + 1;

    await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
            requests: [
                {
                    updateDimensionProperties: {
                        range: {
                            sheetId: SHEET_ID,
                            dimension: "COLUMNS",
                            startIndex: startIndex, // Index 7 (Column H)
                            endIndex: endIndex      // The end of the date block
                        },
                        properties: {
                            hiddenByUser: true
                        },
                        fields: 'hiddenByUser'
                    }
                }
            ]
        }
    });
}