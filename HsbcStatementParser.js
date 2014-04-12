var sys = require("sys");
var assert = require("assert");
var PFParser = require("./node_modules/pdf2json/pdfparser");
// doc: https://github.com/modesty/pdf2json

var LOG = global.LOG || function(){};

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
	var INTERMEDIATE_BALANCE = "NOUVEAU SOLDE DE DEBUT DE PERIODE";

	this.detectColumns = function(){
		//for (var i in OP_COLS)
		//	colPos.push(cur.rawLine[1]);
		LOG("column positions\n" + OP_COLS.join("\t") + "\n\t" + colPos.join("\t"));
		this.parseUntil(OP_COLS[OP_COLS.length-1]);
	};

	function parseOperation(){
		var op = {};
		LOG("===new op");
		assert.ok(this.line && this.line.match(RE_DATE_SHORT), "operation must start with a short date: "+this.line);
		for(;;) {
			if (this.line && this.line.indexOf(INTERMEDIATE_BALANCE) == 0) {
				this.next(); // date
				var balance = this.next();
				//TODO: assert(balance == )
				this.next();
				return op;
			}

			// detect the column number i of current value, based on its x-position
			for (var i=0; i<colPos.length; ++i)
				if (this.rawLine[1] < colPos[i])
					break;

			LOG("x-position", this.rawLine[1], "-> field", OP_COL_IDS[i], "=", this.line);

			// set (or append to) operation's current field
			if (i >= OP_AMOUNT_IDX) {
				if (op.debit || op.credit) {
					// we already parsed a debit or credit for this operation
					// => current line might be a page number => skip to next page
					LOG(" - - - skipping to next page - - - ");
					this.parseUntil(NEXT_PAGE_HEADER);
					this.detectColumns();
					this.next();
					if (!this.line || this.line.match(RE_DATE_SHORT)) {
						LOG("(i) no more line, or new operation => end of current operation");
						return op;
					}
					else
						continue; // re-read the current line
				}
				else
					op[OP_COL_IDS[i]] = parseAmount(this.line);
			}
			else if (i == 1 && op[OP_COL_IDS[i]])
				op[OP_COL_IDS[i]] += "\n" + this.line;
			else
				op[OP_COL_IDS[i]] = this.line;
			this.next();
			if (!this.line || this.rawLine[1] < colPos[0] || this.line == END_OF_OPERATIONS) {
				LOG("(i) no more line, or new operation => end of current operation");
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
				LOG("op:", op);
			}
			else
				break;
		}
		assert.equal(this.line, END_OF_OPERATIONS);
		return ops;
	};
}

HsbcCursor.prototype = new Cursor;

function HsbcStatementParser(options){

	options = options || {};
	LOG = !options.debug ? function(){} : function(){
		for (var i in arguments)
			if (arguments[i] instanceof Object || arguments[i] instanceof Array)
				arguments[i] = sys.inspect(arguments[i]);
		console.log("[DEBUG] " + Array.prototype.join.call(arguments, " "));
	};

	LOG("DEBUG MODE");

	var RE_DATE = /\d\d\.\d\d\.\d\d\d\d/g;

	var pdfParser = new PFParser();
	var callbackFct = null;

	var bankSta = {
		filePath: null,
		acctNum: null,
		dateFrom: null,
		dateTo: null,
		balFrom: null,
		balTo: null,
		totDebit: null,
		totCredit: null,
		ops: []
	};

	pdfParser.on("pdfParser_dataError", function(err){
		callbackFct(err, bankSta);
	});

	pdfParser.on("pdfParser_dataReady", function(pdfData){
		try{
			var lines = extractLines(pdfData);
			LOG("read " + lines.length + " lines => parsing...");
			parseLines(lines);
			LOG("done parsing!");
			callbackFct(null, bankSta);
		}
		catch(e){
			callbackFct(e, bankSta);
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

	function validateTotals(/*bankSta*/){
		var totalDebit = 0, totalCredit = 0;
		LOG("validating totals for " + bankSta.ops.length + "operations...");
		bankSta.ops.map(function(op){
			if (op.debit)
				totalDebit += op.debit;
			else if (op.credit)
				totalCredit += op.credit;
			else
				throw new Error("operation without credit or debit");
		});
		LOG("total debit:", totalDebit, "total credit:", totalCredit);
		assert(Math.abs(totalDebit - bankSta.totDebit) < 0.001, "total debit is not valid");
		assert(Math.abs(totalCredit - bankSta.totCredit) < 0.001, "total credit is not valid");
		return totalCredit - totalDebit;
	}

	function parseLines(lines){
		var cur = new HsbcCursor(lines);

		cur.parseUntil("Votre Relevé de Compte");
		cur.parseUntil("Compte n°");
		bankSta.acctNum = cur.next() + cur.next();
		LOG("acctNum:", bankSta.acctNum);

		cur.parseUntil("Période");
		var periode = cur.next().match(RE_DATE);
		bankSta.dateTo = periode.pop();
		LOG("dateTo:", bankSta.dateTo);
		bankSta.dateFrom = periode.pop();
		LOG("dateFrom:", bankSta.dateFrom);

		cur.detectColumns();

		cur.parseUntil("SOLDE DE DEBUT DE PERIODE");
		bankSta.balFrom = parseAmount(cur.next());
		LOG("bafFrom:", bankSta.balFrom);

		bankSta.ops = cur.parseOperations();
		bankSta.totDebit = parseAmount(cur.next());
		LOG("totDebit:", bankSta.totDebit);
		bankSta.totCredit = parseAmount(cur.next());
		LOG("totCredit:", bankSta.totCredit);
		var total = validateTotals(bankSta);

		cur.parseUntil("SOLDE DE FIN DE PERIODE");
		bankSta.balTo = parseAmount(cur.next());
		LOG("bafFrom:", bankSta.balTo);

		LOG(["validating balance   (to - from): ", bankSta.balTo, bankSta.balFrom, Math.round((bankSta.balTo - bankSta.balFrom) * 100)/100].join(' '));
		LOG(["validating total (credit - debit):", bankSta.totCredit, bankSta.totDebit, Math.round((bankSta.totCredit - bankSta.totDebit) * 100)/100].join(' '));
		assert(Math.abs(bankSta.balFrom + total - bankSta.balTo) < 0.001, "totals don't match");

		return bankSta;
	}

	this.parseFile = function(pdfFilePath, cb){
		bankSta.filePath = pdfFilePath;
		callbackFct = cb;
		pdfParser.loadPDF(pdfFilePath);
	};
}

module.exports = HsbcStatementParser;