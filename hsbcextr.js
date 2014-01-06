var PFParser = require("./node_modules/pdf2json/pdfparser");

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

function parseText(text){
	var OP_COLS = ["Date", "Détail", "Valeur", "e" /*exo*/, "Débit", "Crédit"];
	var colPos = [];

	var bankSta = {
		acctNum: null,
		dateFrom: null,
		dateTo: null,
		balFrom: null,
		balTo: null,
		ops: []
	};

	var cur = new Cursor(text, function(line){return line[0];});

	cur.parseOperation = function(){
		var op = {
			date: null,
			text: [],
			dateVal: null,
			exo: null,
			debit: null,
			credit: null
		};
		// 1) date
		op.date = this.next();
		// 2) text + dateVal
		do {
			this.next();
			/*if (this.line.match(RE_DATE_SHORT))
				op.dateVal = this.line;
			else
				op.text.push(this.line);*/
			if (this.rawLine[1] < colPos[2])
				op.text.push(this.line);
			else
				break;
		} while(/*!op.dateVal*/ 1);
		// 3)

		op.dateVal = this.line;

		return op.text.length && op;
	}

	cur.parseUntil("Votre Relevé de Compte");
	cur.parseUntil("Compte n°");
	bankSta.acctNum = cur.next() + cur.next();

	cur.parseUntil("Période");
	var periode = cur.next().match(RE_DATE);
	bankSta.dateTo = periode.pop();
	bankSta.dateFrom = periode.pop();

	for (var i in OP_COLS) {
		cur.parseUntil(OP_COLS[i]);
		colPos.push(cur.rawLine[1]);
	}

	console.log("column positions")
	console.log(OP_COLS.join("\t"));
	console.log(colPos.join("\t"));

	cur.parseUntil("SOLDE DE DEBUT DE PERIODE");
	bankSta.balFrom = cur.next();

	for(;;){
		var op = cur.parseOperation();
		if (op)
			bankSta.ops.push(op);
		else
			break;
	}

	console.log("bank Statement", bankSta);
	console.log("bank Operations\n", bankSta.ops.map(function(op){
		return [op.date, op.text.join(" ")];
	}).join("\n"));

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
});

// start parsing

var pdfFilePath = "20130102_RELEVE DE COMPTE_00360070251.pdf";
pdfParser.loadPDF(pdfFilePath);
