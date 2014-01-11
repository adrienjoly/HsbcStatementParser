var PFParser = require("./node_modules/pdf2json/pdfparser");

// doc: https://github.com/modesty/pdf2json

// conversion functions

var PAGE_BREAK = ["^^^", "^^^"];

function extractTextPages(pdf){
	return pdf.data.Pages.map(function(page){
		return page.Texts.map(function(text){
			return [decodeURIComponent(text.R[0].T), text.x];
			// each line is [text, x-pos]
		});
	});
}

function extractText(textPages){
	return textPages.reduce(function(a,b){
		return a.concat([PAGE_BREAK]).concat(b);
	});
}

var RE_DATE = /\d\d\.\d\d\.\d\d\d\d/g;
var RE_DATE_SHORT = /\d\d\.\d\d/g;
var OP_COLS = ["Date", "Détail", "Valeur", "e" /*exo*/, "Débit", "Crédit"];

function Cursor(lines, valFct){
	var i = 0;
	this.line = null;
	this.rawLine = null;

	this.next = function(){
		return this.line = valFct(this.rawLine = lines[i++]);
	}

	this.parseUntil = function(str){
		do {
			this.next();
		} while(this.line && this.line.indexOf(str));
		return this.line == str;
	}
}

function HsbcCursor(lines){
	// call super constructor
	Cursor.call(this, lines, function(line){return line[0];})

	var OP_COL_IDS = ["date", "text", "datev", "exo", "debit", "credit"];
	var colPos =     [    16,     59,      66,    70,      86          ];
	var OP_AMOUNT_IDX = 4;

	this.detectColumns = function(){
		for (var i in OP_COLS) {
			this.parseUntil(OP_COLS[i]);
			//colPos.push(cur.rawLine[1]);
		}
		//colPos.push(9999); // max x value
		//console.log("column positions")
		//console.log(OP_COLS.join("\t"));
		//console.log(colPos.join("\t"));
	};

	function parseOperation(){
		var op = {};
		//console.log("===new op");
		if (!this.line || !this.line.match(RE_DATE_SHORT))
			return null; //throw new Error("operation must start with a short date");
		for(;;) {
			for (var i=0; i<colPos.length; ++i)
				if (this.rawLine[1] < colPos[i])
					break;
			if (op.debit && i > OP_AMOUNT_IDX)
				break;
			if (op[OP_COL_IDS[i]])
				op[OP_COL_IDS[i]] += "\n" + this.line;	
			else
				op[OP_COL_IDS[i]] = this.line;
			//console.log(OP_COL_IDS[i], this.line);
			this.next();
			if (!this.line || this.rawLine[1] < colPos[0])
				break;
		}
		return op;
	};

	this.parseOperations = function(){
		var ops = [];
		this.next();
		for(;;){
			var op = parseOperation.call(this);
			console.log(!!op);
			if (op)
				ops.push(op);
			else
				break;
		}
		return ops;
	};
}

HsbcCursor.prototype = new Cursor;

function parseText(text){
	var bankSta = {
		acctNum: null,
		dateFrom: null,
		dateTo: null,
		balFrom: null,
		balTo: null,
		ops: []
	};

	var cur = new HsbcCursor(text);

	cur.parseUntil("Votre Relevé de Compte");
	cur.parseUntil("Compte n°");
	bankSta.acctNum = cur.next() + cur.next();

	cur.parseUntil("Période");
	var periode = cur.next().match(RE_DATE);
	bankSta.dateTo = periode.pop();
	bankSta.dateFrom = periode.pop();

	cur.detectColumns();

	cur.parseUntil("SOLDE DE DEBUT DE PERIODE");
	bankSta.balFrom = cur.next();

	bankSta.ops = cur.parseOperations();

	//textPages.
	return bankSta;
}

// init parser

var pdfParser = new PFParser();

pdfParser.on("pdfParser_dataError", function(err){
	console.error(err);
});

pdfParser.on("pdfParser_dataReady", function(pdf){
	var textPages = extractTextPages(pdf);
	var text = extractText(textPages);
	//console.log("textPages", text);
	var bankStatement = parseText(text);
	console.log("bank Statement", bankStatement);
	/*console.log("bank Operations\n" + bankSta.ops.map(function(op){
		return op.date + " : " + op.text.replace(/\n/g, " ");
	}).join("\n"));*/
});

// start parsing

var pdfFilePath = "20130102_RELEVE DE COMPTE_00360070251.pdf";
try {
	pdfParser.loadPDF(pdfFilePath);
} catch (e) {
	console.error(e.stack);
}
