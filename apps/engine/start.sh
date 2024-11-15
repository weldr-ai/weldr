#!/bin/sh

pnpm start & /tired-proxy --origin=http://localhost:3000 --port=3000
