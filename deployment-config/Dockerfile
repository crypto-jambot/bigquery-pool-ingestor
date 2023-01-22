FROM node:latest

# Create app directory
WORKDIR /usr/src/app

ARG NPM_TOKEN
COPY . .
RUN touch .npmrc
RUN echo unsafe-perm=true > .npmrc
RUN echo //npm.pkg.github.com/:_authToken=${NPM_TOKEN} >> .npmrc
RUN echo @crypto-jambot:registry=https://npm.pkg.github.com/ >> .npmrc
RUN npm install
RUN rm -f .npmrc

EXPOSE 8080

CMD ["npm", "start"]