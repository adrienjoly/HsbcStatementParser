var PdfReader = require('pdfreader').PdfReader;

new PdfReader().parseFileItems('20151102_RELEVE DE COMPTE_00360070251.pdf', function(err, item){
	console.log(item.text);
});
