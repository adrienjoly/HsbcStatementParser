var sys = require("util");
var HsbcStatementParser = require("./HsbcStatementParser.js");

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
	"null": function(sta){
		return "";
	},
	"1line": function(sta){
		return sta.filePath.split("/").pop() + " -> " + sta.ops.length + " operations -> closing balance: " + sta.balTo;
	},
	"test": function(sta){
		return [
			"File: " + sta.filePath,
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
	var pdfFiles = process.argv.slice(3);

	if (process.argv < 4 || !render) {
		console.warn("Syntax: hsbcextr <json|tsv|null|1line|test> <pdf_file_name>");
		return;
	}
	else
		(function next(){
			var pdfFilePath = pdfFiles.shift();
			if (!pdfFilePath)
				return;
			var parser = new HsbcStatementParser();
			//console.log("\n___\nLoading " + pdfFilePath + " ...\n");
			parser.parseFile(pdfFilePath, function(err, bankStatement){
				try {
					console.log(render(bankStatement));
				} catch(err){
					console.error(err.stack);
				}
				if (err)
					console.error(err.stack);
				else
					next();
			});
		})();
})();
