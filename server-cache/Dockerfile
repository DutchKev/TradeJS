FROM mhart/alpine-node:11.11.0

ARG env

# shared
COPY /shared/modules/coinpush /usr/src/app/shared/modules/coinpush

# server
WORKDIR /usr/src/app/server-cache
COPY /server-cache/package.json /server-cache/tsconfig.json ./
RUN npm i --quiet --no-progress
COPY /server-cache/src ./src

# dist build
RUN if [ "$env" = "production" ] ; then npm run build && npm prune --production && rm -rf src; fi