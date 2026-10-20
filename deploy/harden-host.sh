#!/bin/bash
set -euo pipefail
# Run only after confirming a separate SSH key session succeeds.
install -d -m 755 /etc/ssh/sshd_config.d /etc/fail2ban/jail.d /etc/fail2ban/filter.d
cp -a /etc/ssh/sshd_config /etc/ssh/sshd_config.ulianaa-backup
cat > /etc/ssh/sshd_config.d/00-ulianaa.conf <<'SSH'
PubkeyAuthentication yes
PasswordAuthentication yes
KbdInteractiveAuthentication no
PermitRootLogin yes
PermitEmptyPasswords no
MaxAuthTries 3
LoginGraceTime 30
MaxStartups 10:30:30
X11Forwarding no
AllowAgentForwarding no
Match User deploy
    PasswordAuthentication no
    AllowTcpForwarding no
    PermitTTY no
Match all
SSH
sshd -t
systemctl reload ssh
# Permit SSH before enabling the firewall; container services publish only 80/443.
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw default deny incoming
ufw default allow outgoing
ufw --force enable
cat > /etc/fail2ban/filter.d/ulianaa-login.conf <<'FILTER'
[Definition]
failregex = ^.*"request":\{[^\n]*"remote_ip":"<HOST>"[^\n]*"method":"POST"[^\n]*"uri":"/api/(?:account\?action=login|v1/auth/login)"[^\n]*"status":(?:401|429),
ignoreregex =
datepattern = "ts":{EPOCH}
FILTER
cat > /etc/fail2ban/filter.d/ulianaa-probes.conf <<'FILTER'
[Definition]
failregex = ^.*"request":\{[^\n]*"remote_ip":"<HOST>"[^\n]*"uri":"/(?:\.env[^" ]*|\.git/[^" ]*|wp-login\.php[^" ]*|wp-admin[^" ]*|xmlrpc\.php[^" ]*|phpmyadmin[^" ]*|vendor/phpunit[^" ]*|actuator/[^" ]*)"[^\n]*"status":403,
ignoreregex =
datepattern = "ts":{EPOCH}
FILTER
# Create the log before enabling jails. Docker's Caddy writes here through a bind mount.
install -d -m 700 /var/log/ulianaa
touch /var/log/ulianaa/access.json
chmod 600 /var/log/ulianaa/access.json
cat > /etc/fail2ban/jail.d/ulianaa.local <<'JAIL'
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 5
bantime.increment = true
bantime.maxtime = 1d
[sshd]
enabled = true
backend = systemd
port = ssh
[ulianaa-login]
enabled = true
backend = auto
filter = ulianaa-login
logpath = /var/log/ulianaa/access.json
maxretry = 8
banaction = iptables-allports
chain = DOCKER-USER
protocol = all
[ulianaa-probes]
enabled = true
backend = auto
filter = ulianaa-probes
logpath = /var/log/ulianaa/access.json
maxretry = 6
banaction = iptables-allports
chain = DOCKER-USER
protocol = all
JAIL
install -d -m 755 /etc/systemd/system/fail2ban.service.d
cat > /etc/systemd/system/fail2ban.service.d/ulianaa.conf <<'ORDER'
[Unit]
After=docker.service
Wants=docker.service
ORDER
systemctl daemon-reload
fail2ban-client -t
systemctl enable --now fail2ban
systemctl restart fail2ban
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'UPDATES'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
UPDATES
cat > /etc/systemd/system/ulianaa-backup.service <<'SERVICE'
[Unit]
Description=Backup ulianaa PostgreSQL
Requires=docker.service
After=docker.service
[Service]
Type=oneshot
ExecStart=/usr/local/sbin/ulianaa-backup
SERVICE
cat > /etc/systemd/system/ulianaa-backup.timer <<'TIMER'
[Unit]
Description=Daily ulianaa PostgreSQL backup
[Timer]
OnCalendar=*-*-* 03:30:00 UTC
RandomizedDelaySec=900
Persistent=true
[Install]
WantedBy=timers.target
TIMER
systemctl daemon-reload
systemctl enable --now ulianaa-backup.timer
ufw status
fail2ban-client status
sshd -T -C user=root,host=localhost,addr=127.0.0.1 | grep -E '^(passwordauthentication|pubkeyauthentication|permitrootlogin) '
