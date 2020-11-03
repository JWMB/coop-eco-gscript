import { Budgeteer, ResultatRakning } from './budgeteer'
import { DriveUtils, SpreadsheetAppUtils } from './utils-google';
import { KeyValueMap } from './utils'
import { MockDriveApp, MockFileSystemObject, MockFolder } from './google.drive.mocks';
import { MockSheet, MockSpreadsheet, MockSpreadsheetApp } from './google.spreadsheet.mocks';
import { konton, previousCollected, rrExport, someonesBudget, transactionData } from './budgeteer.testdata';

function setupFileStructure() {
    const rootFolder = MockFolder.createTree({ 
        files: { "tjohoox": null },
        folders: { 
            "Budget": {
                files: {
                    "190111 Resultaträkning": { content: new MockSpreadsheet([ 
                        new MockSheet("0", tsvToRows(rrExport)) ]) },
                    "Transaktioner": { content: new MockSpreadsheet([
                        new MockSheet("0", tsvToRows(transactionData)) ]) },
                    "Konton": { content: new MockSpreadsheet([
                        new MockSheet("0", tsvToRows(konton)),
                        new MockSheet("Collected 2020", tsvToRows(previousCollected)),
                    ]) }
                },
                folders: {
                    "Budget2021": {
                        files: {
                            "Budget Utemiljö": { content: new MockSpreadsheet([ 
                                new MockSheet("0", tsvToRows(someonesBudget)) ]) },
                        }
                    }
                }
            }
        }
    });
    DriveUtils.MyDriveApp = new MockDriveApp(rootFolder);
    (<any>SpreadsheetAppUtils).MySpreadsheetApp = new MockSpreadsheetApp(DriveUtils.MyDriveApp);
}

beforeEach(() => {
    setupFileStructure();
});

describe('Budget', () => {
    it('resultatrakning_rows', () => {
        const budgetVals = ResultatRakning.getRowsByAccountId(SpreadsheetAppUtils.openSheet("190111 Resultaträkning"));
        expect(budgetVals["30110"].budget).toBe(7593000);
        const row41100 = budgetVals["41100"];
        expect(row41100.previous).toBe(9994);
        expect(row41100.current).toBe(9992);
        expect(row41100.budget).toBe(9993);
    });

    it('resultatrakning_to_konton', () => {
        const kontoSheet = SpreadsheetAppUtils.openSheet("Konton");
        Budgeteer.fillFromResultatRakning(kontoSheet, SpreadsheetAppUtils.openSheet("190111 Resultaträkning"), 2020);
        const kontoData = kontoSheet.getDataRange().getValues();

        expect(kontoData[0].slice(0, 7)).toStrictEqual(["Konto", 2018, 2019, 2020, "Budget 2020", "Rel 2020", "Budget 2021"]); //	SBC Konto

        const kontoRow41100 = kontoData.filter(r => r[0].toString().indexOf("41100") == 0)[0];
        expect(kontoRow41100.slice(2, 5)).toStrictEqual([9994, 9992, 9993]);

        // Overwrite with defaults when no data in resultaträkning:
        const kontoRow41160 = kontoData.filter(r => r[0].toString().indexOf("41160") == 0)[0];
        expect(kontoRow41160.slice(2, 5)).toStrictEqual(["", 0, ""]);
    });

    it('konton_budget_relatives', () => {
        const kontoSheet = SpreadsheetAppUtils.openSheet("Konton");
        Budgeteer.fillBudgetRelative(kontoSheet, 2019); // "2020", "Budget 2020", "Rel 2020");
        const kontoData = kontoSheet.getDataRange().getValues();
        const kontoRow41100 = kontoData.filter(r => r[0].toString().indexOf("41100") == 0)[0];
        // TODO:
    });

    it('fillResponsibilityTotals', () => {
        const xsheet = new MockSheet("0", tsvToRows(someonesBudget));
        const accountId2Row = Budgeteer.getRowIndexToAccountId(xsheet, 0);
        expect(accountId2Row).toStrictEqual({'1': 46100, '2': 65500 });

        Budgeteer.fillWithTotalAmounts(xsheet, SpreadsheetAppUtils.openSheet("Transaktioner"));
        expect(xsheet.rows[1][2]).toBe(508);
        expect(xsheet.rows[2][2]).toBe(-17631);
    });

    it('getRowsPerResponsibility', () => {
        const kontoData = SpreadsheetAppUtils.openSheet("Konton").getDataRange().getValues();
        const rowsPerResp = Budgeteer.getRowsPerResponsibility(kontoData, kontoData[0].indexOf("Ansvar"));
        const numRowsPerResp = Object.keys(rowsPerResp).map(k => [k, rowsPerResp[k].length]);
        expect(numRowsPerResp).toStrictEqual([
            ["Förvaltarkontakt", 2],
            ["Utemiljö", 7],
            ["Ordförande", 1],
            ["Ventilation och värme", 2],
            ["Reparationer", 1],
        ]);
    });

    it('responsibilities', () => {
        const budgetFolderName = "Budget2021";
        //"Tak och plåt", "Kassör", "Sekreterare","Ordförande", "Utemiljö", "Förvaltarkontakt", "Reparationer", "Ventilation och värme", "Fasader och fönster", "Asfalt"

        Budgeteer.fillResponsibilitySpreadsheets(
            SpreadsheetAppUtils.openByName("Konton"), 
            SpreadsheetAppUtils.openByName("Transaktioner"), 
            budgetFolderName,
            SpreadsheetAppUtils.openSheet("Konton", null, "Collected 2020")
        ); //, ["Utemiljö", "Förvaltarkontakt", "Ordförande"]);

        const files = DriveUtils.getFilesInFolderName(budgetFolderName);
        expect(files.map(f => f.getName())).toStrictEqual(
            ["Budget Utemiljö", "Budget Förvaltarkontakt", "Budget Ordförande", "Budget Ventilation och värme", "Budget Reparationer"]);
        
        const spreads = files.map(f => SpreadsheetAppUtils.openByName(f.getName()));
        expect(spreads.map(s => s.getSheets().length)).toStrictEqual(spreads.map(s => 3));

        const budgetUte = SpreadsheetAppUtils.openByName("Budget Utemiljö");
        const budgetUteData = budgetUte.getSheets()[0].getDataRange().getValues();
        expect(budgetUteData[0]).toStrictEqual(["Konto", 2018, 2019, 2020, "Collected 2020", "Budget 2020", "Rel 2020", "Budget 2021", "Namn", "Ansvar", "Kommentar"]);
        const totalsRow = budgetUteData.filter(r => r[0] == "TOTAL")[0];
        expect(totalsRow).toStrictEqual([ 'TOTAL', -237254, -166474, 0, -169500, -228000, 182, -315500, '', '', '' ]);

        const row2 = budgetUte.getSheets()[1].getDataRange().getValues()[1];
        expect(row2.slice(0,4)).toStrictEqual(["2020-07-20 0:00:00", "",  -17796, "TrädgårdsHuset"]);

        expect(budgetUte.getSheets()[2].getDataRange().getValues().length).toBe(8);


        const kontonSSheet = SpreadsheetAppUtils.openByName("Konton");

        const collectedBudgets = Budgeteer.collectFromResponsibilitySheets(budgetFolderName);
        expect(collectedBudgets[0][0]).toBe("Konto");
        console.log(collectedBudgets);
        // all roles except Utemiljö (b/c specifically defined document) should only have defaults (11110 Firma AB etc)
        const defaultRow = Budgeteer.budgetDefaultResponsibility[1];
        const defaultRows = collectedBudgets.filter(r => r[0] == defaultRow[0]);
        expect(defaultRows.length).toBe(files.length - 1);

        Budgeteer.writeToCollectedSheet(collectedBudgets, kontonSSheet)
        const collectedRows = kontonSSheet.getSheetByName("Collected").getDataRange().getValues();
        // console.log(collectedRows);
        expect(collectedRows[0].length).toBe(6);

        const utemiljoRows = collectedBudgets.slice(1).filter(r => r[0] != defaultRow[0]);
        expect(utemiljoRows.length).toBe(3);

        expect(() => Budgeteer.updateKontonSheet(collectedBudgets, kontonSSheet, "Budget 2020")).toThrow();

        Budgeteer.updateKontonSheet(collectedBudgets, kontonSSheet, "Budget 2020", account => account != 11100);
        const filledSheet = kontonSSheet.getSheets()[0].getDataRange().getValues();
        expect(filledSheet[1][0]).toBe(45613);
        expect(filledSheet[1][4]).toBe(-20000);
        expect(filledSheet[2][0]).toBe(45640);
        expect(filledSheet[2][4]).toBe(-1000000);
    })
});

function toNumericOrString(val: any): string | number {
    if (typeof val === "string") {
        const noCommas = val.replace(/,/g, "").trim();
        const num = parseFloat(noCommas);
        if (!isNaN(num) && num.toString().length >= noCommas.length - 3) {
            return num;
        }
    }
    return val;
}

function tsvToRows(data: string) {
    return data.split('\n').map(r => r.split('\t').map(c => toNumericOrString(c)));
}