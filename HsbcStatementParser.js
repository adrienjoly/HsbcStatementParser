var assert = require("assert");
var PFParser = require("./node_modules/pdf2json/pdfparser");
// doc: https://github.com/modesty/pdf2json

function parseAmount(str){
	return parseFloat(str.replace(/\./g, '').replace(",", "."));
}

function Cursor(lines, valFct){
	var i = 0;
	this.line = null;
	this.rawLine = null;
	this.next = function(){
		return this.line = valFct(this.rawLine = lines[i++]);
	};
	this.parseUntil = function(str){
		do {
			this.next();
		} while(this.line && this.line.indexOf(str));
		return this.line == str;
	};
}

function HsbcCursor(lines){
	// call super constructor
	Cursor.call(this, lines, function(line){return line[0];})

	var RE_DATE_SHORT = /\d\d\.\d\d/g;
	var OP_COLS = ["Date", "Détail", "Valeur", "e" /*exo*/, "Débit", "Crédit"];
	var OP_COL_IDS = ["date", "text", "datev", "exo", "debit", "credit"];
	var colPos =     [    16,     59,      66,    70,      86          ];
	var OP_AMOUNT_IDX = 4;
	var END_OF_OPERATIONS = "TOTAL DES MOUVEMENTS";
	var NEXT_PAGE_HEADER = "Votre Relevé de Compte";

	this.detectColumns = function(){
		//for (var i in OP_COLS)
		//	colPos.push(cur.rawLine[1]);
		//console.log("column positions\n" + OP_COLS.join("\t") + "\n" + colPos.join("\t"));
		this.parseUntil(OP_COLS[OP_COLS.length-1]);
	};

	function parseOperation(){
		var op = {};
		//console.log("===new op");
		assert.ok(this.line && this.line.match(RE_DATE_SHORT), "operation must start with a short date: "+this.line);
		for(;;) {
			// detect the column number i of current value, based on its x-position
			for (var i=0; i<colPos.length; ++i)
				if (this.rawLine[1] < colPos[i])
					break;
			if (op.debit && i > OP_AMOUNT_IDX) {
				// reading a "credit" value after having read a "debit" value for the same operation
				// => current line might be a page number => skip to next page's operations
				//console.log(" - - - skipping to next operations - - - ");
				this.parseUntil(NEXT_PAGE_HEADER);
				this.detectColumns();
				this.next();
				if (!this.line || this.line.match(RE_DATE_SHORT)) {
					//console.log("(i) no more line, or new operation => end of current operation");
					return op;
				}
				else
					continue; // re-read the current line
			}
			// set (or append to) operation's current field 
			//console.log(OP_COL_IDS[i], this.line);
			if (op[OP_COL_IDS[i]])
				op[OP_COL_IDS[i]] += "\n" + this.line;
			else if (i >= OP_AMOUNT_IDX)
				op[OP_COL_IDS[i]] = parseAmount(this.line);
			else
				op[OP_COL_IDS[i]] = this.line;
			this.next();
			if (!this.line || this.rawLine[1] < colPos[0] || this.line == END_OF_OPERATIONS) {
				//console.log("(i) no more line, or new operation => end of current operation");
				return op;
			}
		}
	};

	this.parseOperations = function(){
		var ops = [];
		this.next();
		for(;this.line != END_OF_OPERATIONS;){
			var op = parseOperation.call(this);
			if (op) {
				ops.push(op);
				//console.log("op:", op);
			}
			else
				break;
		}
		assert.equal(this.line, END_OF_OPERATIONS);
		return ops;
	};
}

HsbcCursor.prototype = new Cursor;

function HsbcStatementParser(){

	var RE_DATE = /\d\d\.\d\d\.\d\d\d\d/g;

	var pdfParser = new PFParser();
	var callbackFct = null;

	pdfParser.on("pdfParser_dataError", function(err){
		(callbackFct || console.error)(err);
	});

	pdfParser.on("pdfParser_dataReady", function(pdfData){
		try{
			var lines = extractLines(pdfData);
			var bankStatement = parseLines(lines);
			callbackFct(null, bankStatement);
		}
		catch(e){
			callbackFct(e);
		}
	});

	function extractLines(pdf){
		return pdf.data.Pages.map(function(page){
			return page.Texts.map(function(text){
				// each line is [text, x-pos]
				return [decodeURIComponent(text.R[0].T), text.x];
			});
		}).reduce(function(a,b){
			// concatenate pages
			return a.concat(b);
		});
	}

	function validateTotals(bankSta){
		var totalDebit = 0, totalCredit = 0;
		bankSta.ops.map(function(op){
			if (op.debit)
				totalDebit += op.debit;
			else if (op.credit)
				totalCredit += op.credit;
			else
				throw new Error("operation without credit or debit");
		});
		//console.log(totalDebit, totalCredit);
		assert(Math.abs(totalDebit - bankSta.totDebit) < 0.001, "total debit is not valid");
		assert(Math.abs(totalCredit - bankSta.totCredit) < 0.001, "total credit is not valid");
		return totalCredit - totalDebit;
	}

	function parseLines(lines){
		var bankSta = {
			acctNum: null,
			dateFrom: null,
			dateTo: null,
			balFrom: null,
			balTo: null,
			totDebit: null,
			totCredit: null,
			ops: []
		};

		var cur = new HsbcCursor(lines);

		cur.parseUntil("Votre Relevé de Compte");
		cur.parseUntil("Compte n°");
		bankSta.acctNum = cur.next() + cur.next();

		cur.parseUntil("Période");
		var periode = cur.next().match(RE_DATE);
		bankSta.dateTo = periode.pop();
		bankSta.dateFrom = periode.pop();

		cur.detectColumns();

		cur.parseUntil("SOLDE DE DEBUT DE PERIODE");
		bankSta.balFrom = parseAmount(cur.next());

		bankSta.ops = cur.parseOperations();
		bankSta.totDebit = parseAmount(cur.next());
		bankSta.totCredit = parseAmount(cur.next());
		//console.log(bankSta.totDebit, bankSta.totCredit);
		var total = validateTotals(bankSta);

		cur.parseUntil("SOLDE DE FIN DE PERIODE");
		bankSta.balTo = parseAmount(cur.next());
		//console.log(["balance   (to - from): ", bankSta.balTo, bankSta.balFrom, Math.round((bankSta.balTo - bankSta.balFrom) * 100)/100].join(' '));
		//console.log(["total (credit - debit):", bankSta.totCredit, bankSta.totDebit, Math.round((bankSta.totCredit - bankSta.totDebit) * 100)/100].join(' '));
		assert(Math.abs(bankSta.balFrom + total - bankSta.balTo) < 0.001, "totals don't match");

		return bankSta;
	}

	this.parseFile = function(pdfFilePath, cb){
		callbackFct = cb;
		pdfParser.loadPDF(pdfFilePath);
	};
}

module.exports = new HsbcStatementParser;