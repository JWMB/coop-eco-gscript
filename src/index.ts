import { Budgeteer } from './budgeteer'
import { SpreadsheetAppUtils } from './utils-google';
export * from "./budgeteer";

function Budgeteer_fillResponsibilitySpreadsheets() {
  Budgeteer.fillResponsibilitySpreadsheets(
    SpreadsheetAppUtils.openByName("Konton"), 
    SpreadsheetAppUtils.openByName("Transaktioner"), undefined, "Budget2021");
}