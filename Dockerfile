# Production image. Assumes @certifieddata/verify is published to npm.
# For local development before that publish, use `npm install && npm start`
# directly — the Dockerfile pins to a real npm version, not file:../verify.

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=optional
COPY tsconfig.json ./
COPY src ./src
COPY fixtures ./fixtures
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/fixtures ./fixtures
COPY --from=build /app/package.json ./package.json
EXPOSE 3000
CMD ["node", "dist/server.js"]
