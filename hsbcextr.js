var PFParser = require("./node_modules/pdf2json/pdfparser");

// conversion functions

var PAGE_BREAK = "^^^";

function extractTextPages(pdf){
	return pdf.data.Pages.map(function(page){
		return page.Texts.map(function(text){
			return decodeURIComponent(text.R[0].T);
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

function parseText(text){
	var OP_COLS = ["Date", "Détail", "Valeur", "exo", "Débit", "Crédit"];
	var bankSta = {
		acctNum: null,
		dateFrom: null,
		dateTo: null,
		balFrom: null,
		balTo: null,
		ops: []
	};
	var ops = [];

	var i = 0, line = null;
	function next(){
		return line = text[i++];
	}

	function parseUntil(str){
		do {
			line = next();
		} while(line && line.indexOf(str));
		return line == str;
	}

	function parseOperation(){
		var op = {
			date: null,
			text: [],
			dateVal: null,
			exo: null,
			debit: null,
			credit: null
		};
		// 1) date
		op.date = next();
		// 2) text + dateVal
		do {
			next();
			if (line.match(RE_DATE_SHORT))
				op.dateVal = line;
			else
				op.text.push(line);
		} while(!op.dateVal);
		// 3)
		
		return op.text.length && op;
	}

	parseUntil("Votre Relevé de Compte");
	parseUntil("Compte n°");
	bankSta.acctNum = next() + next();

	parseUntil("Période");
	var periode = next().match(RE_DATE);
	bankSta.dateTo = periode.pop();
	bankSta.dateFrom = periode.pop();

	parseUntil("SOLDE DE DEBUT DE PERIODE");
	bankSta.balFrom = next();

	for(;;){
		var op = parseOperation();
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
