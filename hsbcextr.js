var sys = require("util");
var parser = require("./HsbcStatementParser.js");

// parse bank statement

var renderers = {
	"json": function(bankStatement){
		return sys.inspect(bankStatement);
	},
	"tsv": function(sta){
		return sta.ops.map(function(op){
			//return op.date + ", " + op.text.replace(/[\n\s]+/g, " ");
			return [op.date, op.text.replace(/[\n\s]+/g, " ").substr(0, 14), op.credit || -op.debit].join("\t");
		}).join("\n");
	},
	"test": function(sta){
		return [
			"Account number: " + sta.acctNum,
			"Period: from " + sta.dateFrom + " to " + sta.dateTo,
			"Opening balance: " + sta.balFrom,
			" - - - - - - - ",
		].concat(sta.ops.map(function(op){
			return [op.date, op.text.replace(/[\n\s]+/g, " ").substr(0, 14), op.credit || -op.debit].join("\t");
		})).concat([
			" - - - - - - - ",
			"Closing balance: " + sta.balTo,
			"Total debit: " + sta.totDebit,
			"Total credit: " + sta.totCredit,
		]).join("\n");
	}
};

(function main(){
	var render = renderers[process.argv[2]];
	var pdfFilePath = process.argv[3]; //"20130102_RELEVE DE COMPTE_00360070251.pdf";

	if (/*process.argv != 4 ||*/ !render || !pdfFilePath) {
		console.warn("Syntax: hsbcextr <json|tsv|qif> <pdf_file_name>");
		return;
	}
	else
		parser.parseFile(pdfFilePath, function(err, bankStatement){
			if (err)
				console.error(err.stack);
			else
				console.log(render(bankStatement));
		});
})();
