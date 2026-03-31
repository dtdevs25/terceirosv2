FROM node:22-alpine

# Definindo diretório de trabalho
WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./

# Instalar dependências
RUN npm ci

# Copiar o restante dos arquivos (código fonte, configurações, etc)
COPY . .

# Fazer o build do frontend gerando a pasta dist/
RUN npm run build

# Expor a porta 3000 (ou a configurada em PORT)
EXPOSE 3000

# Adicionar variáveis de ambiente padrões seguras (sobreponíveis via CapRover)
ENV NODE_ENV=production
ENV PORT=3000

# Executar a API via TSX e servir o projeto final integrado
CMD ["npx", "tsx", "server/index.ts"]
