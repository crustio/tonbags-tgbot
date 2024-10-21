FROM node:20-alpine AS builder

RUN npm install -g npm@latest

WORKDIR /app



COPY . .

COPY package.json /app/package.json
RUN rm -rf /app/package-lock.json
RUN cd /app && rm -rf /app/node_modules &&  npm install

RUN cd /app && rm -rf /app/dist  && npm run compile

CMD ["node", "dist/main.js"]
