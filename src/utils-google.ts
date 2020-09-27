import { toObject, KeyValueMap, sleep } from './utils';

// Remove these from built js
export var SpreadsheetApp: ISpreadsheetApp;
export var DriveApp: IDriveApp;
export var Charts: ICharts;
export class Logger {
  static log(val: any): void {
    console.log(val);
  }
}
// End remove


// shims
export interface IDriveApp {
  getFilesByName(name: string): IFileIterator;
  getFoldersByName(name: string): IFolderIterator;
  getFileById(id: string): IFile | null;
  getRootFolder(): IFolder;
}
export interface IIterator<T> {
  getContinuationToken(): string;
  hasNext(): boolean;
  next(): T;
}
export interface IFileSystemItem {
  getId(): string;
  getName(): string;
}

export interface IFileIterator extends IIterator<IFile> {}
export interface IFile extends IFileSystemItem {
  getParents(): IFolderIterator;
 }
export interface IFolderIterator extends IIterator<IFolder> {}
export interface IFolder extends IFileSystemItem {
  getFiles(): IFileIterator;
  addFile(file: IFile): void;
  removeFile(file: IFile): void;
  getFolders(): IFolderIterator;
 }

export interface ISpreadsheetApp {
  getActiveSpreadsheet(): ISpreadsheet;
  openById(id: string): ISpreadsheet;
  // What the... Don't use! https://groups.google.com/g/adwords-scripts/c/91muafXSS5E?pli=1
  open(file: IFile): ISpreadsheet;
  create(name: string): IFile;
}
export interface ISpreadsheet {
  getName(): string;
  getSheets(): ISheet[];
  insertSheet(): ISheet;
  getSheetByName(name: string): ISheet;
}
export interface ISheet {
  getParent(): ISpreadsheet;
  getDataRange(): ISheetRange;
  getRange(rowIndex: number, colIndex: number, rowCount?: number, colCount?: number): ISheetRange;
  setName(name: string): void;
  clear(): void;
  getFilter(): ISheetFilter;
  getName(): string;

  newChart(): IChart;
  removeChart(chart: IChart): void;
  insertChart(chart: IChart): void;
  getCharts(): IChart[];
}
// export class ChartsChartType {
//     Line = 'Line';
// }
// export class Charts {
//     ChartType: ChartsChartType = new ChartsChartType()
//  };

export interface IChart {
  setChartType(type: any): IChart;
  addRange(range: ISheetRange): IChart;
  setNumHeaders(num: number): IChart;
  setPosition(x: number, y: number, width: number, height: number): IChart;
  setOption(option: string, value: any): IChart;
  build(): IChart;
}

export interface ISheetFilter {
  getColumnFilterCriteria(colIndex: number): IFilterCriteria;
}
export interface IFilterCriteria {
  getCriteriaType(): any;
  getCriteriaValues(): any[];
}
export interface ISheetRange {
  offset(rowOffset: number, columnOffset: number, numRows?: number, numColumns?: number): ISheetRange;
  getValues(): any[][];
  getCell(rowIndex: number, colIndex: number): ICell;
  getHeight(): number;
  clearContent(): void;
}
export interface ICell {
  setValue(val: any): void;
  getValue(): any;
  setFontColor(val: string): void;
  setFormula(formula: string): void;
}
export interface IChartsType {
  LINE: string;
}
export interface ICharts {
  ChartType: IChartsType; //Charts.ChartType.LINE
}

export class SpreadsheetAppUtils
{
  private static MySpreadsheetApp: ISpreadsheetApp = SpreadsheetApp;

  static getActiveSpreadsheet() { return SpreadsheetAppUtils.MySpreadsheetApp.getActiveSpreadsheet(); }

  // static open(file: IFile): ISpreadsheet {
  //   return SpreadsheetAppUtils.MySpreadsheetApp.open(file);
  // }
  static openSheet(filename: string, foldername: (string | null) = null, sheetNameOrIndex: (string | number) = 0): ISheet {
    let file: (IFile | null);
    if (foldername === null)
      file = DriveUtils.getSingleFile(filename);
    else
      file = DriveUtils.getFileInFolder(filename, foldername);
    if (file == null) throw new Error(`File not found ${filename} in ${foldername}`);

    const spreadsheet = SpreadsheetAppUtils.MySpreadsheetApp.open(file);
    const sheet = typeof sheetNameOrIndex === "string" ? spreadsheet.getSheetByName(sheetNameOrIndex) : spreadsheet.getSheets()[sheetNameOrIndex];
    if (!sheet) throw new Error(`Sheet not available: ${sheetNameOrIndex}`);
    return sheet;
  }

    // https://groups.google.com/g/adwords-scripts/c/91muafXSS5E?pli=1
  static open(file: IFile) { return SpreadsheetAppUtils.MySpreadsheetApp.openById(file.getId()); }

  static getOrCreateSpreadsheetFile(fileName: string, folderName: string): IFile {
    const folder = DriveUtils.getSingleFolder(folderName); //.iterateToFirst(DriveUtils.MyDriveApp.getFoldersByName(folderName));
    if (!folder) {
      throw new Error("No folder: " + folderName);
    }
    const folderId = folder.getId();

    let file = DriveUtils.getFileInFolderId(fileName, folderId);

    if (file) {
        return file;
    } else {
        //Logger.log("Creating file " + fileName);
        file = SpreadsheetAppUtils.create(fileName, folder);
        return file;
    }
}
  static openOrCreate(fileName: string, folderName: string): ISpreadsheet {
    const file = SpreadsheetAppUtils.getOrCreateSpreadsheetFile(fileName, folderName);
    
     // gdrive seems to be async but method is sync..? Can't always open immediately after creation
    // const maxTime = 5000;
    // const start = Date.now();
    // while (true) {
    //   try {
    //     return SpreadsheetAppUtils.MySpreadsheetApp.open(file);
    //   } catch (err) {
    //     if (Date.now() - start >= maxTime) { break; }
    //     sleep(500);
    //   }
    // }
    // throw `Can't open the file ${fileName} in ${folderName}`;
    return SpreadsheetAppUtils.MySpreadsheetApp.openById(file.getId());
  }

  static openByName(name: string): ISpreadsheet {
    const iter = DriveUtils.MyDriveApp.getFilesByName(name);
    if (iter.hasNext()) {
      const file = iter.next();
      if (iter.hasNext()) {
        throw new Error(">1: " + name);
      }
      return SpreadsheetAppUtils.MySpreadsheetApp.open(file);
    }
    throw new Error("Not found: " + name);
  }
  static create(fileName: string, folder?: IFolder | string): IFile {
    const file = SpreadsheetAppUtils.MySpreadsheetApp.create(fileName);
    if (!!folder) {
      if (typeof folder === "string") folder = DriveUtils.getSingleFolder(folder);
      const copyFile = DriveUtils.MyDriveApp.getFileById(file.getId());
      folder.addFile(<IFile>copyFile);
      DriveUtils.MyDriveApp.getRootFolder().removeFile(<IFile>copyFile);
  
      //file = DriveUtils.getFileInFolderId(fileName, folder.getId());
      // if (!file) { throw "Failed to copy file to " + folder.getName(); }
    }
    return file;
  }
}

export class DriveUtils {
  static MyDriveApp: IDriveApp = DriveApp;

  static getSingleFolder(name: string): IFolder {
    try {
      return DriveUtils.iterateSingle(DriveUtils.MyDriveApp.getFoldersByName(name));
    }
    catch (err) {
      throw new Error("Folder doesn't exist: " + name);
    }
  }
  static getSingleFile(name: string): IFile {
    return DriveUtils.iterateSingle(DriveUtils.MyDriveApp.getFilesByName(name));
  }

  static getFilesInFolderName(folderName: string, predicate?: (item: IFile) => boolean): IFile[] {
    const folder = DriveUtils.getSingleFolder(folderName);
    return DriveUtils.iterateToArray(folder.getFiles(), predicate);
  }
  static getFilesInFolder(folder: IFolder, predicate?: (item: IFile) => boolean): IFile[] {
    return DriveUtils.iterateToArray(folder.getFiles(), predicate);
  }
  static getFileInFolder(fileName: string, folderName: string): IFile | null {
    const folder = DriveUtils.getSingleFolder(folderName); // DriveUtils.MyDriveApp.iterateToFirst(DriveApp.getFoldersByName(folderName));
    // if (!folder) {
    //     Logger.log("No folder: " + folderName);
    //     return null;
    // }
    const folderId = folder.getId();
    return DriveUtils.getFileInFolderId(fileName, folderId);
}

  static getFileInFolderId(fileName: string, folderId: string): IFile | null {
    // DriveUtils.iterateToFirst<IFile>(DriveApp.getFilesByName(fileName), file => file.
    return DriveUtils.iterateToFirst(DriveUtils.MyDriveApp.getFilesByName(fileName), file =>
      DriveUtils.iterateToFirst(file.getParents(), par => par.getId() === folderId) !== null
    );
}

static iterateSingle<T>(iterator: IIterator<T>): T {
  if (!iterator.hasNext()) throw new Error("0 in iterator");
  const result = iterator.next();
  if (iterator.hasNext()) throw new Error(">1 in iterator");
  return result;

}
  static iterateToArray<T>(iterator: IIterator<T>, predicate?: (item: T) => boolean): T[] {
    const result: T[] = [];
    while (iterator.hasNext()) {
        var next = iterator.next();
        if (!predicate || predicate(next)) result.push(next);
    }
    return result;
  }

  static iterateToFirst<T>(iterator: IIterator<T>, predicate?: (item: T) => boolean): T | null {
    while (iterator.hasNext()) {
        var next = iterator.next();
        if (!predicate || predicate(next)) return next;
    }
    return null;
  }
}

export class SheetUtils {

  static fillSheet(sheet: ISheet, data: any[][], offsetRow: number = 0, offsetColumn: number = 0) {
    data.forEach((row, ir) => {
      if (!row || (<any>row).constructor !== Array) {
        console.log(`Not an array: ${row}`);
        return;
      }
      row.forEach((val, ic) => {
        const cell = sheet.getRange(ir + 1 + offsetRow, ic + 1 + offsetColumn).getCell(1, 1);
        cell.setValue(val);
      });
    });
  }

  static getOrCreateSheet(
    name: string,
    clearIfExists: boolean,
    ss: ISpreadsheet | null = null
  ): ISheet {
    ss = ss || SpreadsheetApp.getActiveSpreadsheet();
    let targetSheet = ss.getSheetByName(name);
    if (!targetSheet) {
      targetSheet = ss.insertSheet();
      targetSheet.setName(name);
    } else if (clearIfExists) {
      targetSheet.clear();
    }
    return targetSheet;
  }

  static getHeaderColumnsAsObject(
    sheetOrData: ISheet | any[][]
  ): KeyValueMap<number> {
    const headerRow = Array.isArray(sheetOrData)
      ? sheetOrData[0]
      : sheetOrData.getDataRange().offset(0, 0, 1).getValues()[0];
    return toObject(headerRow, (v, i) => [v, i]);
  }

  static getColumnRegexFilter(
    sheet: ISheet,
    columnIndex: number
  ): RegExp | null {
    var filter = sheet.getFilter();
    var filterCriteria = filter.getColumnFilterCriteria(columnIndex + 1);
    if (filterCriteria && filterCriteria.getCriteriaType() == 'CUSTOM_FORMULA') {
      var critVals = filterCriteria.getCriteriaValues();
      if (critVals.length == 1 && critVals[0].indexOf('REGEXMATCH') >= 0) {
        //REGEXMATCH =REGEXMATCH(TEXT(E:E, 0), "^43")
        var rxMatch = /\"(.+)\"/.exec(critVals[0]);
        if (rxMatch && rxMatch.length >= 2) {
          return new RegExp(rxMatch[1]);
        } else Logger.log('filter criteria regex no match' + critVals);
      } else
        Logger.log(
          'filter criteria not regex: ' +
            critVals +
            ' ' +
            critVals.indexOf('REGEXMATCH')
        );
    } else Logger.log('filter criteria: N/A');
    return null;
  }

  static insertChart(sheet: ISheet, chartType: any) {
    const chart = sheet
      .newChart()
      .setChartType(chartType)
      .addRange(sheet.getDataRange())
      .build();
    sheet.insertChart(chart); //Not working... "Those columns are out of bounds"
  }
}
