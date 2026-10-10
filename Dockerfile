FROM node:18.18.2-alpine AS client-build

WORKDIR /home/app/client

COPY client/package.json client/package-lock.json ./
RUN npm ci

COPY client/ ./
RUN npm run build

FROM node:18.18.2-alpine

USER node

WORKDIR /home/app/server

COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev

WORKDIR /home/app

COPY server ./server
COPY --from=client-build /home/app/client/build ./client/build

WORKDIR /home/app/server

CMD [ "node", "app.js" ]
