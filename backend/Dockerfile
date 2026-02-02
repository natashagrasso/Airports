FROM node:18-alpine

WORKDIR /app

# Copiamos los archivos de dependencias
COPY package*.json ./

# Instalamos las librerías
RUN npm install

# Copiamos el resto del código
COPY . .

# Exponemos el puerto 3000
EXPOSE 3000

# Comando por defecto (aunque docker-compose usa 'npm run dev')
CMD ["npm", "start"]