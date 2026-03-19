#!/bin/bash

# Default ports
BACKEND_PORT=3001
FRONTEND_PORT=3002
PROXY_PORT=7777

# Paths
BACKEND_ENV="apps/backend/.env"
FRONTEND_ENV="apps/frontend/.env"
PROXY_ENV="apps/reverse-proxy/.env"

# Read Backend Port
if [ -f "$BACKEND_ENV" ]; then
    # Use grep to find the line starting with PORT= and cut the value
    val=$(grep "^PORT=" "$BACKEND_ENV" | cut -d '=' -f2 | tr -d '\r')
    if [ ! -z "$val" ]; then
        BACKEND_PORT=$val
    fi
fi

# Read Frontend Port
if [ -f "$FRONTEND_ENV" ]; then
    val=$(grep "^PORT=" "$FRONTEND_ENV" | cut -d '=' -f2 | tr -d '\r')
    if [ ! -z "$val" ]; then
        FRONTEND_PORT=$val
    fi
fi

# Read Proxy Port
if [ -f "$PROXY_ENV" ]; then
    val=$(grep "^PORT=" "$PROXY_ENV" | cut -d '=' -f2 | tr -d '\r')
    if [ ! -z "$val" ]; then
        PROXY_PORT=$val
    fi
fi

echo "Killing processes on ports: Frontend=$FRONTEND_PORT, Backend=$BACKEND_PORT, Proxy=$PROXY_PORT"

kill_port() {
    local port=$1
    # Check if running in Git Bash or similar on Windows
    if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || "$OSTYPE" == "win32" ]]; then
       # Windows (Git Bash / Cygwin) - using netstat and taskkill
       # Note: This finds PID listening on the port
       pids=$(netstat -ano | grep ":$port " | awk '{print $5}' | sort -u)
       for pid in $pids; do
           if [ "$pid" != "0" ] && [ ! -z "$pid" ]; then
                echo "Killing $pid on port $port"
                taskkill //F //PID $pid > /dev/null 2>&1
           fi
       done
    else
       # Linux/Mac
       lsof -ti:$port | xargs kill -9 2>/dev/null || true
    fi
}

kill_port $FRONTEND_PORT
kill_port $BACKEND_PORT
kill_port $PROXY_PORT
