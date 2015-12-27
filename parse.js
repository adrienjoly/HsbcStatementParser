var PdfReader = require('pdfreader').PdfReader;
var Rule = require('pdfreader').Rule;

function displayValues(values) {
	console.log('=>', values);
}

var processItem = Rule.makeItemProcessor([
	Rule.on(/^Du ([^\s]+) au\s+(.+)/).extractRegexpValues().then(displayValues),
]);

new PdfReader().parseFileItems('20151102_RELEVE DE COMPTE_00360070251.pdf', function(err, item){
	processItem(item);
});
