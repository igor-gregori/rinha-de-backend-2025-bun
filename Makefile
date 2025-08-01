build:
	docker compose build

up:
	export WATCH_FILES=0 && docker compose up -d

logs:
	docker compose logs -f -n 10

logs-leader:
	docker compose logs payment-proxy-leader -f -n 10

logs-follower:
	docker compose logs payment-proxy-follower -f -n 10

logs-lb:
	docker compose logs nginx -f -n 10

down:
	docker compose down

login:
	docker compose exec payment-proxy sh

rebuild:
	docker compose down && docker compose build --no-cache && docker compose up -d
