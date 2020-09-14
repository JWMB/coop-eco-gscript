import { Prognoser } from "./prognoser";

describe('Aggregation', () => {
    it('works', () => {
        let events: any[] = [];
        const columns = { Date: 5, Amount: 1, Supplier: 2, Account: 3 };
        //const ss = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('prognosis_spec');
        const data = [
            ["Account","Supplier","Recurring","Date","Amount","Comment"],
            ["21000-35000","*","monthly",,,],
            [49000,"Income Fees","monthly","2019-09-01",40800,"Increased fee"],
            [49000,"Income Rent","monthly","2019-09-01",2400,"Increased rent"],
            [,"VAR_LOAN1",,,1000000,],
            [,"VAR_LOAN2",,,4000000,],
            [,"VAR_LOAN1_RATE",,"2019-09-01","0,04",],
            [,"VAR_LOAN2_RATE",,"2019-09-01","0,03",],
            [37000,"Bank","monthly","2019-09-01","VAR_LOAN1 * VAR_LOAN1_RATE","Loan 1 interest"],
            [61230,"Something","monthly","2019-09-15",10000,],
            [,"VAR_LOAN1_RATE",,"2019-12-01","0,05",]
        ];
        const generated = new Prognoser().createPrognosis(data, new Date("2021-01-01"), columns);
        events = events.concat(generated);
        expect(events).toStrictEqual([]);
    //Logger.log(generated);
    })
});  
