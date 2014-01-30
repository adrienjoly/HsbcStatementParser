var sys = require("util");
var assert = require("assert");
var HsbcStatementParser = require("./HsbcStatementParser.js");

// parse bank statement

var renderers = {
	"json": function(bankStatement){
		return sys.inspect(bankStatement);
	},
	"csv": function(sta){
		return sta.ops.map(function(op){
			return ["\"" + op.date + "\"", "\"" + op.text.replace(/[\"]+/g, "\\\"") + "\"", "\"" + op.datev + "\"", op.exo, op.debit, op.credit].join(",");
		}).join("\n");
	},
	"csv2": function(sta){
		function toCents(val){
			if (!val)
				return 0;
			val = "" + val;
			var pos = val.indexOf(".");
			return parseInt(pos == -1 ? val + "00" : val.substr(0, pos) + (val+"00").substr(pos+1, 2));
		}
		// 1) compute number of years covered by this statement
		var year = parseInt(sta.dateTo.substr(6)),
			prevMonth,
			nbYears = 0,
			balance = toCents(sta.balFrom);
		sta.ops.map(function(op){
			var curMonth = parseInt(op.date.substr(3));
			if (prevMonth && curMonth < prevMonth)
				++nbYears;
			prevMonth = curMonth;
			op.yearOffset = nbYears;
		});
		// 2) generate output
		var output = sta.ops.map(function(op){
			//console.log(balance/100, "-", (op.debit||0), "+", (op.credit||0), balance/100 - (op.debit||0) + (op.credit||0));
			//console.log(balance, "-", toCents(op.debit), "+", toCents(op.credit), balance - toCents(op.debit) + toCents(op.credit));
			return [
				op.date + "." + (year - nbYears + op.yearOffset),
				"\"" + op.text.replace(/[\"]+/g, "\\\"").replace("CB N\n", "CB N") + "\"",
				op.datev,
				op.exo,
				op.debit,
				op.credit,
				(balance = balance - toCents(op.debit) + toCents(op.credit)) / 100
			].join(",");
		}).join("\n");
		//console.log(balance/100, " .. expected:", sta.balTo);
		assert(Math.abs(balance - toCents(sta.balTo)) < 1, "unexpected computed balance value");
		return output;
	},
	"tsv": function(sta){
		return sta.ops.map(function(op){
			return [op.date, op.text.replace(/[\n]+/g, ", ").replace(/[\s\t]+/g, " "), op.datev, op.exo, op.debit, op.credit].join("\t");
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
		console.warn("Syntax: hsbcextr <json|csv|csv2|tsv|null|1line|test> [options] <pdf_file_name>");
		return;
	}
	else
		(function next(){
			var pdfFilePath = pdfFiles.shift();
			if (!pdfFilePath)
				return;
			var parser = new HsbcStatementParser();
			//console.warn("\n___\nLoading " + pdfFilePath + " ...\n");
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
