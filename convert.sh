# set mac osx's terminal title
echo -n -e "\033]0;converting HSBC statements...\007"

# make sure to switch to the script's dir (e.g. when launched via mac osx's finder)
cd `dirname "$0"`

cd tmp
for pdfFile in *.pdf
do
	echo converting $pdfFile "->" $pdfFile.csv ...
	node ../hsbcextr.js csv2 $pdfFile >"$pdfFile.csv"
done
cd ..