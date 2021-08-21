import { Budgeteer } from './budgeteer'
import { Transaction } from './transactions';
import { SpreadsheetAppUtils } from './utils-google';
export * from "./budgeteer";

function Budgeteer_fillResponsibilitySpreadsheets() {
  Budgeteer.fillResponsibilitySpreadsheets(
    SpreadsheetAppUtils.openByName("Konton"), 
    SpreadsheetAppUtils.openGetAsTypedArray("Transaktioner", Transaction.createDefault()), //SpreadsheetAppUtils.openByName("Transaktioner"),
     "Budget2021");
}