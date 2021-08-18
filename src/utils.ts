export class DateUtils {
  static getDate(date: Date): Date {
    return new Date(
      '' +
        date.getFullYear() +
        '-' +
        StringUtils.padLeft('' + (date.getMonth() + 1), '0', 2) +
        '-' +
        StringUtils.padLeft('' + date.getDate(), '0', 2)
    );
  }
  static getDateStr(d: Date): string {
    return (
      d.getFullYear() +
      '-' +
      StringUtils.padLeft((d.getMonth() + 1).toString(), '0', 2) +
      '-' +
      StringUtils.padLeft(d.getDate().toString(), '0', 2)
    );
  }
  static getFirstOfMonthStr(v: string): string {
    var d = new Date(v);
    return (
      d.getFullYear() +
      '-' +
      StringUtils.padLeft((d.getMonth() + 1).toString(), '0', 2) +
      '-01'
    );
  }
  static getFirstOfYearStr(v: string): string {
    return new Date(v).getFullYear().toString() + '-01-01';
  }
  static addMonths(date: Date, months: number): Date {
    return new Date(date.setMonth(date.getMonth() + months));
  }
  static getDayInYear(d: Date, yearIfPrecalced?: number): number {
    return Math.round(
      (d.valueOf() -
        new Date(yearIfPrecalced || d.getFullYear(), 0, 1).valueOf()) /
        1000 /
        60 /
        60 /
        24
    );
  }
  static subtractTimezone(d: Date) {
    console.log(d);
    d.setTime(d.getTime() - d.getTimezoneOffset() * 60 * 1000);
    console.log(d);
    return d;
  }
}

export function createGuid(): string {  
  function _p8(s: boolean = false) {  
     var p = (Math.random().toString(16)+"000000000").substr(2,8);  
     return s ? "-" + p.substr(0,4) + "-" + p.substr(4,4) : p ;  
  }  
  return _p8() + _p8(true) + _p8(true) + _p8();  
}  

export class StringUtils {
  static padLeft(str: string, char: string, totLen: number): string {
    let padding = '';
    for (let i = str.length; i < totLen; i++) {
      padding += char;
    }
    return padding + str;
  }
}

export interface KeyValueMap<T> {
  [key: string]: T;
}

export function removeObjectKeys(obj: any, filter: (key: string) => boolean): any {
  const result: any = {};
  Object.keys(obj).forEach(k => { if (filter(k)) result[k] = obj[k]; })
  return result;
}
export function toObject(
  list: any[],
  funcKeyAndValue?: (value: any, index: number, arr: any[]) => [string, any]
): KeyValueMap<any> {
  const result = <KeyValueMap<any>>{};
  if (!funcKeyAndValue) {
    funcKeyAndValue = (k) => [k[0], k[1]];
  }
  for (let i = 0; i < list.length; i++) {
    const kv = funcKeyAndValue(list[i], i, list);
    result[kv[0]] = kv[1];
  }
  return result;
}
export function objectsToArrays(objs: any[], includeHeaderRow: boolean, preferredOrder?: string[]) {
  const result: any[][] = [];
  if (objs == null || objs.length === 0) {
    return result;
  }

  let keys = Object.keys(objs[0]);
  if (preferredOrder != null) {
    const filtered = preferredOrder.filter(o => keys.indexOf(o) >= 0);
    keys = filtered.concat(keys.filter(o => filtered.indexOf(o) < 0));
  }

  if (includeHeaderRow) {
    result.push(keys);
  }
  for (let index = 0; index < objs.length; index++) {
    const obj = objs[index];
    const row: any[] = [];
    result.push(row);
    for (const key of keys) {
      row.push(obj[key]);
    }
  }
  return result;
}

export function sleep(milliseconds: number) {
  const date = Date.now();
  let currentDate = null;
  do {
    currentDate = Date.now();
  } while (currentDate - date < milliseconds);
}

function parseFloatInternal(value: any): number {
  return value == null ? Number.NaN : parseFloat(value.toString().replace(/\s/g, ""));
}
export function parseFloatOrDefault(value: any, defaultValue: number = 0): number {
  const result = parseFloatInternal(value);
  return isNaN(result) ? defaultValue : result;
}
export function parseFloatOrAny(value: any, defaultValue: any): any {
  const result = parseFloatInternal(value);
  return isNaN(result) ? defaultValue : result;
} 

export function parseRow<T>(data: any[], columns: string[], defaultRow: T) {
  const defRowUntyped = <any>defaultRow;
  const result: any = {};
  for (let index = 0; index < data.length; index++) {
    const colName = columns[index];
    const def = defRowUntyped[colName];
    result[colName] = parse(data[index], def);
  }
  return <T>result;
}

export function parse(input: any, typed: any) {
  const type = typeof typed;
  switch (type) {
    case "object":
      if (input == null) return null;
      const constr = typed.constructor;
      if (constr != null) {
        if (constr == Date) {
          return new Date(input);
        }
      }
      return null;
    case "string":
      return "" + input;
    case "number":
      return parseFloatOrAny(input, null);
  }
}
