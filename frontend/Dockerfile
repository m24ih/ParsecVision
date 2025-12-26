FROM node:20-alpine

WORKDIR /app

# package.json'ları kopyala ve yükle
COPY package.json package-lock.json ./
RUN npm install

# Tüm kodları kopyala
COPY . .

# Vite varsayılan portu
EXPOSE 5173

# --host parametresi dışarıdan erişim için şarttır
CMD ["npm", "run", "dev", "--", "--host"]
