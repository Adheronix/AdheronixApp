#!/usr/bin/env bash
# Auto-detect LAN IP and update .env for mobile-api

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"

# Allow a manual override when your phone is on a specific network.
if [ -n "$LOCAL_IP" ]; then
  LAN_IP="$LOCAL_IP"
fi

# Prefer 192.168.x.x WiFi/LAN addresses because phones commonly sit on that LAN
# while VPNs can make the default route look like 10.x.x.x.
if [ -z "$LAN_IP" ]; then
  LAN_IP=$(ip -o -4 addr show scope global 2>/dev/null \
    | awk '{split($4, address, "/"); print $2, address[1]}' \
    | grep -Ev '^(docker|br-|veth|virbr|tun|tap|wg|tailscale|zt)' \
    | awk '$2 ~ /^192\.168\./ {print $2; exit}')
fi

# Then use the IP Linux uses for outbound LAN/internet traffic.
if [ -z "$LAN_IP" ]; then
  LAN_IP=$(ip route get 1.1.1.1 2>/dev/null | awk '{for (i=1; i<=NF; i++) if ($i == "src") {print $(i+1); exit}}')
fi

# Finally fall back to other private LAN ranges.
if [ -z "$LAN_IP" ]; then
  LAN_IP=$(ip -o -4 addr show scope global 2>/dev/null \
    | awk '{split($4, address, "/"); print $2, address[1]}' \
    | grep -Ev '^(docker|br-|veth|virbr|tun|tap|wg|tailscale|zt)' \
    | awk '$2 ~ /^(10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/ {print $2; exit}')
fi

if [ -z "$LAN_IP" ]; then
  echo "Error: Could not detect LAN IP"
  exit 1
fi

echo "Detected LAN IP: $LAN_IP"

# Update or create .env file
if [ -f "$ENV_FILE" ]; then
  if grep -q "EXPO_PUBLIC_API_URL" "$ENV_FILE"; then
    sed -i "s|EXPO_PUBLIC_API_URL=.*|EXPO_PUBLIC_API_URL=http://${LAN_IP}:3000|" "$ENV_FILE"
  else
    echo "EXPO_PUBLIC_API_URL=http://${LAN_IP}:3000" >> "$ENV_FILE"
  fi
else
  echo "NODE_OPTIONS=--dns-result-order=ipv4first" > "$ENV_FILE"
  echo "EXPO_PUBLIC_API_URL=http://${LAN_IP}:3000" >> "$ENV_FILE"
fi

echo "Updated $ENV_FILE with API URL: http://${LAN_IP}:3000"
echo ""
echo "Restart Expo to pick up the new IP:"
echo "  cd $SCRIPT_DIR && npx expo start --clear"
