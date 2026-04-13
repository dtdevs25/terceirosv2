FROM node:22-alpine

# Dependências do sistema para compilação de pacotes nativos
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copia manifests de dependências primeiro (melhor cache de layers)
COPY package*.json ./

# Instala TODAS as dependências (incluindo devDependencies para o build)
RUN npm ci

# Copia o restante do código-fonte
COPY . .

# Faz o build do frontend React → dist/
RUN npm run build

# Remove devDependencies após o build para reduzir tamanho da imagem
RUN npm prune --production

# Porta exposta
EXPOSE 3000

# Variáveis de ambiente padrão (sobrepor via CapRover app env vars)
ENV NODE_ENV=production
ENV PORT=3000

# Inicia o servidor Node/Express com tsx (suporte a TypeScript em produção)
CMD ["npx", "tsx", "server/index.ts"]
