FROM nginx:alpine

COPY index.html /usr/share/nginx/html/index.html
COPY lab.html /usr/share/nginx/html/lab.html
COPY src/ /usr/share/nginx/html/src/
COPY vendor/ /usr/share/nginx/html/vendor/
COPY docs/ /usr/share/nginx/html/docs/
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
