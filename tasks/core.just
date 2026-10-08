# Shared setup: every recipe runs through the console wrapper
# (.shell-wrapper.sh sources tasks/shell-source.sh: info/success/warn/error,
# header/section banners, is_true/is_false).
set shell := ["./.shell-wrapper.sh", "-c"]
