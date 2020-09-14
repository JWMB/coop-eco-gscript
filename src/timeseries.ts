//import 'gscript-mocks.ts';
import { DateUtils, toObject, KeyValueMap } from './utils';
import { SheetUtils, SpreadsheetApp, ISheet, Logger } from './utils-google';
import { Prognoser, createPrognosis } from './prognoser';
import { Aggregation } from './aggregation';

function getAccountIdsToExclude(data: any[][]): any[] {
  var header = data[0];
  var activeCol = header.indexOf('Active');
  var accountIdCol = header.indexOf('AccountId');
  var result = data
    .slice(1)
    .filter(r => r[activeCol] == 'x')
    .map(r => r[accountIdCol]);
  return result;
}
function getTransactionsToExclude(data: any[][]) {
  var header = data[0];
  data = data.slice(1);
  var result = data.map(r => {
    var tmp = r.map((_v, i) => [header[i], r[i]]).filter(o => !!o[1]);
    return toObject(tmp, v => v);
  });
  return result;
}

export function run() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheets()[0];

  var columns = SheetUtils.getHeaderColumnsAsObject(sheet);
  var rxFilter = SheetUtils.getColumnRegexFilter(sheet, columns.AccountId);

  var filters = Timeseries.createFilters(
    columns,
    rxFilter,
    ss.getSheetByName('filter_accounts'),
    ss.getSheetByName('filter_tx')
  );
  var inYear = Timeseries.recalc(
    sheet,
    2,
    ss.getSheetByName('prognosis_spec'),
    '2020-12-01',
    filters
  );

  //Logger.log("Fill sheet");
  SheetUtils.fillSheet(SheetUtils.getOrCreateSheet('aggregated', true), inYear);
  ////Reverse order
  //aggregated = aggregated.slice(0, 1).concat([].concat.apply([], tmp).reverse());
  //accumulate(aggregated.slice(1), aggColums.Sum, Object.keys(aggColums).length);
  //aggregated = aggregated.slice(0, 1).concat(aggregated.slice(1).reverse());
  //Logger.log("Done");
}

// function getColumnRegexFilter(
//   sheet: ISheet,
//   columnIndex: number
// ): RegExp | null {
//   var filter = sheet.getFilter();
//   var filterCriteria = filter.getColumnFilterCriteria(columnIndex + 1);
//   if (filterCriteria && filterCriteria.getCriteriaType() == 'CUSTOM_FORMULA') {
//     var critVals = filterCriteria.getCriteriaValues();
//     if (critVals.length == 1 && critVals[0].indexOf('REGEXMATCH') >= 0) {
//       //REGEXMATCH =REGEXMATCH(TEXT(E:E, 0), "^43")
//       var rxMatch = /\"(.+)\"/.exec(critVals[0]);
//       if (rxMatch && rxMatch.length >= 2) {
//         return new RegExp(rxMatch[1]);
//       } else Logger.log('filter criteria regex no match' + critVals);
//     } else
//       Logger.log(
//         'filter criteria not regex: ' +
//           critVals +
//           ' ' +
//           critVals.indexOf('REGEXMATCH')
//       );
//   } else Logger.log('filter criteria: N/A');
//   return null;
// }

export class Timeseries {
  static applyColumnFilter(rx: RegExp, rows: string[][], columnIndex: number) {
    var visibleRows = [];
    if (!rows) throw 'No rows'; // || !rows.length
    if (!rx) throw 'No regex';
    if (rows.length > 0) {
      if (rows[0].length <= columnIndex)
        throw 'Incorrect column ' + columnIndex + ': ' + rows[0];
      for (var j = 0; j < rows.length; j++) {
        if (rx.test((rows[j][columnIndex] || '').toString()))
          visibleRows.push(rows[j]);
      }
    }
    return visibleRows;
  }

  static createFilters(
    columns: KeyValueMap<number>,
    rxAccountIdColumnFilter?: RegExp | null,
    sheetFilterAccounts?: ISheet,
    sheetFilterTransactions?: ISheet
  ): Array<(data: any[][]) => any[][]> {
    var result: Array<(data: any[][]) => any[][]> = [];
    if (rxAccountIdColumnFilter) {
      result.push(data =>
        Timeseries.applyColumnFilter(rxAccountIdColumnFilter, data, columns.AccountId)
      );
      //Logger.log('after column filter: ' + data.length);
    }

    result.push(
      data =>
        //Filter out rows with missing transaction:
        data.filter(
          r =>
            r[columns.Missing] !== 'TRX' &&
            new Date(r[columns.Date]).getFullYear() >= 2016
        )
      //Logger.log('after TRX filter: ' + data.length);
    );

    //Filter transactions booked on specified accounts:
    if (sheetFilterAccounts) {
      var accountIdsToExclude = getAccountIdsToExclude(
        sheetFilterAccounts.getDataRange().getValues()
      );
      if (accountIdsToExclude && accountIdsToExclude.length) {
        result.push(
          data =>
            data.filter(
              r => accountIdsToExclude.indexOf(r[columns.AccountId]) < 0
            )
          //Logger.log('after getAccountIdsToExclude: ' + data.length);
        );
      }
    }

    //Filter out specific transactions:
    if (sheetFilterTransactions) {
      var transactionsToExclude = getTransactionsToExclude(
        sheetFilterTransactions.getDataRange().getValues()
      );
      if (transactionsToExclude && transactionsToExclude.length) {
        result.push(
          data =>
            data.filter(r => {
              var found = transactionsToExclude.filter(
                o => o.Date.valueOf() == r[columns.Date].valueOf()
              );
              if (found.length) {
                //TODO: could be many to exclude from same date
                var matches = Object.keys(found[0])
                  .filter(k => k != 'Date')
                  .map(k => found[0][k] == r[columns[k]]);
                if (matches.indexOf(false) < 0) {
                  //TODO: remove them from
                  var tmpRemoveIndex = transactionsToExclude.indexOf(found[0]);
                  if (tmpRemoveIndex >= 0)
                    transactionsToExclude.splice(tmpRemoveIndex, 1);
                  return false;
                }
              }
              return true;
            })
          //Logger.log('after getTransactionsToExclude: ' + data.length);
        );
      }
    }
    return result;
  }


  static recalc(
    sheet: ISheet,
    numYearsLookbackAvg?: number,
    sheetPrognosisSpec?: ISheet,
    prognosisUntil?: string | Date,
    funcFilters?: Function[]
  ) {
    numYearsLookbackAvg = numYearsLookbackAvg == null ? 2 : numYearsLookbackAvg;
    prognosisUntil = new Date(prognosisUntil || '2020-01-01');

    var data = sheet.getDataRange().getValues();
    //var header = data[0];
    var columns = SheetUtils.getHeaderColumnsAsObject(sheet); //KeyValueMap<number> = toObject(header, function (v, i) { return [v, i]; });

    var applyFilters = (dataToFilter: any[][]) => {
      if (funcFilters) {
        Logger.log('filtering started: ' + dataToFilter.length);
        funcFilters.forEach(f => (dataToFilter = f(dataToFilter)));
        Logger.log('after filtering: ' + dataToFilter.length);
      }
      return dataToFilter;
    };

    data = applyFilters(data);

    var funcFilterAndConcat = (dataToConcat: any[][]) =>
      data.concat(applyFilters(dataToConcat));

    if (numYearsLookbackAvg > 0) {
      Logger.log('prognosis started');
      var added = createPrognosis(
        data,
        columns,
        new Date(),
        prognosisUntil,
        numYearsLookbackAvg
      );
      data = funcFilterAndConcat(added);

      if (sheetPrognosisSpec) {
        Logger.log('prognosis modification started');
        var progger = new Prognoser();
        var progcolumns = {
          Date: columns.Date,
          Amount: columns.Amount,
          Supplier: columns.Supplier,
          Account: columns.AccountId
        };
        added = progger.createPrognosis(
          sheetPrognosisSpec.getDataRange().getValues(),
          prognosisUntil,
          progcolumns
        );

        if (true) {
          //copy modified prognosis to future year, so we can compare with and without
          var laterThan = new Date(new Date().getFullYear(), 0, 1).valueOf();
          var copy = data
            .filter(r => r[columns.Date].valueOf() > laterThan)
            .map(r => r.slice());
          copy = copy.concat(added);
          copy.forEach(r => {
            var d = r[columns.Date];
            var year = d.getFullYear();
            r[columns.Date] = new Date(year + 100, d.getMonth(), d.getDate());
          });
          data = funcFilterAndConcat(copy); //data.concat(copy);
        } else {
          data = funcFilterAndConcat(added); //data.concat(added);
        }
      }
    }

    //Perform aggregation:
    Logger.log('Aggregation started');
    var groupingDefs = [
      {
        col: columns.Date,
        name: 'Period',
        func: (v: any) => DateUtils.getDateStr(v)
      }
    ];
    var aggregateDef = {
      col: columns.Amount,
      name: 'Sum',
      func: (v: any, p: any) => (parseInt(v, 10) || 0) + (p || 0)
    };
    var aggregated = Aggregation.aggregateIntoRows(
      data,
      groupingDefs,
      aggregateDef,
      false
    );
    var aggColums: KeyValueMap<number> = toObject(aggregated[0], (v, i) => [
      v,
      i
    ]);

    aggregated = Timeseries.sortRowsByColumn(aggregated, aggColums.Period, true, true);
    aggregated[0].push('Accumulated');

    //Sort rows, one list per year:
    var byYear: KeyValueMap<any[]> = {};
    aggregated.slice(1).forEach(row => {
      var year = new Date(row[aggColums.Period]).getFullYear();
      var inYear = byYear[year];
      if (!inYear) {
        inYear = [];
        byYear[year] = inYear;
      }
      inYear.push(row);
    });

    //Create column with accumulated values per year (so each year starts with 0):
    var colAcc = Object.keys(aggColums).length;
    // var tmp = Object.keys(byYear).sort().map(key => {
    //     var list = byYear[key];
    //     accumulate(list, aggColums.Sum, colAcc);
    //     return list;
    // });

    Logger.log('Create per-year table');
    //Create table with one row per day in year, and one column per year with accumulated values
    var sortedYears = Object.keys(byYear).sort();
    var inYear = [['Date'].concat(sortedYears)];
    var curr = new Date(2000, 0, 1).valueOf();
    var lastValues: KeyValueMap<number> = {};
    sortedYears.forEach(o => (lastValues[o] = 0));

    var byDayInYear: any[][] = Array.apply(null, new Array(366)).map(() => []);
    sortedYears.forEach(k => {
      byYear[k].forEach(r =>
        byDayInYear[DateUtils.getDayInYear(new Date(r[0]))].push(r)
      );
    });

    var lastRow: any[] = Array.apply(null, new Array(sortedYears.length)).map(
      () => 0
    );
    for (var day = 0; day < byDayInYear.length; day++) {
      var dateStr = DateUtils.getDateStr(new Date(curr));
      var row = lastRow.slice();
      var inDay = byDayInYear[day];
      inDay.forEach(r => {
        var year = new Date(r[0]).getFullYear();
        row[sortedYears.indexOf(year.toString())] = r[colAcc];
      });
      lastRow = row;
      inYear.push([dateStr].concat(row));
      curr += 1000 * 60 * 60 * 24;
    }

    return inYear;
  }

  static sortRowsByColumn(
    list: any[][],
    column: number,
    hasHeader: boolean,
    reverse: boolean
  ): any[][] {
    const sortVal = reverse ? -1 : 1;
    const srt = (l: any) =>
      l.sort((a: any, b: any) => (a[column] > b[column] ? sortVal : -sortVal));
    // var srt = reverse
    //     ? (l: any) => l.sort((a, b) => a[column] > b[column] ? 1 : -1)
    //     : l => l.sort((a, b) => a[column] < b[column] ? 1 : -1);

    return hasHeader ? list.slice(0, 1).concat(srt(list.slice(1))) : srt(list);
  }
}

export function accumulate(
  list: any[][],
  columnToAcc: number,
  columnForAccResult: number
) {
  var total = 0;
  list.forEach(row => {
    total += parseFloat(row[columnToAcc]);
    row[columnForAccResult] = total;
  });
}
