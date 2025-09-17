DISPLAY_NAME=Zenkae Bot
MAIN=dist/index.js
MEMORY=512
VERSION=recommended
BUILD=npx tsc src/index.ts --outDir dist --module commonjs --target es2022 --esModuleInterop true
START=node dist/index.js