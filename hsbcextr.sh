# set mac osx's terminal title
echo -n -e "\033]0;converting HSBC statement...\007"

# make sure to switch to the script's dir (e.g. when launched via mac osx's finder)
cd `dirname "$0"`

node hsbcextr.js csv2 $@
