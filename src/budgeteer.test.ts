import { Budgeteer, ResultatRakning } from './budgeteer'
import { DriveUtils, SpreadsheetAppUtils } from './utils-google';
import { KeyValueMap } from './utils'
import { MockDriveApp, MockFileSystemObject, MockFolder } from './google.drive.mocks';
import { MockSheet, MockSpreadsheet, MockSpreadsheetApp } from './google.spreadsheet.mocks';

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
                        new MockSheet("0", tsvToRows(konton))]) }
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
        const kontoRow41100 = kontoData.filter(r => r[0].toString().indexOf("41100") == 0)[0];
        expect(kontoRow41100[2]).toBe(9994);
        expect(kontoRow41100[3]).toBe(9992);
        expect(kontoRow41100[4]).toBe(9993);
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
            SpreadsheetAppUtils.openByName("Transaktioner"), budgetFolderName); //, ["Utemiljö", "Förvaltarkontakt", "Ordförande"]);

        const files = DriveUtils.getFilesInFolderName(budgetFolderName);
        expect(files.map(f => f.getName())).toStrictEqual(
            ["Budget Utemiljö", "Budget Förvaltarkontakt", "Budget Ordförande", "Budget Ventilation och värme", "Budget Reparationer"]);
        
        const spreads = files.map(f => SpreadsheetAppUtils.openByName(f.getName()));
        expect(spreads.map(s => s.getSheets().length)).toStrictEqual(spreads.map(s => 2));

        const budgetUte = SpreadsheetAppUtils.openByName("Budget Utemiljö");
        const row2 = budgetUte.getSheets()[1].getDataRange().getValues()[1];
        expect(row2.slice(0,4)).toStrictEqual(["2020-07-20 0:00:00", "",  -17796, "TrädgårdsHuset"]);

        const data = Budgeteer.collectFromResponsibilitySheets(budgetFolderName);
        // all roles except Utemiljö (b/c specifically defined document) should only have defaults (11110 Firma AB etc)
        const defaultRow = Budgeteer.budgetDefaultResponsibility[1];
        const defaultRows = data.filter(r => r[0] == defaultRow[0]);
        expect(defaultRows.length).toBe(files.length - 1);

        const utemiljoRows = data.slice(1).filter(r => r[0] != defaultRow[0]);
        expect(utemiljoRows.length).toBe(3);

        const kontonSSheet = SpreadsheetAppUtils.openByName("Konton");
        Budgeteer.runCollect(kontonSSheet, "Budget 2020", budgetFolderName, account => account != 11100);
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
2020-07-27 0:00:00		30,855.00							2020-07-28 0:00:00	56901309 00103	6091 BGINB
2020-07-27 0:00:00		-60,125.00	Snickeri Inredning Design	45000	Byggnad Periodiskt underhåll	Jonas Beckeman (07-22 06:23):Lekstugor?,Fredrik Benesch (07-22 08:28):Lekstugoroffert var på 81500 + momskunde inte hitta tidigare faktura för förskottsbetatalning?tot summa borde vara 81500 + 3600 ( extra arbete) + moms,Jonas Beckeman (07-24 07:46):Stämmer (se faktura 17/4)	6413070	L6297   5603     1	2020-07-27 0:00:00	LB UTTAG	6091 LB32
2020-07-27 0:00:00		-10,156.00	Svea Ekonomi	41910	Förbrukningsmateriel		0		2020-07-27 0:00:00	LB UTTAG	6091 LB32
2020-07-27 0:00:00		-60.00	Svea Ekonomi	64910	Administration		0		2020-07-27 0:00:00	LB UTTAG	6091 LB32
2020-07-27 0:00:00	TRX	10,216.00	Svea Ekonomi	64910	Administration Förvaltningskostnader		6416995	L6297   5602     1			
2020-07-24 0:00:00		-388.00	SBC Sv Bostadsrättscentrum	64910	Administration Förvaltningskostnader		6329833	L6297   5575     1	2020-07-24 0:00:00	LB UTTAG	6091 LB32
2020-07-24 0:00:00		-1,669.00	Just Nu Malmö	61510	Medlemsinformation Kontorsmateriel och trycksaker	Jonas Beckeman (07-08 15:14):Infobrev	6377912	L6297   5578     1	2020-07-24 0:00:00	LB UTTAG	6091 LB32
2020-07-24 0:00:00		-450.00	SBC Sv Bostadsrättscentrum	63210	Inkassering avgift/hyra Företagsförsäkringar och övriga riskkostnader		6340289	L6297   5577     1	2020-07-24 0:00:00	LB UTTAG	6091 LB32
2020-07-23 0:00:00	I/R	-555.00							2020-07-23 0:00:00	FBGC63473043	6091 AG
2020-07-20 0:00:00		10,814.00							2020-07-21 0:00:00	56901309 00101	6091 BGINB
2020-07-20 0:00:00		-17,796.00	TrädgårdsHuset	41710	Gård Fastighetsskötsel och städning	Jonas Beckeman (07-03 14:49):Plantering runt butiken?	6352245	L6297   5599     1	2020-07-20 0:00:00	LB UTTAG	6091 LB32
2020-07-17 0:00:00	TRX	80,320.66	Intrum Justitia Sverige AB	43910	Skador/klotter/skadegörelse Reparationer	Jonas Beckeman (07-16 08:47):Anticimex, kom till Peter Göransson. Godkänd av Martin per mail.	6404805	L6297   5598     1			
2020-07-17 0:00:00	TRX	44.00	Storuman Energi AB -Shb Finans	46100	El Taxebundna kostnader		6313896	L6297   5574     1			
2020-07-17 0:00:00	TRX	58.00	Storuman Energi AB -Shb Finans	46100	El Taxebundna kostnader		6314696	L6297   5573     1			
2020-07-17 0:00:00	TRX	58.00	Storuman Energi AB -Shb Finans	46100	El Taxebundna kostnader		6314696	L6297   5572     1			
2020-07-17 0:00:00	TRX	58.00	Storuman Energi AB -Shb Finans	46100	El Taxebundna kostnader		6314696	L6297   5573     1			
2020-07-17 0:00:00	TRX	58.00	Storuman Energi AB -Shb Finans	46100	El Taxebundna kostnader		6314696	L6297   5572     1			
2020-07-17 0:00:00	TRX	58.00	Storuman Energi AB -Shb Finans	46100	El Taxebundna kostnader		6315219	L6297   5573     1			
2020-07-17 0:00:00	TRX	58.00	Storuman Energi AB -Shb Finans	46100	El Taxebundna kostnader		6315219	L6297   5572     1			
2020-07-17 0:00:00	TRX	58.00	Storuman Energi AB -Shb Finans	46100	El Taxebundna kostnader		6315219	L6297   5573     1			
2020-07-17 0:00:00	TRX	58.00	Storuman Energi AB -Shb Finans	46100	El Taxebundna kostnader		6315219	L6297   5572     1			
2020-07-17 0:00:00	TRX	78,882.00	Intrum Justitia Sverige AB	43910	Skador/klotter/skadegörelse		0				
2020-07-17 0:00:00	TRX	180.00	Intrum Justitia Sverige AB	64910	Administration		0				
2020-07-17 0:00:00	TRX	1,258.66	Intrum Justitia Sverige AB	84290	Övriga räntekostnader		0				
2020-07-17 0:00:00	I/R	-80,480.66							2020-07-17 0:00:00	LB UTTAG	6091 LB32
2020-07-16 0:00:00		-1,304.00	Svea Ekonomi	41910	Förbrukningsmateriel Fastighetsskötsel och städning	Jonas Beckeman (07-02 06:07):Lekstugefärg	6354118	L6297   5588     1	2020-07-16 0:00:00	LB UTTAG	6091 LB32
2020-07-16 0:00:00		-12,006.00	Roslagens Plåtkonsult AB	65500	Konsultarvode Övriga externa tjänster	Jonas Beckeman (06-30 05:13):Konsultation / planering takrenovering,Jens Almström (07-14 07:06):Denna är ok	6326824	L6297   5590     1	2020-07-16 0:00:00	LB UTTAG	6091 LB32
2020-07-15 0:00:00		-5,625.00	kv. Konstruktörer AB	65500	Konsultarvode Övriga externa tjänster	Jonas Beckeman (06-30 05:15):Balkongprojekt	6319468	L6297   5587     1	2020-07-15 0:00:00	LB UTTAG	6091 LB32`; 

const rrExport =
`Resultaträkning							
Kund: 6297 Riksrådsvägen | Valt år: 2019 19/20 | Vald period: December							
	Utfall vald period	Budget vald period	Utfall ack	Budget ack	Utfall fgå ack	Ansvar	SBC:s beskrivning
30110 Årsavgifter		632,750	5,683,526	7,593,000	7,576,109		
30210 Hyror bostäder		48,750	446,129	585,000	584,988		
30230 Hyror lokaler		500	4,863	6,000	6,386		
30251 Hyror parkering		28,167	235,825	338,000	189,950		
Summa Årsavgifter och hyror		710,167	6,370,343	8,522,000	8,357,433		
30960 Hyresrabatt			-1,050				
32130 Gemensamhetslokal		1,250	7,050	15,000	12,125		
37400 Öresutjämning			67		70		
39000 Fakturerade kostnader			9,094		3,075		
39999 Övriga intäkter			4,999		508		
Summa Övriga rörelseintäkter		1,250	20,160	15,000	15,778		
Summa Rörelsens intäkter		711,417	6,390,503	8,537,000	8,373,211		
41100 Fastighetsskötsel beställning		9991	9992	9993	9994   
41110 Fastighetsskötsel beställning			-7,063				`;

const konton = `Konto	2018	2019	2020	Budget 2020	Rel 2020	Budget 2021	Namn	Ansvar	Kommentar
45613							N/A		
45640							N/A		
11820							Pågående om- och tillbyggnad		
12110							N/A		
15210							N/A		
16889							N/A		
19710							N/A		
23501	-1500000				MAX		N/A - Handelsbanken		
28990							N/A - Inre fond?		
37400				0			Öresutjämning		
41100		4781					Fastighetsskötsel entreprenad Fastighetsskötsel och städning		
41110		10046		0	MAX	-60000	Fastighetsskötsel beställning Fastighetsskötsel och städning	Förvaltarkontakt	Upp till 5000 kr, alla övriga ”små” jobb under entreprenad. T ex byte av lampor.
41150	17375			0		0	Fastighetsskötsel gård entrep Fastighetsskötsel och städning	Utemiljö	
41160	-12000	3346		-10000	-33	-19500	Fastighetsskötsel gård bestäl Fastighetsskötsel och städning	Utemiljö	Alla övriga trädgårdstjänster – trädbeskärning, fällning, plantering, stubbfräsning, tömning av kompost.
41170	-210496	-174576		-189000	92	-200000	Snöröjning/sandning Fastighetsskötsel och städning	Utemiljö	Takskottning, nedtagning av istappar, upptagning sand, markuppvärmning, saltning.
41210		-6520			MAX	-6520	Städning enligt beställning Fastighetsskötsel och städning	Ordförande	
41300				-2000	0	-2500	Sotning Fastighetsskötsel och städning	Ventilation och värme	Rökkanaler, kaminer, provtryckning, brandskyddskontroll
41430							Myndighetstillsyn		
41600	-2427			-5000	0	-45000	Gemensamma utrymmen Fastighetsskötsel och städning	Utemiljö	Större inköp – skyltar, anslagstavlor, cykelställ
41650	-22375	15875		-16000	-99	-38000	Sophantering Fastighetsskötsel och städning	Utemiljö	Källsorteringsavtal, container, tvättning kärl, sopsug, tunnor, källsorteringsavtal
41710	2242			-3000	0	-3000	Gård Fastighetsskötsel och städning	Utemiljö	Alla inköp till gården/entré. T ex julgran, blommor, krattor, spadar, gungor, rutschkana, flaggstång, byte av sand i sandlåda (lekplats)
41800	-23281	-24111		-15000	161	-25000	Serviceavtal Fastighetsskötsel och städning	Ventilation och värme	Om period anges månad, kvartal – energitjänster, jouravtal, hissavtal – alla serviceavtal
41910				-2000	0	-2000	Förbrukningsmateriel	Förvaltarkontakt	Glödlampor, städmaterial, spikar, skruvar, verktyg, namnremsor
41914							Störningsjour och larm		
41915							Brandskydd		
41920	-9573	-11119		-5000	222	-10000	Fordon Fastighetsskötsel och städning	Utemiljö	Reparation t ex gräsklippare, traktorer, snöslunga, bränsle, trängselskatt
43000	56125	-81150		0	MAX	-40000	Fastighet förbättringar Reparationer	Reparationer	Fuktmätning, besiktning av fastigheten`;

const kontonOld = `Konto	2018	2019	Budget 2019	Rel 2019	Budget 2020	Namn	Ansvar
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
41160	-12000	3346	-10000	-33	-19500	Fastighetsskötsel gård bestäl Fastighetsskötsel och städning	Utemiljö
41170	-210496	-174576	-189000	92	-200000	Snöröjning/sandning Fastighetsskötsel och städning	Utemiljö
41210		-6520		MAX	-6520	Städning enligt beställning Fastighetsskötsel och städning	Ordförande
41300			-2000	0	-2500	Sotning Fastighetsskötsel och städning	Ventilation och värme
41430						Myndighetstillsyn	
41600	-2427		-5000	0	-45000	Gemensamma utrymmen Fastighetsskötsel och städning	Utemiljö
41650	-22375	15875	-16000	-99	-38000	Sophantering Fastighetsskötsel och städning	Utemiljö
41710	2242		-3000	0	-3000	Gård Fastighetsskötsel och städning	Utemiljö
41800	-23281	-24111	-15000	161	-25000	Serviceavtal Fastighetsskötsel och städning	Ventilation och värme
41910			-2000	0	-2000	Förbrukningsmateriel	Förvaltarkontakt
41914						Störningsjour och larm	
41915						Brandskydd	
41920	-9573	-11119	-5000	222	-10000	Fordon Fastighetsskötsel och städning	Utemiljö
43000	56125	-81150	0	MAX	-40000	Fastighet förbättringar Reparationer	Reparationer
43100	-1118	-42643	-20000	213	-205000	Hyreslägenheter Reparationer	Reparationer
43110		-71163	0	MAX	0	Brf Lägenheter Reparationer	Reparationer`;
