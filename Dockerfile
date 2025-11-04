FROM node

# all run commands will be set to this cwd
WORKDIR /app

# put before npm install to avoid redundant reinstalls if package.json doesnt change
COPY package.json /app

RUN npm install

# COPY . ./ relative to cwd, same as above
COPY . /app

# optional, still need -p 3000:80 in docker run command
EXPOSE 80

# after image is created, use CMD.
CMD ["node", "server.js"]

# docker build . -> will build image based on Dockerfile in cwd


