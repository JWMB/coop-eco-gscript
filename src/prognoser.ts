import { DateUtils, KeyValueMap } from './utils';
//import { Logger } from './utils-google';

// export interface XEvent {
//     Amount: number;
//     Date: (Date | null);
//     Recurring: string;
//     Name: string;
// }
// export interface VariableDef {
//     Amount: (number | string);
//     Date: (Date | null);
//     Name: string;
// }

export class Prognoser {
  variables: any = {};
  prognosisVariablePrefix: string = 'VAR_';

  getVarValueNum(fullname: string) {
    return parseFloat(
      ('' + this.variables[this.getVarName(fullname)]).replace(',', '.')
    );
  }
  isVariable(fullname: string) {
    return fullname.indexOf(this.prognosisVariablePrefix) === 0;
  }

  getVarName(fullname: string) {
    return fullname.substr(this.prognosisVariablePrefix.length);
  }

  setVarFromFullName(fullname: string, val: any) {
    this.variables[this.getVarName(fullname)] = val;
  }

//   createPrognosisSpec(prognosisDefRows: (string | number | undefined)[][]) { //({ variables: VariableDef[] })
//     let prognosisColumns = prognosisDefRows[0];
//     prognosisColumns = prognosisColumns.slice(0, prognosisColumns.indexOf(''));

//     let rows = prognosisDefRows.slice(1).map((r: any[]) => {
//       const obj = <KeyValueMap<any>>{};
//       prognosisColumns.forEach(
//         (col: string | number | undefined, i: number) => (obj[<string>col] = r[i])
//       );
//       return obj;
//     });

//     const sp = rows.map(r => this.isVariable(r.Supplier) 
//         ? <VariableDef>{ Amount: r.Amount, Name: r.Supplier, Date: new Date(r.Date) }
//         : <XEvent>{ Amount: r.Amount, Name: r.Supplier, Recurring: r.Recurring });
//     let rowsNoStart = rows.filter(o => !o.Date);
//     rows = rows.filter(o => !!o.Date);
//     rows.forEach(o => (o.Date = DateUtils.getDate(new Date(o.Date))));
//     rows = rows.sort((a, b) => a.Date.valueOf() - b.Date.valueOf());

//     this.variables = {};
//     rowsNoStart
//       .filter(o => this.isVariable(o.Supplier))
//       .forEach(o => this.setVarFromFullName(o.Supplier, o.Amount));
//   }

  createPrognosis(
    //prognosisSheet: ISheet,
    prognosisSpec: (string | number | undefined)[][],
    until: Date,
    eventColumns: KeyValueMap<number>
  ) {
    //var prognosisSpec = prognosisSheet.getDataRange().getValues();

    let prognosisColumns = prognosisSpec[0];
    prognosisColumns = prognosisColumns.slice(0, prognosisColumns.indexOf(''));

    let rows = prognosisSpec.slice(1).map((r: any[]) => {
      const obj = <KeyValueMap<any>>{};
      prognosisColumns.forEach(
        (col: string | number | undefined, i: number) => (obj[<string>col] = r[i])
      );
      return obj;
    });
    //1: Variable rows with no date - set variable
    //2: 

    let rowsNoStart = rows.filter(o => !o.Date);
    rows = rows.filter(o => !!o.Date);
    rows.forEach(o => (o.Date = DateUtils.getDate(new Date(o.Date))));
    rows = rows.sort((a, b) => a.Date.valueOf() - b.Date.valueOf());

    this.variables = {};
    rowsNoStart
      .filter(o => this.isVariable(o.Supplier))
      .forEach(o => this.setVarFromFullName(o.Supplier, o.Amount));

    rowsNoStart = rowsNoStart.filter(o => !this.isVariable(o.Supplier));

    //Mark accounts as periodical. Will create copied entries but with new date (AddMonth/AddYear)
    //Select interest payments and specify speculative interest rate changes for them?
    //NOPE – don’t mark previous ones as monthly, instead specify all loans
    let recurring = [];
    //go back 1 month in actual history, match with accounts expression in rowsNoStart
    //convert to actual account + supplier + amount

    //  recurring = recurring.concat([
    //    { Account: "28400", Supplier: "My man", Amount: "10500", Recurring: "monthly", Date: new Date("2019-09-01") },
    //  ]);
    recurring = rows;
    // console.log(recurring);

    const maxEventColIndex = Math.max.apply(null, Object.keys(eventColumns).map(o => eventColumns[o]));
    const eventTemplate = Array.apply(null, new Array(maxEventColIndex)).map(
      Number.prototype.valueOf,
      0
    );

    const createdEvents: any[] = [];
    let current = DateUtils.getDate(new Date());
    while (current.valueOf() < until.valueOf()) {
      //Add 1 day:
      current = new Date(current.valueOf() + 1000 * 60 * 60 * 24);

      //can be heavily optimized by keeping list sorted...
      const found: any[] = recurring.filter(
        o => o.Date.valueOf() === current.valueOf()
      );
      //Remove from list
      recurring = recurring.filter(o => o.Date.valueOf() !== current.valueOf());
      if (found.length) {
        found.forEach(o => {
          if (this.isVariable(o.Supplier)) {
            this.setVarFromFullName(o.Supplier, o.Amount);
            //Logger.log(variables);
          } else {
            let amount = o.Amount;
            if (typeof amount === 'string' && amount.indexOf('*') > 0) {
              const xamount = amount
                .split('*')
                .map(s => s.trim())
                .filter(s => s.length);
              amount = xamount
                .map(s =>
                  this.isVariable(s) ? this.getVarValueNum(s) : parseFloat(s)
                )
                .reduce((p, v) => p * v);
            }
            const event = eventTemplate.slice();
            event[eventColumns.Date] = o.Date;
            event[eventColumns.Account] = o.Account;
            event[eventColumns.Supplier] = o.Supplier;
            event[eventColumns.Amount] = amount;
            createdEvents.push(event);
          }
        });

        const forwarded = found
          .filter(o => !!o.Recurring)
          .map(o => {
            o.Date = DateUtils.addMonths(
              o.Date,
              o.Recurring.substr(0, 1) === 'm'
                ? 1
                : o.Recurring.substr(0, 1) === 'y'
                ? 12
                : 0
            );
            o.Date = DateUtils.getDate(o.Date);
            return o;
          });
        if (forwarded.length) {
          //Logger.log(forwarded);
          //Re-add to list:
          recurring = recurring.concat(forwarded);
        }
      }
    }
    return createdEvents;
  }
}

export function createPrognosis(
  data: string[][],
  columns: KeyValueMap<number>,
  startDate: Date,
  endDate: Date,
  yearsBack: number
): string[][] {
  //For each day in year, get events on that date going back N years:
  var tmpYear = startDate.getFullYear() - yearsBack;
  var byDayInYear: any[][] = Array.apply(null, new Array(366)).map(() => []);
  data.forEach(r => {
    var d = new Date(r[columns.Date]);
    if (isNaN(d.valueOf())) {
      //Logger.log('Not a date in column ' + columns.Date + ': ' + r[columns.Date] + " (row: " + r + ")");
      return;
    }
    var y = d.getFullYear();
    if (y < tmpYear) {
      return;
    }
    var day = DateUtils.getDayInYear(d, y);
    byDayInYear[day].push(r);
  });

  var curr = startDate.valueOf();
  var result: string[][] = [];
  //Fill copies of past events up to endDate (with amount being 1/N of original amount)
  while (curr < endDate.valueOf()) {
    var dateCurr = new Date(curr);
    var day = Math.round(
      (curr - new Date(dateCurr.getFullYear(), 0, 1).valueOf()) /
        1000 /
        60 /
        60 /
        24
    );
    var forDayInYear = byDayInYear[day];
    if (forDayInYear.length) {
      var newDate = DateUtils.getDate(new Date(curr));
      var newRows = forDayInYear.map(r => {
        var nr: any[] = [].concat(r);
        nr[columns.Amount] = parseFloat(nr[columns.Amount]) / yearsBack;
        nr[columns.Date] = newDate;
        return nr;
      });
      result = result.concat(newRows);
    }
    curr += 1000 * 60 * 60 * 24;
  }
  return result;
}
