HsbcStatementParser
===================

Parses and converts [HSBC](http://hsbc.com) bank statements downloaded in PDF format into a list of operations in JSON or TSV format.

Relies on [Modesty's PDF2JSON](http://github.com/modesty/pdf2json) Node.js module.

Only supports statements in French language, for now.

CLI Syntax
----------

hsbcextr <json|tsv|null|1line|test> <pdf_file_name_1> [<pdf_file_name_2> [<pdf_file_name_3> ...]]

Usage
-----

  var parser = new HsbcStatementParser();
  parser.parseFile(pdfFilePath, function(err, sta){
  	if (err)
  		console.error(err.stack);
  	else {
  	  console.log("parsed " + sta.ops.length + " operations");
  	  console.log("closing balance: " + sta.balTo);
  	}
  });
