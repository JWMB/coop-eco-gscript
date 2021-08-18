import { parseFloatOrAny } from "./utils";

export interface ITransaction {	
	date?: Date;
	missing?: string;
	amount?: number;
	supplier?: string;
	accountId?: number;
	accountName?: string;
	comments?: string;
}

export class Transaction implements ITransaction {
	// Date	Missing	Amount	Supplier	AccountId	AccountName	Comments	InvoiceId	ReceiptId	CurrencyDate	TransactionText	TransactionRef

	static preferredOrder = [
		"date", "missing", "amount", "supplier", "accountId", "accountName", "comments"
	];
	static createDefault() {
		return <ITransaction>{
			date: new Date(1970, 1, 1),
			missing: "",
			amount: 0,
			supplier: "",
			accountId: 0,
			accountName: "",
			comments: "",
		};
	}

	date: Date | undefined;
	missing: string | undefined;
	amount: number | undefined;
	supplier: string | undefined;
	accountId: number | undefined;
	accountName: string | undefined;
	comments: string | undefined;
}