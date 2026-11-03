#!/usr/bin/env bash
# Runs the PHP integration suites, each in its own PHP process, against the Local site this repo sits in.
#
#   tests/php/run.sh                    every suite
#   tests/php/run.sh quote-requests/pdf one suite (path under tests/php, .php optional)
#
# PHP_BIN picks the PHP binary (Local's, for its MySQL socket and extensions), e.g.
#   PHP_BIN="$HOME/Library/Application Support/Local/lightning-services/php-8.2.30+1/bin/darwin-arm64/bin/php"
# The suites test dist/: build or sync it first (rsync -a src/inc/ dist/inc/ for PHP-only changes).
# See tests/php/README.md.

cd "$(dirname "$0")" || exit 2
PHP_BIN="${PHP_BIN:-php}"

if [ $# -gt 0 ]; then
	suites=()
	for s in "$@"; do suites+=("${s%.php}.php"); done
else
	suites=($(find . -mindepth 2 -name '*.php' | sed 's#^\./##' | sort))
fi

passed=0; failed=0; skipped=0; failed_list=()
for suite in "${suites[@]}"; do
	output=$("$PHP_BIN" -d memory_limit=1024M "$suite" 2>&1)
	code=$?
	checks=$(grep -c '^PASS ' <<<"$output")
	if grep -q '^SKIP ' <<<"$output" && [ $code -eq 0 ]; then
		skipped=$((skipped + 1))
		echo "SKIP  $suite: $(grep -m1 '^SKIP ' <<<"$output" | cut -c6-)"
	elif [ $code -eq 0 ] && grep -q '^ALL PASSED' <<<"$output"; then
		passed=$((passed + 1))
		echo "PASS  $suite ($checks checks)"
	else
		failed=$((failed + 1)); failed_list+=("$suite")
		echo "FAIL  $suite"
		grep -E '^FAIL |Fatal error|Uncaught|Parse error' <<<"$output" | sed 's/^/      /' | cut -c1-300
	fi
done

echo
echo "$passed passed, $failed failed, $skipped skipped"
[ $failed -eq 0 ]
