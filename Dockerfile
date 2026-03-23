FROM node:24.13.0

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libgbm1 \
    libgtk-3-0 \
    libnss3 \
    libxss1 \
    libasound2 \
    xdg-utils

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

CMD ["node", "index.js"]