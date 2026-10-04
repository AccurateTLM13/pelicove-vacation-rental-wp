#!/bin/bash
# usage: lh.sh OUTDIR BASE [pages...]
OUT=$1; BASE=$2; shift 2; mkdir -p $OUT
declare -A P=([home]=/ [the-house]=/the-house/ [gallery]=/gallery/ [rates]=/rates-availability/ [contact]=/contact-book/)
NAMES=${@:-home the-house gallery rates contact}
for n in $NAMES; do for s in mobile desktop; do
  extra=""; [ $s = desktop ] && extra="--preset=desktop"
  CHROME_PATH=/usr/bin/google-chrome npx lighthouse "$BASE${P[$n]}" $extra --quiet --output=json --output-path=$OUT/lh-$n-$s.json \
    --chrome-flags="--headless=new --no-sandbox --disable-gpu" --only-categories=performance,accessibility,best-practices,seo >/dev/null 2>&1 || echo "fail $n $s"
  echo "done $n $s"
done; done
