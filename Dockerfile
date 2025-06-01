# Dockerfile (Node.js)

# Stage 1: Build the TypeScript application
FROM node:18-alpine AS build

WORKDIR /app

# package.json 및 잠금 파일 복사
COPY package*.json ./

# 의존성 설치
RUN npm install

# TypeScript 코드 복사
COPY . .

# TypeScript 컴파일
RUN npm run build

# Stage 2: Create the final runtime image
FROM node:18-alpine

WORKDIR /app

# 빌드 스테이지에서 생성된 컴파일된 JavaScript 코드와 node_modules 복사
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY package.json ./ # 실행에 필요한 경우 (예: npm start)

# 컨테이너 시작 시 실행될 명령어 정의
CMD ["npm", "start"]