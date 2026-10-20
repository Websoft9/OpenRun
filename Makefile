.PHONY: app-list app-restart app-start app-status app-stop build connector db-demo db-import db-init db-reset db-seed-contentful db-seed-languages db-seed-licenses db-seed-industries db-seed-markets db-seed-platforms db-seed-processes help opencode opencode-clear sync-languages sync-markets sync-spdx

ifeq ($(OS),Windows_NT)
PYTHON ?= py
else
PYTHON ?= python3
endif

run_dir ?= .run
p ?= 9000
p_is_explicit := $(if $(filter command line,$(origin p)),yes,no)
app_cmd_match := dist/server\.js|src/server\.tsx
app_key := p$(p)
app_pid_file := $(run_dir)/$(app_key).pid
app_port_file := $(run_dir)/$(app_key).port
app_log_file := $(run_dir)/$(app_key).log
app_default_port_file := $(run_dir)/default.port

help:
	@printf '\n  \033[1;36mOpenWise make targets\033[0m\n\n'
	@printf '  \033[2mUsage\033[0m: \033[1;32mmake <target>\033[0m\n\n'
	@printf '  \033[1;35m▸ Build & Data\033[0m\n'
	@printf '  \033[2mmake \033[0m\033[1;32m%-18s\033[0m %s\n' 'build' 'compile TypeScript into dist/'
	@printf '  \033[2mmake \033[0m\033[1;32m%-18s\033[0m %s\n' 'db-init' 'apply migrations and seed reference data'
	@printf '  \033[2mmake \033[0m\033[1;32m%-18s\033[0m %s\n' 'db-demo' 'add deterministic demo products for local development'
	@printf '  \033[2mmake \033[0m\033[1;32m%-18s\033[0m %s\n' 'db-import' 'import a catalog JSON snapshot (ARGS=path)'
	@printf '  \033[2mmake \033[0m\033[1;32m%-18s\033[0m %s\n' 'db-seed-contentful' 'seed catalog and products from the checked-in Contentful snapshot'
	@printf '  \033[2mmake \033[0m\033[1;32m%-18s\033[0m %s\n' 'db-seed-licenses' 'seed licenses from the checked-in SPDX snapshot'
	@printf '  \033[2mmake \033[0m\033[1;32m%-18s\033[0m %s\n' 'db-seed-languages' 'seed programming languages from the checked-in Linguist snapshot'
	@printf '  \033[2mmake \033[0m\033[1;32m%-18s\033[0m %s\n' 'db-seed-markets' 'seed economic regions and countries from the checked-in World Bank snapshot'
	@printf '  \033[2mmake \033[0m\033[1;32m%-18s\033[0m %s\n' 'db-seed-platforms' 'seed OS/CPU platform reference data from source'
	@printf '  \033[2mmake \033[0m\033[1;32m%-18s\033[0m %s\n' 'db-seed-processes' 'seed the PCF-aligned L1/L2/L3 process model'
	@printf '  \033[2mmake \033[0m\033[1;32m%-18s\033[0m %s\n' 'db-seed-industries' 'seed ISIC industry reference data from source'
	@printf '  \033[2mmake \033[0m\033[1;32m%-18s\033[0m %s\n' 'sync-markets' 'fetch World Bank country/region data, write a snapshot, update the DB'
	@printf '  \033[2mmake \033[0m\033[1;32m%-18s\033[0m %s\n' 'sync-languages' 'fetch GitHub Linguist languages, write a snapshot, update the DB'
	@printf '  \033[2mmake \033[0m\033[1;32m%-18s\033[0m %s\n' 'sync-spdx' 'fetch the latest SPDX License List, write a snapshot, update the DB'
	@printf '  \033[2mmake \033[0m\033[1;32m%-18s\033[0m %s\n' 'db-reset' 'drop all tables, migrate and reseed reference data'
	@printf '\n'
	@printf '  \033[1;35m▸ Dev\033[0m\n'
	@printf '  \033[2mmake \033[0m\033[1;32m%-18s\033[0m %s\n' 'app-list' 'list managed and auto-discovered app instances'
	@printf '  \033[2mmake \033[0m\033[1;32m%-18s\033[0m %s\n' 'app-restart' 'restart one app instance (arg: p=9000)'
	@printf '  \033[2mmake \033[0m\033[1;32m%-18s\033[0m %s\n' 'app-start' 'build, then start on p=9000 or next free port when p is omitted'
	@printf '  \033[2mmake \033[0m\033[1;32m%-18s\033[0m %s\n' 'app-status' 'show one app instance status (arg: p=9000)'
	@printf '  \033[2mmake \033[0m\033[1;32m%-18s\033[0m %s\n' 'app-stop' 'stop one app instance (arg: p=9000)'
	@printf '  \033[2mmake \033[0m\033[1;32m%-18s\033[0m %s\n' 'opencode-clear' 'list opencode sessions, confirm, then delete them (ARGS: --all/--dry-run)'
	@printf '  \033[2mmake \033[0m\033[1;32m%-18s\033[0m %s\n' 'opencode' 'start opencode with proxy disabled'
	@printf '\n'
	@printf '  \033[1;35m▸ Config & Setup\033[0m\n'
	@printf '  \033[2mmake \033[0m\033[1;32m%-18s\033[0m %s\n' 'connector' 'interactively write .secrets/<provider>.env for API tokens, MCP, DNS and cloud credentials'
	@printf '  \033[2mmake \033[0m\033[1;32m%-18s\033[0m %s\n' 'help' 'show this help'
	@printf '\n'
	@printf '  \033[2mExamples\033[0m\n'
	@printf '  \033[2m%-28s\033[0m %s\n' 'make build' 'compile the app'
	@printf '  \033[2m%-28s\033[0m %s\n' 'make db-init' 'apply migrations and seed reference data'
	@printf '  \033[2m%-28s\033[0m %s\n' 'make db-demo' 'add demo products to the local database'
	@printf '  \033[2m%-28s\033[0m %s\n' 'make app-list' 'show managed and auto-discovered instances'
	@printf '  \033[2m%-28s\033[0m %s\n' 'make app-start' 'build and start on 9000 or next free port above 9000'
	@printf '  \033[2m%-28s\033[0m %s\n' 'make app-start p=9001' 'start on an explicitly chosen port'
	@printf '  \033[2m%-28s\033[0m %s\n' 'make app-stop p=9001' 'stop the app listening on port 9001'
	@printf '\n'

build:
	@npm run build

db-init:
	@npm run db:init

db-reset:
	@npm run db:reset

db-demo:
	@npm run db:demo

db-import:
	@npm run catalog:import -- $(ARGS)

db-seed-contentful:
	@npm run db:seed:contentful

db-seed-licenses:
	@npm run db:seed:licenses

db-seed-languages:
	@npm run db:seed:languages

db-seed-markets:
	@npm run db:seed:markets

db-seed-platforms:
	@npm run db:seed:platforms

db-seed-processes:
	@npm run db:seed:processes

db-seed-industries:
	@npm run db:seed:industries

sync-markets:
	@npm run sync:markets

sync-languages:
	@npm run sync:languages

sync-languages sync-markets sync-spdx:
	@npm run sync:spdx


opencode:
	@echo "Starting opencode (proxy disabled)..."
	@unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy ALL_PROXY all_proxy; \
	set -a; \
	for file in .secrets/*.env; do \
	  [ -f "$$file" ] && . "$$file"; \
	done; \
	set +a; \
	no_proxy="*" NO_PROXY="*" opencode

opencode-clear:
	@$(PYTHON) build/opencode_delete.py $(ARGS)

app-start: build
	@mkdir -p $(run_dir)
	@bash -lc 'set -e; \
	  requested_port="$(p)"; explicit_port="$(p_is_explicit)"; alias_file="$(app_default_port_file)"; \
	  choose_port() { \
	    local probe="$$1" pid=""; \
	    while :; do \
	      pid=""; \
	      while IFS= read -r line; do pid="$$line"; break; done < <(lsof -tiTCP:$$probe -sTCP:LISTEN 2>/dev/null || true); \
	      if [ -z "$$pid" ]; then \
	        printf "%s" "$$probe"; \
	        return 0; \
	      fi; \
	      probe=$$((probe + 1)); \
	    done; \
	  }; \
	  target_port="$$requested_port"; \
	  if [ "$$explicit_port" != "yes" ]; then \
	    target_port="$$(choose_port "$$requested_port")"; \
	    if [ "$$target_port" != "$$requested_port" ]; then \
	      echo "Port $$requested_port is busy, using $$target_port"; \
	    fi; \
	  fi; \
	  key="p$$target_port"; pid_file="$(run_dir)/$$key.pid"; port_file="$(run_dir)/$$key.port"; log_file="$(run_dir)/$$key.log"; \
	  if [ -f "$$pid_file" ] && kill -0 "$$(cat "$$pid_file")" 2>/dev/null; then \
	    echo "OpenRun is already running on port $$(cat "$$port_file" 2>/dev/null || printf "%s" "$$target_port") with PID $$(cat "$$pid_file")"; \
	    exit 0; \
	  fi; \
	  if [ -f "$$pid_file" ]; then \
	    echo "Removing stale PID file $$pid_file"; \
	    rm -f "$$pid_file" "$$port_file"; \
	  fi; \
	  existing_pid=""; \
	  while IFS= read -r line; do existing_pid="$$line"; break; done < <(lsof -tiTCP:$$target_port -sTCP:LISTEN 2>/dev/null || true); \
	  if [ -n "$$existing_pid" ]; then \
	    existing_cmd="$$(ps -p "$$existing_pid" -o args= 2>/dev/null)"; \
	    if printf "%s\n" "$$existing_cmd" | grep -Eq "$(app_cmd_match)"; then \
	      echo "OpenRun is already listening on port $$target_port with PID $$existing_pid" >&2; \
	    else \
	      echo "Port $$target_port is already in use by PID $$existing_pid" >&2; \
	    fi; \
	    exit 1; \
	  fi; \
	  printf "%s\n" "$$target_port" > "$$port_file"; \
	  if [ "$$explicit_port" != "yes" ]; then \
	    printf "%s\n" "$$target_port" > "$$alias_file"; \
	  fi; \
	  nohup env PORT="$$target_port" node dist/server.js > "$$log_file" 2>&1 & \
	  service_pid=$$!; \
	  printf "%s\n" "$$service_pid" > "$$pid_file"; \
	  attempts=0; \
	  while [ "$$attempts" -lt 20 ]; do \
	    if ! kill -0 "$$service_pid" 2>/dev/null; then \
	      echo "OpenRun failed to start on port $$target_port; see $$log_file" >&2; \
	      tail -n 20 "$$log_file" >&2 || true; \
	      rm -f "$$pid_file" "$$port_file"; \
	      exit 1; \
	    fi; \
	    if lsof -tiTCP:"$$target_port" -sTCP:LISTEN >/dev/null 2>&1; then break; fi; \
	    attempts=$$((attempts + 1)); \
	    sleep 0.25; \
	  done; \
	  if ! lsof -tiTCP:"$$target_port" -sTCP:LISTEN >/dev/null 2>&1; then \
	    echo "OpenRun process $$service_pid is running but not listening on port $$target_port yet" >&2; \
	  fi; \
	  echo "OpenRun started on port $$target_port with PID $$service_pid"; \
	  echo "Log file: $$log_file"'

app-stop:
	@bash -lc 'set -e; \
	  requested_port="$(p)"; explicit_port="$(p_is_explicit)"; alias_file="$(app_default_port_file)"; target_port="$$requested_port"; \
	  if [ "$$explicit_port" != "yes" ] && [ -f "$$alias_file" ]; then \
	    target_port="$$(cat "$$alias_file")"; \
	  fi; \
	  key="p$$target_port"; pid_file="$(run_dir)/$$key.pid"; port_file="$(run_dir)/$$key.port"; \
	  if [ -f "$$pid_file" ] && kill -0 "$$(cat "$$pid_file")" 2>/dev/null; then \
	    pid="$$(cat "$$pid_file")"; \
	    kill "$$pid"; \
	    attempts=0; \
	    while kill -0 "$$pid" 2>/dev/null && [ "$$attempts" -lt 20 ]; do \
	      attempts=$$((attempts + 1)); \
	      sleep 0.25; \
	    done; \
	    if kill -0 "$$pid" 2>/dev/null; then kill -9 "$$pid" 2>/dev/null || true; fi; \
	    echo "Stopped OpenRun on port $$(cat "$$port_file" 2>/dev/null || printf "%s" "$$target_port") (PID $$pid)"; \
	    rm -f "$$pid_file" "$$port_file"; \
	    if [ -f "$$alias_file" ] && [ "$$(cat "$$alias_file")" = "$$target_port" ]; then rm -f "$$alias_file"; fi; \
	    exit 0; \
	  fi; \
	  if [ -f "$$pid_file" ]; then \
	    echo "Removing stale PID file $$pid_file"; \
	    rm -f "$$pid_file" "$$port_file"; \
	    if [ -f "$$alias_file" ] && [ "$$(cat "$$alias_file")" = "$$target_port" ]; then rm -f "$$alias_file"; fi; \
	  fi; \
	  discovered_pid=""; \
	  while IFS= read -r line; do discovered_pid="$$line"; break; done < <(lsof -tiTCP:$$target_port -sTCP:LISTEN 2>/dev/null || true); \
	  if [ -z "$$discovered_pid" ]; then \
	    echo "No OpenRun app is listening on port $$target_port"; \
	    exit 0; \
	  fi; \
	  discovered_cmd="$$(ps -p "$$discovered_pid" -o args= 2>/dev/null)"; \
	  if ! printf "%s\n" "$$discovered_cmd" | grep -Eq "$(app_cmd_match)"; then \
	    echo "Port $$target_port belongs to another process: $$discovered_cmd" >&2; \
	    exit 1; \
	  fi; \
	  kill "$$discovered_pid"; \
	  attempts=0; \
	  while kill -0 "$$discovered_pid" 2>/dev/null && [ "$$attempts" -lt 20 ]; do \
	    attempts=$$((attempts + 1)); \
	    sleep 0.25; \
	  done; \
	  if kill -0 "$$discovered_pid" 2>/dev/null; then kill -9 "$$discovered_pid" 2>/dev/null || true; fi; \
	  if [ -f "$$alias_file" ] && [ "$$(cat "$$alias_file")" = "$$target_port" ]; then rm -f "$$alias_file"; fi; \
	  echo "Stopped discovered OpenRun process on port $$target_port (PID $$discovered_pid)"'

app-restart: app-stop app-start

app-status:
	@bash -lc 'set -e; \
	  requested_port="$(p)"; explicit_port="$(p_is_explicit)"; alias_file="$(app_default_port_file)"; target_port="$$requested_port"; \
	  if [ "$$explicit_port" != "yes" ] && [ -f "$$alias_file" ]; then \
	    target_port="$$(cat "$$alias_file")"; \
	  fi; \
	  key="p$$target_port"; pid_file="$(run_dir)/$$key.pid"; port_file="$(run_dir)/$$key.port"; log_file="$(run_dir)/$$key.log"; \
	  if [ -f "$$pid_file" ] && kill -0 "$$(cat "$$pid_file")" 2>/dev/null; then \
	    echo "OpenRun is running with PID $$(cat "$$pid_file") on port $$(cat "$$port_file" 2>/dev/null || printf "%s" "$$target_port")"; \
	    echo "Source: managed"; \
	    echo "Log file: $$log_file"; \
	    exit 0; \
	  fi; \
	  discovered_pid=""; \
	  while IFS= read -r line; do discovered_pid="$$line"; break; done < <(lsof -tiTCP:$$target_port -sTCP:LISTEN 2>/dev/null || true); \
	  if [ -z "$$discovered_pid" ]; then \
	    echo "No OpenRun app is listening on port $$target_port"; \
	    exit 0; \
	  fi; \
	  discovered_cmd="$$(ps -p "$$discovered_pid" -o args= 2>/dev/null)"; \
	  if printf "%s\n" "$$discovered_cmd" | grep -Eq "$(app_cmd_match)"; then \
	    echo "OpenRun app is running with PID $$discovered_pid on port $$target_port"; \
	    echo "Source: discovered"; \
	    echo "Command: $$discovered_cmd"; \
	  else \
	    echo "Port $$target_port is in use by another process: $$discovered_cmd"; \
	  fi'

app-list:
	@mkdir -p $(run_dir)
	@bash -lc 'set -e; \
	  shopt -s nullglob; \
	  declare -A seen_pids; \
	  found=0; \
	  printf "%-8s %-10s %-8s %s\n" "PORT" "STATUS" "MANAGED" "PID"; \
	  for file in "$(run_dir)"/*.pid; do \
	    pid="$$(cat "$$file")"; \
	    port_file="$${file%.pid}.port"; \
	    port="-"; [ -f "$$port_file" ] && port="$$(cat "$$port_file")"; \
	    status="stopped"; \
	    if kill -0 "$$pid" 2>/dev/null; then status="running"; fi; \
	    printf "%-8s %-10s %-8s %s\n" "$$port" "$$status" "yes" "$$pid"; \
	    seen_pids[$$pid]=1; \
	    found=1; \
	  done; \
	  while IFS= read -r pid; do \
	    [ -n "$$pid" ] || continue; \
	    [ -z "$${seen_pids[$$pid]:-}" ] || continue; \
	    cmd="$$(ps -p "$$pid" -o args= 2>/dev/null)"; \
	    if ! printf "%s\n" "$$cmd" | grep -Eq "$(app_cmd_match)"; then \
	      continue; \
	    fi; \
	    port="-"; \
	    while IFS= read -r line; do \
	      case "$$line" in \
	        n*) port="$${line##*:}"; port="$${port%% *}"; break ;; \
	      esac; \
	    done < <(lsof -Pan -a -p "$$pid" -iTCP -sTCP:LISTEN -Fn 2>/dev/null || true); \
	    printf "%-8s %-10s %-8s %s\n" "$$port" "running" "no" "$$pid"; \
	    found=1; \
	  done < <(lsof -tiTCP -sTCP:LISTEN -c node 2>/dev/null | sort -u); \
	  if [ "$$found" -eq 0 ]; then \
	    echo "No OpenRun instances"; \
	  fi'

connector:
	@mkdir -p .secrets
	@bash -lc 'set -e; \
	  current_choice=1; \
	  if [ "$${PROVIDER:-}" = "cloudflare" ] || [ "$${PROVIDER:-}" = "2" ]; then current_choice=2; fi; \
	  if [ "$${PROVIDER:-}" = "dockerhub" ] || [ "$${PROVIDER:-}" = "3" ]; then current_choice=3; fi; \
	  if [ "$${PROVIDER:-}" = "dns" ] || [ "$${PROVIDER:-}" = "4" ]; then current_choice=4; fi; \
	  if [ "$${PROVIDER:-}" = "alibabacloud" ] || [ "$${PROVIDER:-}" = "5" ]; then current_choice=5; fi; \
	  if [ "$${PROVIDER:-}" = "aws" ] || [ "$${PROVIDER:-}" = "6" ]; then current_choice=6; fi; \
	  if [ "$${PROVIDER:-}" = "azure" ] || [ "$${PROVIDER:-}" = "7" ]; then current_choice=7; fi; \
	  if [ "$${PROVIDER:-}" = "github" ] || [ "$${PROVIDER:-}" = "8" ]; then current_choice=8; fi; \
	  if [ "$${PROVIDER:-}" = "context7" ] || [ "$${PROVIDER:-}" = "9" ]; then current_choice=9; fi; \
	  printf "Available providers:\n  1) contentful\n  2) cloudflare\n  3) dockerhub\n  4) dns\n  5) alibabacloud\n  6) aws\n  7) azure\n  8) github\n  9) context7\n"; \
	  read -r -p "provider [$$current_choice]: " input_choice; input_choice="$${input_choice:-$$current_choice}"; \
	  case "$$input_choice" in \
	    1|contentful) provider="contentful"; file=".secrets/contentful.env"; key="CONTENTFUL_ACCESS_TOKEN" ;; \
	    2|cloudflare) provider="cloudflare"; file=".secrets/cloudflare.env"; key="CLOUDFLARE_API_TOKEN" ;; \
	    3|dockerhub) provider="dockerhub"; file=".secrets/dockerhub.env"; key="DOCKERHUB_TOKEN" ;; \
	    4|dns) provider="dns"; file=".secrets/dns.env" ;; \
	    5|alibabacloud) provider="aliyun"; file=".secrets/aliyun.env" ;; \
	    6|aws) provider="aws"; file=".secrets/aws.env" ;; \
	    7|azure) provider="azure"; file=".secrets/azure.env" ;; \
	    8|github) provider="github"; file=".secrets/github.env"; key="GITHUB_PAT" ;; \
	    9|context7) provider="context7"; file=".secrets/context7.env"; key="CONTEXT7_API_KEY" ;; \
	    *) echo "unsupported provider selection: $$input_choice" >&2; exit 1 ;; \
	  esac; \
	  if [ -f "$$file" ]; then echo "updating $$file"; else echo "creating $$file"; fi; \
	  if [ "$$provider" = "dns" ]; then \
	    cur_dns=""; cur_id=""; cur_secret=""; cur_domain=""; \
	    if [ -f "$$file" ]; then \
	      cur_dns="$$(grep -E '^DNS_PROVIDER=' "$$file" | cut -d= -f2-)"; \
	      cur_id="$$(grep -E '^DNS_KEY_ID=' "$$file" | cut -d= -f2-)"; \
	      cur_secret="$$(grep -E '^DNS_KEY_SECRET=' "$$file" | cut -d= -f2-)"; \
	      cur_domain="$$(grep -E '^DNS_DOMAIN=' "$$file" | cut -d= -f2-)"; \
	    fi; \
	    cur_dns="$${cur_dns:-aliyun}"; \
	    read -r -p "DNS_PROVIDER (e.g. aliyun) [$$cur_dns]: " input_dns; input_dns="$${input_dns:-$$cur_dns}"; \
	    read -r -p "DNS_KEY_ID [$$cur_id]: " input_id; input_id="$${input_id:-$$cur_id}"; \
	    read -r -s -p "DNS_KEY_SECRET [keep existing]: " input_secret; echo; input_secret="$${input_secret:-$$cur_secret}"; \
	    read -r -p "DNS_DOMAIN (wildcard base, e.g. libs.websoft9.cn) [$$cur_domain]: " input_domain; input_domain="$${input_domain:-$$cur_domain}"; \
	    if [ -z "$$input_dns" ] || [ -z "$$input_id" ] || [ -z "$$input_secret" ]; then echo "provider, key id and secret are required" >&2; exit 1; fi; \
	    if [ -n "$$input_domain" ]; then \
	      printf "DNS_PROVIDER=%s\nDNS_KEY_ID=%s\nDNS_KEY_SECRET=%s\nDNS_DOMAIN=%s\n" "$$input_dns" "$$input_id" "$$input_secret" "$$input_domain" > "$$file"; \
	    else \
	      printf "DNS_PROVIDER=%s\nDNS_KEY_ID=%s\nDNS_KEY_SECRET=%s\n" "$$input_dns" "$$input_id" "$$input_secret" > "$$file"; \
	    fi; \
	  elif [ "$$provider" = "aliyun" ]; then \
	    cur_id=""; cur_secret=""; cur_region=""; \
	    if [ -f "$$file" ]; then \
	      cur_id="$$(grep -E '^ALIYUN_ACCESS_KEY_ID=' "$$file" | cut -d= -f2-)"; \
	      cur_secret="$$(grep -E '^ALIYUN_ACCESS_KEY_SECRET=' "$$file" | cut -d= -f2-)"; \
	      cur_region="$$(grep -E '^ALIYUN_REGION=' "$$file" | cut -d= -f2-)"; \
	    fi; \
	    read -r -p "ALIYUN_ACCESS_KEY_ID [$$cur_id]: " input_id; input_id="$${input_id:-$$cur_id}"; \
	    read -r -s -p "ALIYUN_ACCESS_KEY_SECRET [keep existing]: " input_secret; echo; input_secret="$${input_secret:-$$cur_secret}"; \
	    read -r -p "ALIYUN_REGION (optional, e.g. cn-hongkong) [$$cur_region]: " input_region; input_region="$${input_region:-$$cur_region}"; \
	    if [ -z "$$input_id" ] || [ -z "$$input_secret" ]; then echo "access key id and secret are required" >&2; exit 1; fi; \
	    if [ -n "$$input_region" ]; then \
	      printf "ALIYUN_ACCESS_KEY_ID=%s\nALIYUN_ACCESS_KEY_SECRET=%s\nALIYUN_REGION=%s\n" "$$input_id" "$$input_secret" "$$input_region" > "$$file"; \
	    else \
	      printf "ALIYUN_ACCESS_KEY_ID=%s\nALIYUN_ACCESS_KEY_SECRET=%s\n" "$$input_id" "$$input_secret" > "$$file"; \
	    fi; \
	  elif [ "$$provider" = "aws" ]; then \
	    cur_id=""; cur_secret=""; cur_region=""; \
	    if [ -f "$$file" ]; then \
	      cur_id="$$(grep -E '^AWS_ACCESS_KEY_ID=' "$$file" | cut -d= -f2-)"; \
	      cur_secret="$$(grep -E '^AWS_SECRET_ACCESS_KEY=' "$$file" | cut -d= -f2-)"; \
	      cur_region="$$(grep -E '^AWS_REGION=' "$$file" | cut -d= -f2-)"; \
	    fi; \
	    read -r -p "AWS_ACCESS_KEY_ID [$$cur_id]: " input_id; input_id="$${input_id:-$$cur_id}"; \
	    read -r -s -p "AWS_SECRET_ACCESS_KEY [keep existing]: " input_secret; echo; input_secret="$${input_secret:-$$cur_secret}"; \
	    read -r -p "AWS_REGION (optional, e.g. us-east-1) [$$cur_region]: " input_region; input_region="$${input_region:-$$cur_region}"; \
	    if [ -z "$$input_id" ] || [ -z "$$input_secret" ]; then echo "access key id and secret are required" >&2; exit 1; fi; \
	    if [ -n "$$input_region" ]; then \
	      printf "AWS_ACCESS_KEY_ID=%s\nAWS_SECRET_ACCESS_KEY=%s\nAWS_REGION=%s\n" "$$input_id" "$$input_secret" "$$input_region" > "$$file"; \
	    else \
	      printf "AWS_ACCESS_KEY_ID=%s\nAWS_SECRET_ACCESS_KEY=%s\n" "$$input_id" "$$input_secret" > "$$file"; \
	    fi; \
	  elif [ "$$provider" = "azure" ]; then \
	    cur_sub=""; cur_tenant=""; cur_client=""; cur_secret=""; \
	    if [ -f "$$file" ]; then \
	      cur_sub="$$(grep -E '^AZURE_SUBSCRIPTION_ID=' "$$file" | cut -d= -f2-)"; \
	      cur_tenant="$$(grep -E '^AZURE_TENANT_ID=' "$$file" | cut -d= -f2-)"; \
	      cur_client="$$(grep -E '^AZURE_CLIENT_ID=' "$$file" | cut -d= -f2-)"; \
	      cur_secret="$$(grep -E '^AZURE_CLIENT_SECRET=' "$$file" | cut -d= -f2-)"; \
	    fi; \
	    read -r -p "AZURE_SUBSCRIPTION_ID [$$cur_sub]: " input_sub; input_sub="$${input_sub:-$$cur_sub}"; \
	    read -r -p "AZURE_TENANT_ID [$$cur_tenant]: " input_tenant; input_tenant="$${input_tenant:-$$cur_tenant}"; \
	    read -r -p "AZURE_CLIENT_ID [$$cur_client]: " input_client; input_client="$${input_client:-$$cur_client}"; \
	    read -r -s -p "AZURE_CLIENT_SECRET [keep existing]: " input_secret; echo; input_secret="$${input_secret:-$$cur_secret}"; \
	    if [ -z "$$input_sub" ] || [ -z "$$input_tenant" ] || [ -z "$$input_client" ] || [ -z "$$input_secret" ]; then echo "subscription id, tenant id, client id and client secret are required" >&2; exit 1; fi; \
	    printf "AZURE_SUBSCRIPTION_ID=%s\nAZURE_TENANT_ID=%s\nAZURE_CLIENT_ID=%s\nAZURE_CLIENT_SECRET=%s\n" "$$input_sub" "$$input_tenant" "$$input_client" "$$input_secret" > "$$file"; \
	  elif [ "$$provider" = "dockerhub" ]; then \
	    cur_user=""; cur_token=""; cur_org=""; \
	    if [ -f "$$file" ]; then \
	      cur_user="$$(grep -E '^DOCKERHUB_USERNAME=' "$$file" | cut -d= -f2-)"; \
	      cur_token="$$(grep -E '^DOCKERHUB_TOKEN=' "$$file" | cut -d= -f2-)"; \
	      cur_org="$$(grep -E '^DOCKERHUB_ORG=' "$$file" | cut -d= -f2-)"; \
	    fi; \
	    read -r -p "DOCKERHUB_USERNAME [$$cur_user]: " input_user; input_user="$${input_user:-$$cur_user}"; \
	    read -r -s -p "DOCKERHUB_TOKEN [keep existing]: " input_token; echo; input_token="$${input_token:-$$cur_token}"; \
	    read -r -p "DOCKERHUB_ORG (optional default push namespace) [$$cur_org]: " input_org; input_org="$${input_org:-$$cur_org}"; \
	    if [ -z "$$input_user" ] || [ -z "$$input_token" ]; then echo "username and token are required" >&2; exit 1; fi; \
	    if [ -n "$$input_org" ]; then \
	      printf "DOCKERHUB_USERNAME=%s\nDOCKERHUB_TOKEN=%s\nDOCKERHUB_ORG=%s\n" "$$input_user" "$$input_token" "$$input_org" > "$$file"; \
	    else \
	      printf "DOCKERHUB_USERNAME=%s\nDOCKERHUB_TOKEN=%s\n" "$$input_user" "$$input_token" > "$$file"; \
	    fi; \
	  else \
	    read -r -s -p "$$key: " input_token; echo; \
	    if [ -z "$$input_token" ]; then echo "empty token is not allowed" >&2; exit 1; fi; \
	    printf "%s=%s\n" "$$key" "$$input_token" > "$$file"; \
	  fi; \
	  chmod 600 "$$file"; \
	  echo "wrote $$file"'
