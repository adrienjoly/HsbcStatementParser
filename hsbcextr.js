var PFParser = require("./node_modules/pdf2json/pdfparser");

// conversion functions

function extractTextPages(pdf){
	return pdf.data.Pages.map(function(page){
		return page.Texts.map(function(text){
			return decodeURIComponent(text.R[0].T);
		});
	});
}

// init parser

var pdfParser = new PFParser();

pdfParser.on("pdfParser_dataError", function(err){
	console.error(err);
});

pdfParser.on("pdfParser_dataReady", function(pdf){
	var textPages = extractTextPages(pdf);
	console.log("textPages", textPages);
});

// start parsing

var pdfFilePath = "20130102_RELEVE DE COMPTE_00360070251.pdf";
pdfParser.loadPDF(pdfFilePath);
