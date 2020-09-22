import { ISheet, Charts, DriveUtils, SpreadsheetApp, ISpreadsheet, SheetUtils, Logger, ISheetRange, SpreadsheetAppUtils } from './utils-google'
import { KeyValueMap, parseFloatOrAny, parseFloatOrDefault, toObject } from './utils'
import { Aggregation, AggregationDefinition } from './aggregation'
import { Timeseries } from './timeseries'

export class Budgeteer {
    static fillWithTotalAmounts(sheet: ISheet, transactionSheetSrc: ISheet) {
        //Get data from Transactions spreadsheet:
        // const ss = this.transactionSpreadsheet;
        const txSheet = transactionSheetSrc; //ss.getSheets()[0];
        let columns = SheetUtils.getHeaderColumnsAsObject(txSheet);
        let data = txSheet.getDataRange().getValues();
        data = data.slice(1);

        //var rxFilter = null; //new Regexp("");
        //var filters = Timeseries.createFilters(columns, rxFilter, ss.getSheetByName('filter_accounts'), ss.getSheetByName('filter_tx'));
        //data = applyFilters(data, filters);

        //Create aggregate by year and account { <year>: { <account>: <sum>...}...}
        const aggregateDef: AggregationDefinition = { col: columns.Amount, name: 'Sum', func: (v, p) => (parseInt(v, 10) || 0) + (p || 0) };
        const aggregated = Aggregation.aggregateRows(data, [
            { col: columns.Date, name: 'Year', func: v => new Date(v).getFullYear() },
            { col: columns.AccountId, name: 'Account', func: v => v },
        ], aggregateDef, false);

        //Insert into year columns of Konton spreadsheet:
        columns = SheetUtils.getHeaderColumnsAsObject(sheet);

        const rowIndexToAccountId = Budgeteer.getRowIndexToAccountId(sheet, columns.Konto);
        const years = Object.keys(columns).filter(k => k.length == 4)
            .map(k => parseFloat(k)).filter(k => !!k);

        const numRows = sheet.getDataRange().getHeight();

        years.forEach(year => {
            const byAccount = aggregated[year];
            if (!byAccount) {
                Logger.log("No aggregated data for year " + year);
                return;
            }

            // const yearColIndex = columns[year.toString()];
            for (let rowIndex = 1; rowIndex < numRows; rowIndex++) {
                const accountId = rowIndexToAccountId[rowIndex];
                const cell = sheet.getRange(rowIndex + 1, columns[year.toString()] + 1).getCell(1, 1);
                cell.setValue(accountId ? (byAccount[accountId] || "") : "");
            }
        });
    }
    static getRowIndexToAccountId(sheet: ISheet, accountIdColumnIndex: number) {
        //row index 1 = first row under header row
        const result: KeyValueMap<number> = {};

        const numRows = sheet.getDataRange().getHeight();
        const range = sheet.getRange(2, accountIdColumnIndex + 1, numRows);
        for (let i = 1; i < numRows; i++) {
            const cellVal = range.getCell(i, 1).getValue();
            const accountId = parseFloat(cellVal);
            if (isNaN(accountId) || !accountId) { //!!accountId && accountId != " " && !isNaN(parseFloat(accountId))) {
                break; // Stop when we're through top porting
            }
            result[i.toString()] = accountId;
        }
        return result;
    }
    // static getAccountIdToRowIndex(sheet: ISheet, accountIdColumnIndex: number) {
    //     const r2a = Budgeteer.getRowIndexToAccountId(sheet, accountIdColumnIndex);
    //     const result: KeyValueMap<number> = {};
    //     Object.keys(r2a).forEach(k => result[r2a[k].toString()] = parseFloat(k));
    //     return result;
    // }

    static runCollect(budgetFolder: string) {
        const budgetRows = Budgeteer.collectFromResponsibilitySheets(budgetFolder);

        const filtered = Budgeteer.filterCollectedBudgetRows(budgetRows);

        // transfer to main sheet
        const columns = toObject(budgetRows[0], (v, i) => [v, i]);
        //Konto	Datum	Summa
        const accountTranslation = new Map<number, number>([[41180, 41170], [46401, 46400], [46430, 46400]]);
        // const accountTranslation = { 41180: 41170, 46401: 46400, 46430: 46400 };
        const aggregateDef: AggregationDefinition = { col: columns.Summa, name: 'Sum', func: (v, p) => (parseInt(v, 10) || 0) + (p || 0) };
        const aggregated = Aggregation.aggregateRows(filtered, [
            { col: columns.Konto, name: 'Konto', func: v => <string | number>(accountTranslation.get(parseFloat(v.toString())) || v) },
        ], aggregateDef, false);

        const orgSheet = SpreadsheetAppUtils.MySpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
        //var orgSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Copy of Sheet1");
        const orgRows = orgSheet.getDataRange().getValues();
        const orgCols = toObject(orgRows[0], (v, i) => [v, i]);
        const aaaa = orgRows
            .map((r, i) => ({ rowIndex: i, account: parseFloat(r[columns.Konto]) }))
            .filter(o => !isNaN(o.account));
        const accountIdToRowIndex = toObject(aaaa, (v, i) => [v.account, v.rowIndex]);
        const missingAccounts = Object.keys(aggregated).filter(k => !accountIdToRowIndex[k])
        if (missingAccounts.length) {
            throw "Missing account translations: " + missingAccounts.join(", ");
        }

        const colForBudget = orgCols["Budget 2020"]; //TODO: find automatically
        Object.keys(aggregated).forEach(accountId => {
            const rIndex = accountIdToRowIndex[accountId];
            const cell = orgSheet.getRange(rIndex + 1, colForBudget + 1).getCell(1, 1);
            cell.setValue(aggregated[accountId]);
        });
        //Set a red 0 in cells that don't have aggregate value but a person responsible:
        const unusedAccounts = Object.keys(accountIdToRowIndex).filter(account => aggregated[account] == null);
        Logger.log(unusedAccounts);
        unusedAccounts.forEach(account => {
            var rIndex = accountIdToRowIndex[account];
            if (orgRows[rIndex][orgCols.Ansvar].length > 0) {
                var cell = orgSheet.getRange(rIndex + 1, colForBudget + 1).getCell(1, 1);
                cell.setValue("MISSING");
                cell.setFontColor('#aa0000');
            }
        });

        let summaryRows = Budgeteer.summarizeBudgetRows(filtered);
        const tmpStrangeTypeError = <(string | number)[][]>[[], [], ["Account series summaries"]];
        summaryRows = tmpStrangeTypeError.concat(summaryRows);
        const collectedTargetSheet = SheetUtils.getOrCreateSheet("Collected", true, SpreadsheetAppUtils.MySpreadsheetApp.getActiveSpreadsheet());
        SheetUtils.fillSheet(collectedTargetSheet, budgetRows.concat(summaryRows), 0, 0);
    }

    static collectFromResponsibilitySheets(budgetFolder: string) {
        // Collect rows from each responsibility spreadsheet and enter into target sheet
        const folder = DriveUtils.getSingleFolder(budgetFolder);
        const filePrefix = "Budget ";
        const files = DriveUtils.getFilesInFolder(folder, file => file.getName().indexOf(filePrefix) == 0);
        const textForUserEditStart = "---BUDGET---";
        let allRows: any[][] = [];
        files.forEach(file => {
            const spreadsheet = SpreadsheetAppUtils.MySpreadsheetApp.open(file);
            const sheet = spreadsheet.getSheets()[0];
            const foundUserEditRowIndex = sheet.getDataRange().getValues().reduce((res, row, index) =>
                res >= 0 ? res : (row[0] === textForUserEditStart ? index : -1)
                , -1);
            const responsibility = file.getName().substr(filePrefix.length);
            const rows = sheet.getDataRange().getValues()
                .slice(foundUserEditRowIndex + 1 + (allRows.length == 0 ? 0 : 1)); //Include header first time
            rows.forEach(r => {
                // Always treat them as costs regardless of sign
                if (!!r[2] && !isNaN(parseFloat(r[2])) && parseFloat(r[2]) > 0) {
                    r[2] = -parseFloat(r[2]);
                }
                r[5] = responsibility;
            });
            // console.log(rows);
            allRows = allRows.concat(rows);
        });

        allRows = allRows.sort((a, b) => a[0] - b[0]);
        return allRows;
    }

    static filterCollectedBudgetRows(budgetRows: any[][]) {
        return budgetRows.filter(row => !isNaN(parseFloat(row[0])) && !isNaN(parseFloat(row[2])));
    }

    static summarizeBudgetRows(budgetRows: any[][]) {
        const summaries: KeyValueMap<number[]> = {};
        budgetRows.forEach(row => {
            const account = parseFloat(row[0]);
            if (!isNaN(account)) {
                const toSummarize = [account.toString().substr(0, 2), account.toString().substr(0, 1)];
                toSummarize.forEach(f => {
                    let vals = summaries[f];
                    if (!vals) {
                        vals = [];
                        summaries[f] = vals;
                    }
                    const val = row[2];
                    if (!!val && !isNaN(parseFloat(val)))
                        vals.push(parseFloat(val));
                })
            }
        });
        const summaryRows = Object.keys(summaries)
            .sort((a, b) => a.length != b.length ? a.length - b.length : (a > b ? 1 : -1))
            .map(k => [k, "", summaries[k].reduce((a, b) => a + b, 0)]
            );
        return summaryRows;
    }

    static fillBudgetRelative(kontonBudgetSheet: ISheet, year: number) {
        //actual expenditure relative to budget as percentage (mark as red or green)
        const columns = SheetUtils.getHeaderColumnsAsObject(kontonBudgetSheet);
        const budgetColumnIndex = columns[`Budget ${year}`];
        const actualColumnIndex = columns[`${year}`];
        const relativeColumnIndex = columns[`Rel ${year}`];
        if (relativeColumnIndex < 0 || actualColumnIndex < 0 || budgetColumnIndex < 0) return;

        const data = kontonBudgetSheet.getDataRange().getValues();
        for (let rIndex = 1; rIndex < data.length; rIndex++) {
            const row = data[rIndex];
            let budget = parseFloat(row[budgetColumnIndex]);
            let actual = parseFloat(row[actualColumnIndex]);

            budget = isNaN(budget) ? 0 : budget;
            actual = isNaN(actual) ? 0 : actual;
            if (budget == 0 && actual == 0) continue;

            const rel = budget == 0 ? 9 : actual / budget;

            const cell = kontonBudgetSheet.getRange(rIndex + 1, relativeColumnIndex + 1).getCell(1, 1);
            cell.setValue(budget == 0 ? 'MAX' : Math.round(100 * rel));
            cell.setFontColor(rel > 1 ? '#aa0000' : "#00aa00");
        }
    }

    static fillFromResultatRakning(kontonBudgetSheet: ISheet, exportedResultatRakning: ISheet, budgetYear: number) {
        const columns = SheetUtils.getHeaderColumnsAsObject(kontonBudgetSheet);
        //2018	2019	2020	Budget 2020	Rel 2020
        //const year = new Date().getFullYear();
        const columnBudgetName = `Budget ${budgetYear}`;
        const rr2kontonCols: any = { budget: columns[columnBudgetName], current: columns[`${budgetYear}`], previous: columns[`${budgetYear - 1}`]};
        // remove if missing columns
        Object.keys(rr2kontonCols).forEach(k => { if (rr2kontonCols[k] === undefined) delete rr2kontonCols[k]; })
        const rrByAccountId = ResultatRakning.getRowsByAccountId(exportedResultatRakning);
        const data = kontonBudgetSheet.getDataRange().getValues();
        for (let rIndex = 0; rIndex < data.length; rIndex++) {
            const row = data[rIndex];
            const accountId = parseFloat(row[columns.Konto]);
            if (accountId > 0) {
                const fromRR = rrByAccountId[accountId];
                if (!!rrByAccountId[accountId]) {
                    Object.keys(rr2kontonCols).forEach(k => {
                        const val = (<any>rrByAccountId[accountId])[k];
                        const cell = kontonBudgetSheet.getRange(rIndex + 1, rr2kontonCols[k] + 1).getCell(1, 1);
                        cell.setValue(val == null ? "" : val); //Overwrite with empty string when null
                    });
                }
            }
        }
    }


    static createChart(sheet: ISheet, range: ISheetRange, title: string, chartNum: number) {
        const size = { width: 1300, height: 700 };
        const leftChartArea = 10;
        const posXY = { x: chartNum % 2, y: Math.floor(chartNum / 2) };
        const chart = sheet.newChart()
            .setChartType(Charts.ChartType.LINE)
            .addRange(range) //rangesList[0])
            .setNumHeaders(1)
            .setPosition(1, 1, 10 + (size.width / 2) * posXY.x, 10 + (size.height / 2) * posXY.y)
            .setOption('width', size.width / 2)
            .setOption('height', size.height / 2)
            .setOption('chartArea', { left: leftChartArea.toString() + '%', top: '8%', width: (100 - leftChartArea - 2).toString() + "%", height: "85%" })
            .setOption('title', title)
            .setOption('legend', { position: 'top' })
            .build(); //textStyle: {color: 'blue', fontSize: 16}

        sheet.insertChart(chart);
    }

    static fillResponsibilitySpreadsheets(
        kontonSpreadsheet: ISpreadsheet, 
        transactionSpreadsheet: ISpreadsheet, 
        filterResponsibilities?: string[],
        folderForSpreadsheets: string = "Budget2021")
        {
        const ss = transactionSpreadsheet;
        const txSheet = ss.getSheets()[0];
        let txData = txSheet.getDataRange().getValues();

        let txColumns = SheetUtils.getHeaderColumnsAsObject(txSheet);
        //Remove unnecessary columns //Not "Missing", important info!
        const clutterColumns = "InvoiceId	ReceiptId	CurrencyDate	TransactionText	TransactionRef".split('\t');
        const clutterColumnIndices = clutterColumns.map(function (c) { return txColumns[c]; });
        for (let ri = 0; ri < txData.length; ri++) {
            txData[ri] = txData[ri].filter((c, i) => clutterColumnIndices.indexOf(i) < 0);
        }
        const txHeaderRow = txData[0];
        txColumns = toObject(txHeaderRow, (cell, i) => [cell, i]); //Re-index columns
        txData = txData.slice(1);

        const sheet = kontonSpreadsheet.getSheets()[0]; //SpreadsheetAppUtils.MySpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
        const columns = SheetUtils.getHeaderColumnsAsObject(sheet);

        const data = sheet.getDataRange().getValues();
        const byResponsibility = Budgeteer.getRowsPerResponsibility(data, columns.Ansvar);

        for (let role in byResponsibility) {
            //"Tak och plåt", "Kassör", "Sekreterare","Ordförande", "Utemiljö", "Förvaltarkontakt", "Reparationer", "Ventilation och värme", "Fasader och fönster", "Asfalt"
            if (filterResponsibilities && filterResponsibilities.indexOf(role) < 0) { 
                Logger.log("Skip " + role); 
                continue;
             }
            // Logger.log("Role: " + role);

            const file = DriveUtils.getOrCreateSpreadsheet("Budget " + role, folderForSpreadsheets);
            const spreadsheet = SpreadsheetAppUtils.MySpreadsheetApp.open(file);
            let targetSheet = spreadsheet.getSheets()[0];

            //Get or create user-filled rows:
            const textForUserEditStart = "---BUDGET---";
            const foundUserEditRowIndex = targetSheet.getDataRange().getValues().reduce(function (res, row, index) {
                return res >= 0 ? res : (row[0] === textForUserEditStart ? index : -1);
            }, -1);
            let additionalRows = [[""]];
            if (foundUserEditRowIndex >= 0) {
                // Logger.log('found existing rows starting at ' + foundUserEditRowIndex); //targetSheet.getDataRange().getValues()[foundUserEditRowIndex]);
                additionalRows = additionalRows.concat(targetSheet.getDataRange().getValues().slice(foundUserEditRowIndex));
            } else {
                additionalRows = additionalRows.concat([[textForUserEditStart, "Ändra ej denna och nästa rad, används för automatisk inläsning"],
                ["Konto", "Datum", "Summa", "Mottagare", "Kommentar"],
                ["11100", "2019-12-01", "0", "Firma AB", "Julgranspynt"]
                ]);
            }

            //Join account total rows with used-data rows and fill sheet:
            let rowsWithHeader = [data[0]].concat(byResponsibility[role]);
            rowsWithHeader = rowsWithHeader.concat(additionalRows);

            targetSheet.getDataRange().clearContent();
            SheetUtils.fillSheet(targetSheet, rowsWithHeader);

            //Get relevant rows from Transactions sheet (based on accountIds):
            const accountIds = byResponsibility[role].map(row => row[columns.Konto]);
            const accountIdToName = toObject(byResponsibility[role], function (row) { return [row[columns.Konto], row[columns.Namn]]; });

            const rxFilter = new RegExp("^(" + accountIds.join("|") + ")")
            const filters = Timeseries.createFilters(txColumns, rxFilter);
            let txDataForResp = Budgeteer.applyFilters(txData, filters);

            if (false) { //Nah, better the user filters themselves
                // //Order by accountId, then by date
                // var fSort = (a, b) => {
                //     if (a[txColumns.AccountId] > b[txColumns.AccountId]) return 1;
                //     if (a[txColumns.AccountId] < b[txColumns.AccountId]) return -1;
                //     if (a[txColumns.Date] > b[txColumns.Date]) return -1;
                //     if (a[txColumns.Date] < b[txColumns.Date]) return 1;
                //     return 0;
                // }
                // txDataForResp.sort(fSort);
            }
            targetSheet = SheetUtils.getOrCreateSheet("Transaktioner", true, spreadsheet);
            txDataForResp = [txHeaderRow].concat(txDataForResp);
            SheetUtils.fillSheet(targetSheet, txDataForResp);

            // Budgeteer.createChartSheet(spreadsheet, targetSheet, accountIds);
        }
    }

    static createChartSheet(spreadsheet: ISpreadsheet, transactionSheet: ISheet, accountIds: number[], txColumns: KeyValueMap<number>, accountIdToName: KeyValueMap<any>) {
        //Create multiple tables (one for each account, with lines for each year) in same sheet - create chart for each table
        const chartSheet = SheetUtils.getOrCreateSheet("Graf", true, spreadsheet);
        let rowIndex = 0;
        const chartSources: { accountId: number, rowStart: number, rowCount: number, colCount: number }[] = [];
        for (var i = 0; i < accountIds.length; i++) {
            const accountId = accountIds[i];
            const filters = Timeseries.createFilters(txColumns, new RegExp("^" + accountId), undefined, undefined);
            const inYear = Timeseries.recalc(transactionSheet, 2, undefined, undefined, filters);
            //TODO: only add if there's any actual data (inYear will have 365 rows regardless of data)

            if (inYear.length > 0) {
                SheetUtils.fillSheet(chartSheet, inYear, rowIndex, 0);
                chartSources.push({ accountId: accountId, rowStart: rowIndex, rowCount: inYear.length, colCount: inYear[0].length });
                rowIndex += inYear.length;
            }
        }

        chartSheet.getCharts().forEach(chart => chartSheet.removeChart(chart));

        Logger.log("Add charts " + chartSources.length);
        for (let chartIndex = 0; chartIndex < chartSources.length; chartIndex++) {
            const src = chartSources[chartIndex];
            Logger.log("Chart range: " + src.accountId + " " + src.rowStart + " " + src.rowCount + " " + src.colCount);
            Budgeteer.createChart(chartSheet, chartSheet.getRange(src.rowStart + 1, 1, src.rowCount, src.colCount), '' + src.accountId + ' ' + accountIdToName[src.accountId], chartIndex);
        }
    }

    static applyFilters(dataToFilter: any[][], funcFilters: Array<(row: any[][]) => any[][]>) {
        if (funcFilters) {
            // Logger.log('filtering started: ' + dataToFilter.length);
            funcFilters.forEach(f => dataToFilter = f(dataToFilter));
            // Logger.log('after filtering: ' + dataToFilter.length);
        }
        return dataToFilter;
    }

    static getRowsPerResponsibility(dataWithHeader: any[][], responsibilityColumn: number) {
        const byResponsibility: KeyValueMap<any[]> = {};
        for (let i = 1; i < dataWithHeader.length; i++) {
            const row = dataWithHeader[i];
            const responsibility = row[responsibilityColumn].toString();
            if (responsibility.length <= 1) continue;
            let list = byResponsibility[responsibility];
            if (!list) {
                list = [];
                byResponsibility[responsibility] = list;
            }
            list.push(row);
        }
        return byResponsibility;
    }
}

export interface ResultatRapportRow {
    account: number;
    current: number;
    previous: number | null;
    budget: number | null;
}

export class ResultatRakning {
    static getRowsByAccountId(exportedResultatRakning: ISheet) {
        const rows = ResultatRakning.getTypedRows(exportedResultatRakning);
        return <KeyValueMap<ResultatRapportRow>>toObject(rows, row => [row.account, row]);
    }

    static getTypedRows(exportedResultatRakning: ISheet): ResultatRapportRow[] {
        //Get from SBC export
        let data = exportedResultatRakning.getDataRange().getValues();
        const headerRowIndex = 2;
        data = data.slice(headerRowIndex);
        const columns = toObject(data[0], (val, index) => [val, index]);
        // Remove header row:
        data = data.slice(1);
        const rxStartWithAccount = /^\d{5}/;

        const result: ResultatRapportRow[] = [];
        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const acc = parseFloatOrDefault(rxStartWithAccount.exec(row[0])?.toString(), 0);
            if (acc == 0) continue;
            result.push(<ResultatRapportRow>{ 
                account: acc, 
                current: parseFloatOrAny(row[columns["Utfall ack"]], null),
                previous: parseFloatOrAny(row[columns["Utfall fgå ack"]], null),
                budget: parseFloatOrAny(row[columns["Budget ack"]], null)
            });
        }
        return result;
        // data.map(row => ({account: rxStartWithAccount.exec(row[0])?.toString(), row: row}))
        //     .filter(row => !!row.account).map(row => { account:});
        // const cols = "Utfall ack	Budget ack	Utfall fgå ack".split("\t");
        // const cc = { "Utfall ack": "current", "Budget ack": "budget", "Utfall fgå ack": "previous"};
        // const accountToBudget = toObject(data, row => {
        //     const props = toObject(cols.map(c => [c, parseFloat(row[columns[c]])]));
        //     // return [row[0], props];
        //     const val = parseFloat(row[columns['Budget ack']]);
        //     return [(rxStartWithAccount.exec(row[0]) || "").toString(), isNaN(val) ? 0 : val];
        // });
        // return accountToBudget;
    }
}