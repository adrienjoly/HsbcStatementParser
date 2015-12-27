var PdfReader = require('pdfreader').PdfReader;
var Rule = require('pdfreader').Rule;

function displayFollowingLines(lines) {
	console.log('=>', lines);
}

var processItem = Rule.makeItemProcessor([
  Rule.on(/^Votre Relevé de Compte$/).accumulateAfterHeading().then(displayFollowingLines),
]);

new PdfReader().parseFileItems('20151102_RELEVE DE COMPTE_00360070251.pdf', function(err, item){
	processItem(item);
});
