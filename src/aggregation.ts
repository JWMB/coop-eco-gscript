import { KeyValueMap, parseFloatOrAny, parseFloatOrDefault } from './utils';

export interface GroupingDefinition {
  name: string;
  col: number;
  func(arg: (string | number)): (string | number);
  filter?: (arg: any) => boolean;
}
export interface AggregationDefinition {
  name: string;
  col: number;
  func(arg1: any, arg2: any): any;
}

export interface AggregationPresetParams<T> {
  colIndex: number;
  aggregateName?: string;
  valueFunc?: (v:T) => T;
}

export class AggregationPresets {
  static SumDef(params: AggregationPresetParams<number>): AggregationDefinition { // colIndex: number, aggregateName: string = "Sum"): AggregationDefinition {
    return {
       col: params.colIndex, 
       name: params.aggregateName || "Sum", 
       func: (v, p) => (((!!params.valueFunc) ?  params.valueFunc(parseFloatOrDefault(v, 0)) : parseFloatOrDefault(v, 0)) || 0) + (p || 0) };
  }

  static Summarize(data: any[][], groupByColIndex: number, sumByColIndex: number, valueFunc?: (v: number) => number): KeyValueMap<any> {
    return Aggregation.aggregateRows(data, [{ col: groupByColIndex, name: 'Group', func: v => v },], 
      AggregationPresets.SumDef({ colIndex: sumByColIndex, valueFunc: valueFunc }), false);
  }
}

export class Aggregation {
  static aggregateIntoRows(
    data: (string | number)[][],
    groupingDefs: GroupingDefinition[],
    aggregateDef: AggregationDefinition,
    dataHasHeader: boolean = false
  ): any[][] {
    const aggregated = Aggregation.aggregateRows(
      data,
      groupingDefs,
      aggregateDef,
      dataHasHeader
    );
    const asRows = Aggregation.aggregatedToRows(aggregated);
    asRows.splice(
      0,
      0,
      groupingDefs.map(d => d.name).concat([aggregateDef.name])
    );
    return asRows;
  }

  static aggregatedToRows(aggregated: KeyValueMap<any>): any[] {
    const result = <any[]>[];
    Aggregation.recAgg2Row(aggregated, [], result);
    return result;
  }

  static aggregateRows(
    data: (string | number)[][],
    groupingDefs: GroupingDefinition[],
    aggregateDef: AggregationDefinition,
    dataHasHeader: boolean
  ): KeyValueMap<any> {
    const result = {};
    for (let i = dataHasHeader ? 1 : 0; i < data.length; i++) {
      Aggregation.aggregate(data[i], result, groupingDefs, aggregateDef);
    }
    return result;
  }

  private static recAgg2Row(obj: (KeyValueMap<any> | any[]), currentVals: any[], result: any[]) {
    if (typeof obj === 'object') {
      const keys = Object.keys(obj)
        .sort()
        .reverse();
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        currentVals.push(key);
        Aggregation.recAgg2Row((<KeyValueMap<any>>obj)[key], currentVals, result);
        currentVals.pop();
      }
    } else {
      currentVals.push(obj);
      result.push(currentVals.slice());
      currentVals.pop();
    }
  }

  static aggregate(
    row: (string | number)[],
    resultObj: Object,
    groupingDefs: GroupingDefinition[],
    aggregateDef: AggregationDefinition
  ) {
    let parentLevel = <KeyValueMap<any>>resultObj;
    for (let i = 0; i < groupingDefs.length - 1; i++) {
      const def = groupingDefs[i];
      const key = def.func(row[def.col]);
      if (def.filter && !def.filter(row[def.col])) {
        return;
      }
      let childLevel = parentLevel[key];
      if (!childLevel) {
        childLevel = {};
        parentLevel[key] = childLevel;
      }
      parentLevel = childLevel;
    }

    // Final step:
    const def = groupingDefs[groupingDefs.length - 1];
    const key = def.func(row[def.col]);
    parentLevel[key] = aggregateDef.func(
      row[aggregateDef.col],
      parentLevel[key]
    );
    //if (key === '23xxx') { Logger.log(dbgPath); Logger.log(key); Logger.log(row[aggregateDef.col]); Logger.log(parentLevel[key]);}
  }
}


export interface GroupingDefinitionOfT<T> {
  name: string;
  func(arg: T): (string | number);
  filter?(arg: T): boolean;
}
export interface AggregationDefinitionOfT<T> {
  name: string;
  func(arg1: T, arg2: any): any;
}
export class AggregationOfT {
  static aggregate<T>(
    row: T,
    resultObj: Object,
    groupingDefs: GroupingDefinitionOfT<T>[],
    aggregateDef: AggregationDefinitionOfT<T>
  ) {
    let parentLevel = <KeyValueMap<any>>resultObj;
    for (let i = 0; i < groupingDefs.length - 1; i++) {
      const def = groupingDefs[i];
      const key = def.func(row);
      if (def.filter && !def.filter(row)) {
        return;
      }
      let childLevel = parentLevel[key];
      if (!childLevel) {
        childLevel = {};
        parentLevel[key] = childLevel;
      }
      parentLevel = childLevel;
    }
    // console.log("ROW", row, resultObj);
    // Final step:
    const def = groupingDefs[groupingDefs.length - 1];
    const key = def.func(row);
    parentLevel[key] = aggregateDef.func(row, parentLevel[key]);
  }

  static aggregateRows<T>(
    data: T[],
    groupingDefs: GroupingDefinitionOfT<T>[],
    aggregateDef: AggregationDefinitionOfT<T>,
  ): KeyValueMap<any> {
    const result = {};
    for (let i = 0; i < data.length; i++) {
      AggregationOfT.aggregate(data[i], result, groupingDefs, aggregateDef);
    }
    return result;
  }
}
