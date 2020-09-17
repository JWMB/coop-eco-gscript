import { MockDriveApp, MockFolder } from './google.drive.mocks';
import { MockSheet, MockSpreadsheet, MockSpreadsheetApp } from './google.spreadsheet.mocks';

describe('Budget', () => {
    it('works', () => {
        const tsv = `
ColA	ColB	ColC
A1	B1	C1
A2	B2	C2
A3	B3	C3
`;
        const data = tsv.trim().split("\n").map(row => row.split("\t"));
        const sheet = new MockSheet("name", data);
        expect(sheet.getDataRange().getValues().length).toBe(data.length);

        const r = sheet.getDataRange().offset(1, 1, 1);
        expect(r.getValues().length).toBe(1);
        expect(r.getValues()[0].length).toBe(2);
        expect(r.getValues()[0][0]).toBe("B1");

        const cell = r.getCell(1, 1);
        expect(cell.getValue()).toBe("B1")
    });
});