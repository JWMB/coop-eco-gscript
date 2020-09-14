import { toObject, KeyValueMap } from './utils';

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
  open(file: IFile): ISpreadsheet;
  create(name: string): IFile;
}
export interface ISpreadsheet {
  getSheets(): ISheet[];
  insertSheet(): ISheet;
  getSheetByName(name: string): ISheet;
}
export interface ISheet {
  getDataRange(): ISheetRange;
  getRange(rowIndex: number, colIndex: number, rowCount?: number, colCount?: number): ISheetRange;
  setName(name: string): void;
  clear(): void;
  getFilter(): ISheetFilter;

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
}
export interface IChartsType {
  LINE: string;
}
export interface ICharts {
  ChartType: IChartsType; //Charts.ChartType.LINE
}

export var SpreadsheetApp: ISpreadsheetApp;
export var DriveApp: IDriveApp;
export var Charts: ICharts;

export class Logger {
  static log(val: any): void {
    console.log(val);
  }
}

export class SpreadsheetAppUtils
{
  static MySpreadsheetApp: ISpreadsheetApp = SpreadsheetApp;

  // static open(file: IFile): ISpreadsheet {
  //   return SpreadsheetAppUtils.MySpreadsheetApp.open(file);
  // }
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

  static getFilesInFolder(folder: IFolder, predicate: (item: IFile) => boolean): IFile[] {
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

static getOrCreateSpreadsheet(fileName: string, folderName: string): IFile {
      const folder = DriveUtils.iterateToFirst(DriveUtils.MyDriveApp.getFoldersByName(folderName));
      if (!folder) {
        throw new Error("No folder: " + folderName);
      }
      const folderId = folder.getId();
  
      let file = DriveUtils.getFileInFolderId(fileName, folderId);
  
      if (file) {
          return file;
      } else {
          Logger.log("Creating file " + fileName);
          file = SpreadsheetApp.create(fileName);
          const copyFile = DriveApp.getFileById(file.getId());
          folder.addFile(<IFile>copyFile);
          DriveUtils.MyDriveApp.getRootFolder().removeFile(<IFile>copyFile);
  
          file = DriveUtils.getFileInFolderId(fileName, folderId);
          if (!file) {
              throw "Failed to copy file to " + folderName;
          }
          return file;
      }

}

static iterateSingle<T>(iterator: IIterator<T>): T {
  if (!iterator.hasNext()) throw new Error("0 in iterator");
  const result = iterator.next();
  if (iterator.hasNext()) throw new Error(">1 in iterator");
  return result;

}
  static iterateToArray<T>(iterator: IIterator<T>, predicate: (item: T) => boolean): T[] {
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
