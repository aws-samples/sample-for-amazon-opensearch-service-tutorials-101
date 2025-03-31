FROM public.ecr.aws/docker/library/node:20.11-alpine3.19 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
FROM public.ecr.aws/nginx/nginx:stable-bookworm
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
CMD ["nginx", "-g", "daemon off;"]
