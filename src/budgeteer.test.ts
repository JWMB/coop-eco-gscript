import { Budgeteer } from './budgeteer'
import { DriveUtils, SpreadsheetAppUtils } from './utils-google';
import { KeyValueMap } from './utils'
import { MockDriveApp, MockFolder } from './google.drive.mocks';
import { MockSheet, MockSpreadsheet, MockSpreadsheetApp } from './google.spreadsheet.mocks';

describe('Budget', () => {
    it('works', () => {
        const rootFolder = MockFolder.createTree({ 
            files: { "tjohoox": null },
            folders: { 
                "Budget": {
                    id: "xxx",
                    files: {
                        "190111 Resultaträkning": { id: "123", data: new MockSpreadsheet([ 
                            new MockSheet("0", tsvToRows(rrExport)) ]) },
                        "Transaktioner": { data: new MockSpreadsheet([
                            new MockSheet("0", tsvToRows(transactionData)) ]) }
                    }
                }
            }
        });
        DriveUtils.MyDriveApp = new MockDriveApp(rootFolder);
        SpreadsheetAppUtils.MySpreadsheetApp = new MockSpreadsheetApp(DriveUtils.MyDriveApp);

        const xsheet = new MockSheet("0", tsvToRows(someonesBudget));
        const roror = Budgeteer.getAccountIdToRowIndex(xsheet, 0, true);
        console.log(roror);
        //Budgeteer.fillWithTotalAmounts(xsheet, SpreadsheetAppUtils.openByName("Transaktioner").getSheets()[0]);
        //console.log(xsheet.rows);
        
        // const filename = "190111 Resultaträkning";
        // const file = DriveUtils.getFileInFolder(filename, "Budget");
        // expect(file).toBeTruthy();
        // const spreadsheet = SpreadsheetAppUtils.MySpreadsheetApp.open(<IFile>file);
        // expect(spreadsheet).toBeTruthy();
        // const budgetVals = Budgeteer.getBudgetValues(filename);
        // expect(budgetVals["30110"]).toBe(7593000)
        // console.log(budgetVals);

        // const filtered = Budgeteer.applyFilters(rows, [
        //     data => data.filter(r => r[0].toString().indexOf("41") == 0), 
        //     data => data.filter(r => r[1].toString() == "2242")]);
        // expect(filtered.length).toBe(1);

        // const result = Budgeteer.getRowsPerResponsibility(rows, rows[0].indexOf("Ansvar"));
        // const numRowsPerResp = Object.keys(result).map(k => [k, result[k].length]);

        // expect(numRowsPerResp).toStrictEqual([
        //     ["Förvaltarkontakt", 2],
        //     ["Utemiljö", 7],
        //     ["Ordförande", 1],
        //     ["Ventilation och värme", 2],
        //     ["Reparationer", 3],
        // ]);

        // const spreadSheet = new MockSpreadsheet();
        // const budgeteer = new Budgeteer(spreadSheet);
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
const someonesBudget = `Konto	2019	2020	Budget 2020	Rel 2020	Namn	Ansvar	Kommentar	Kommentar 2
46100					El Taxebundna kostnader	Asfalt	Ej av SBC "godkänt" konto	
65500					Konsultarvode Övriga externa tjänster	Asfalt	Ej av SBC "godkänt" konto	
								
---BUDGET---	Ändra ej denna och nästa rad, används för automatisk inläsning							
Konto	Datum	Summa	Mottagare	Kommentar				
45640	2020-06-01	1000000		Etapp 1/4 - Kvalificerad gissning tillsammans med kvadratmeterpriser vi fått av JE mark och gamla offerter för asfaltering av hela området som ger den siffran				
45613	2020-06-01	20000		Besiktiga murar				
45613	2020-06-01	0		Inte än: 220000 (från underhållsplan)				`;

const transactionData = `Date	Missing	Amount	Supplier	AccountId	AccountName	Comments	InvoiceId	ReceiptId	CurrencyDate	TransactionText	TransactionRef
2020-07-28 0:00:00		7,937.00							2020-07-29 0:00:00	56901309 00105	6091 BGINB
2020-07-28 0:00:00		24,783.00							2020-07-29 0:00:00	56901309 00104	6091 BGINB
2020-07-28 0:00:00		-125.00	Com Hem AB	47600	Kabel-TV Övriga driftkostnader		6395366	L6297   5589     1	2020-07-28 0:00:00	LB UTTAG	6091 LB32
2020-07-27 0:00:00		30,855.00							2020-07-28 0:00:00	56901309 00103	6091 BGINB`; 

const rrExport =
`Resultaträkning							
Kund: 6297 Riksrådsvägen | Valt år: 2019 19/20 | Vald period: December							
	Utfall vald period	Budget vald period	Utfall ack	Budget ack	Utfall fgå ack	Ansvar	SBC:s beskrivning
30110 Årsavgifter		632,750	5,683,526	7,593,000	7,576,109		
30210 Hyror bostäder		48,750	446,129	585,000	584,988		
30230 Hyror lokaler		500	4,863	6,000	6,386		
30251 Hyror parkering		28,167	235,825	338,000	189,950		
Summa Årsavgifter och hyror		710,167	6,370,343	8,522,000	8,357,433		
`;

const konton = `Konto	2018	2019	Budget 2019	Rel 2019	Budget 2020	Namn	Ansvar
11820						Pågående om- och tillbyggnad	
12110						N/A	
15210						N/A	
16889						N/A	
19710						N/A	
23501	-1500000			MAX		N/A - Handelsbanken	
28990						N/A - Inre fond?	
37400			0			Öresutjämning	
41100		4781				Fastighetsskötsel entreprenad Fastighetsskötsel och städning	
41110		10046	0	MAX	-60000	Fastighetsskötsel beställning Fastighetsskötsel och städning	Förvaltarkontakt
41150	17375		0		0	Fastighetsskötsel gård entrep Fastighetsskötsel och städning	Utemiljö
`;
