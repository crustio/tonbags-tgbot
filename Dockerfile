FROM node:20-alpine AS builder

RUN npm install -g pnpm@v8

WORKDIR /app

COPY . .

COPY package.json pnpm-lock.yaml /app/
RUN cd /app && rm -rf /app/node_modules &&  pnpm install --frozen-lockfile

RUN cd /app && rm -rf /app/dist  && pnpm compile

CMD ["node", "dist/main.js"]
