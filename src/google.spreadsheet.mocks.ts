import { DriveUtils, ICell, IChart, IDriveApp, IFile, IFilterCriteria, ISheet, ISheetFilter, ISheetRange, ISpreadsheet, ISpreadsheetApp } from "./utils-google";
import { MockFile } from './google.drive.mocks'
export class MockSpreadsheetApp implements ISpreadsheetApp {
    drive: IDriveApp;
    constructor(drive: IDriveApp) {
        this.drive = drive;
    }
    getActiveSpreadsheet(): ISpreadsheet {
        throw new Error("Method not implemented.");
    }
    open(file: IFile): ISpreadsheet {
        return (<MockFile>file).data;
    }
    create(name: string): IFile {
        throw new Error("Method not implemented.");
    }
    openById(id: string): ISpreadsheet {
        const file =this.drive.getFileById(id);
        if (!file) throw new Error("File not found: " + id);
        return <ISpreadsheet>(<MockFile>file).data;
    }
}

export class MockSpreadsheet implements ISpreadsheet {
    sheets: ISheet[];
    constructor(sheets: ISheet[]) {
        this.sheets = sheets;
    }
    getSheets() {
        return this.sheets;
    } 
    insertSheet() {
        const sheet = new MockSheet("new sheet" + this.sheets.length, []);
        this.sheets.push(sheet);
        return sheet;
    }
    getSheetByName(name: string) {
        const found = this.sheets.filter(s => (<MockSheet>s).getName() == name);
        return found[0]; // found.length ? found[0] : null;
    }
}


export class MockSheetRange implements ISheetRange {
    // rows: any[][];
    private sheet: MockSheet;
    constructor(sheet: MockSheet) {
        // this.rows = rows;
        this.sheet = sheet;
    }
    private view = { x: 0, y: 0, width: Number.MAX_VALUE, height: Number.MAX_VALUE }; //{ x: number, y: number, width: number, height: number}
    offset(rowOffset: number, columnOffset: number, numRows?: number, numColumns?: number): ISheetRange {
        const result = new MockSheetRange(this.sheet);
        result.view.x = this.view.x + columnOffset;
        result.view.y = this.view.y + rowOffset;
        result.view.width = numColumns == undefined ? Number.MAX_VALUE : numColumns;
        result.view.height = numRows == undefined ? Number.MAX_VALUE : numRows;
        return result;
    }

    getValues(): any[][] {
        const rows = this.sheet.rows.slice(this.view.y, this.view.height == undefined ? undefined : this.view.y + this.view.height);
        return rows.map(r => r.slice(this.view.x, this.view.width == undefined ? undefined : this.view.x + this.view.width));
    }
    getCell(rowIndexBase1: number, colIndexBase1: number): ICell {
        return new MockCell(this.sheet, this.view.y + colIndexBase1 - 1, this.view.x + rowIndexBase1 - 1);
    }
    getHeight(): number {
        const curr = this.sheet.rows.length - this.view.y;
        return Math.min(this.view.height, curr);
    }
    clearContent(): void {
        throw new Error("NotImplemented");
        //this.sheet.rows.splice(0, this.rows.length);
    }
}
export class MockCell implements ICell {
    private sheet: MockSheet;
    private x: number;
    private y: number;
    constructor(sheet: MockSheet, x: number, y: number) {
        this.sheet = sheet;
        this.x = x;
        this.y = y;
    }
    setValue(val: any): void {
        this.sheet.rows[this.y][this.x] = val;
    }
    getValue() {
        return this.sheet.rows[this.y][this.x];
    }
    setFontColor(val: string): void {
        throw new Error("Method not implemented.");
    }
}
export class MockChart implements IChart {
    setChartType(type: any): IChart {
        throw new Error('Method not implemented.');
    }
    addRange(range: ISheetRange): IChart {
        throw new Error('Method not implemented.');
    }
    setNumHeaders(num: number): IChart {
        throw new Error('Method not implemented.');
    }
    setPosition(x: number, y: number, width: number, height: number): IChart {
        throw new Error('Method not implemented.');
    }
    setOption(option: string, value: any): IChart {
        throw new Error('Method not implemented.');
    }
    build(): IChart {
        throw new Error('Method not implemented.');
    }
}

export class MockFilter implements ISheetFilter {
    getColumnFilterCriteria(colIndex: number): IFilterCriteria {
        throw new Error('Method not implemented.');
    }
}

export class MockSheet implements ISheet {
    rows: any[][];
    constructor(name: string, rows: any[][]) {
        this.name = name;
        this.rows = rows;
    }
    getDataRange(): ISheetRange {
        return new MockSheetRange(this);
    }
    getRange(rowIndex: number, colIndex: number, rowCount?: number, colCount?: number) {
        return new MockSheetRange(this).offset(rowIndex, colIndex, rowCount, colCount);
    }
    setName(name: string) { this.name = name; }
    clear(): void { 
        this.rows = [];
    }
    getFilter() { return new MockFilter(); }
  
    newChart() { return new MockChart(); }
    removeChart(chart: IChart) {}
    insertChart(chart: IChart) {}
    getCharts(): IChart[] { return []; }

    private name: string = "";
    getName(): string { return this.name; }
}